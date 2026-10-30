use serde::Serialize;
use std::sync::Mutex;
use sysinfo::{CpuRefreshKind, Disks, MemoryRefreshKind, Pid, ProcessRefreshKind, ProcessesToUpdate, System};

#[derive(Debug, Clone, Serialize)]
pub struct ProcessMetrics {
    pub cpu_usage: f32,
    pub memory_bytes: u64,
    pub memory_formatted: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SystemMetrics {
    pub cpu_usage: f32,
    pub total_memory_bytes: u64,
    pub used_memory_bytes: u64,
    pub available_memory_bytes: u64,
    pub memory_usage_pct: f32,
}

#[derive(Debug, Clone, Serialize)]
pub struct MemoryPressureMetrics {
    pub status: String, // "NORMAL" | "WARNING"
    pub description: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DiskStorageItem {
    pub id: String,
    pub name: String,
    pub mount_point: String,
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub available_bytes: u64,
    pub used_pct: f32,
    pub is_removable: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct SystemPerformanceReport {
    pub app: ProcessMetrics,
    pub system: SystemMetrics,
    pub memory_pressure: MemoryPressureMetrics,
    pub storage: Vec<DiskStorageItem>,
    pub timestamp: u64,
}

pub struct SystemMonitorState {
    pub sys: Mutex<System>,
    pub current_pid: Pid,
}

impl SystemMonitorState {
    pub fn new() -> Self {
        let mut sys = System::new();
        // Initial refresh so delta calculations work on subsequent calls
        sys.refresh_cpu_specifics(CpuRefreshKind::nothing().with_cpu_usage());
        sys.refresh_memory_specifics(MemoryRefreshKind::nothing().with_ram());
        let current_pid = Pid::from_u32(std::process::id());
        sys.refresh_processes_specifics(
            ProcessesToUpdate::Some(&[current_pid]),
            true,
            ProcessRefreshKind::nothing().with_cpu().with_memory(),
        );

        Self {
            sys: Mutex::new(sys),
            current_pid,
        }
    }
}

pub fn format_bytes_to_human(bytes: u64) -> String {
    const KB: f64 = 1024.0;
    const MB: f64 = 1024.0 * KB;
    const GB: f64 = 1024.0 * MB;
    const TB: f64 = 1024.0 * GB;

    let b = bytes as f64;
    if b >= TB {
        format!("{:.1} TB", b / TB)
    } else if b >= GB {
        format!("{:.1} GB", b / GB)
    } else if b >= MB {
        format!("{:.1} MB", b / MB)
    } else if b >= KB {
        format!("{:.1} KB", b / KB)
    } else {
        format!("{} B", bytes)
    }
}

#[cfg(target_os = "macos")]
fn detect_memory_pressure() -> (String, String) {
    let mut val: i32 = 0;
    let mut size = std::mem::size_of::<i32>();
    let name = std::ffi::CString::new("kern.memorystatus_vm_pressure_level").unwrap();
    let res = unsafe {
        libc::sysctlbyname(
            name.as_ptr(),
            &mut val as *mut i32 as *mut libc::c_void,
            &mut size,
            std::ptr::null_mut(),
            0,
        )
    };

    if res == 0 {
        // Levels: 1 = NOTE_VM_PRESSURE_NORMAL, 2 = NOTE_VM_PRESSURE_WARN, 4 = NOTE_VM_PRESSURE_CRITICAL
        if val >= 2 {
            return (
                "WARNING".to_string(),
                "Hệ thống đang chịu áp lực nén trang bộ nhớ (macOS VM Pressure)".to_string(),
            );
        } else {
            return (
                "NORMAL".to_string(),
                "Bộ nhớ hoạt động tối ưu, không có áp lực nén trang".to_string(),
            );
        }
    }

    ("NORMAL".to_string(), "Bộ nhớ hoạt động bình thường".to_string())
}

#[cfg(target_os = "windows")]
fn detect_memory_pressure(total_mem: u64, avail_mem: u64, total_swap: u64, used_swap: u64) -> (String, String) {
    let avail_pct = if total_mem > 0 {
        (avail_mem as f64 / total_mem as f64) * 100.0
    } else {
        100.0
    };
    let commit_pct = if total_swap > 0 {
        (used_swap as f64 / total_swap as f64) * 100.0
    } else {
        0.0
    };

    if (commit_pct > 85.0 && avail_pct < 10.0) || avail_pct < 5.0 {
        (
            "WARNING".to_string(),
            format!(
                "Hệ thống đang chịu áp lực bộ nhớ (Commit: {:.0}%, RAM khả dụng: {:.0}%)",
                commit_pct, avail_pct
            ),
        )
    } else {
        (
            "NORMAL".to_string(),
            "Bộ nhớ hoạt động ổn định, đủ dung lượng khả dụng".to_string(),
        )
    }
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn detect_memory_pressure(total_mem: u64, avail_mem: u64, _total_swap: u64, _used_swap: u64) -> (String, String) {
    let avail_pct = if total_mem > 0 {
        (avail_mem as f64 / total_mem as f64) * 100.0
    } else {
        100.0
    };
    if avail_pct < 8.0 {
        (
            "WARNING".to_string(),
            "Dung lượng bộ nhớ khả dụng ở mức thấp".to_string(),
        )
    } else {
        (
            "NORMAL".to_string(),
            "Bộ nhớ hoạt động bình thường".to_string(),
        )
    }
}

pub fn collect_storage_disks() -> Vec<DiskStorageItem> {
    let disks = Disks::new_with_refreshed_list();
    let mut result = Vec::new();

    #[cfg(target_os = "macos")]
    {
        use std::collections::HashSet;
        let mut seen_roots = HashSet::new();
        let mut primary_added = false;

        for disk in &disks {
            let mount = disk.mount_point().to_string_lossy().to_string();
            let name_raw = disk.name().to_string_lossy().to_string();
            let total = disk.total_space();
            let available = disk.available_space();

            // Skip zero-size or virtual devfs/autofs
            if total == 0 {
                continue;
            }

            // APFS internal system volumes to ignore
            if mount.starts_with("/System/Volumes/VM")
                || mount.starts_with("/System/Volumes/Preboot")
                || mount.starts_with("/System/Volumes/Update")
                || mount.starts_with("/System/Volumes/xarts")
                || mount.starts_with("/System/Volumes/iSCPreboot")
                || mount.starts_with("/System/Volumes/Hardware")
                || mount == "/Volumes/Recovery"
                || mount.starts_with("/Volumes/dmg.")
                || mount.starts_with("/dev")
            {
                continue;
            }

            // User Primary Volume (/ or /System/Volumes/Data)
            if mount == "/" || mount == "/System/Volumes/Data" {
                if !primary_added {
                    primary_added = true;
                    let used = total.saturating_sub(available);
                    let used_pct = if total > 0 {
                        ((used as f64 / total as f64) * 100.0) as f32
                    } else {
                        0.0
                    };

                    result.push(DiskStorageItem {
                        id: "macintosh_hd".to_string(),
                        name: "Macintosh HD".to_string(),
                        mount_point: "/".to_string(),
                        total_bytes: total,
                        used_bytes: used,
                        available_bytes: available,
                        used_pct,
                        is_removable: false,
                    });
                }
                continue;
            }

            // External volumes mounted under /Volumes/
            if mount.starts_with("/Volumes/") {
                let volume_name = mount.trim_start_matches("/Volumes/").to_string();
                if seen_roots.insert(mount.clone()) {
                    let used = total.saturating_sub(available);
                    let used_pct = if total > 0 {
                        ((used as f64 / total as f64) * 100.0) as f32
                    } else {
                        0.0
                    };

                    let display_name = if !volume_name.is_empty() {
                        volume_name
                    } else if !name_raw.is_empty() {
                        name_raw
                    } else {
                        "External Disk".to_string()
                    };

                    result.push(DiskStorageItem {
                        id: mount.clone(),
                        name: display_name,
                        mount_point: mount,
                        total_bytes: total,
                        used_bytes: used,
                        available_bytes: available,
                        used_pct,
                        is_removable: disk.is_removable(),
                    });
                }
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        for disk in &disks {
            let total = disk.total_space();
            let available = disk.available_space();
            if total == 0 {
                continue;
            }

            let mount = disk.mount_point().to_string_lossy().to_string();
            let name_raw = disk.name().to_string_lossy().to_string();
            let used = total.saturating_sub(available);
            let used_pct = if total > 0 {
                ((used as f64 / total as f64) * 100.0) as f32
            } else {
                0.0
            };

            let display_name = if !name_raw.is_empty() {
                format!("{} ({})", name_raw, mount.trim_end_matches('\\'))
            } else {
                format!("Ổ đĩa ({})", mount.trim_end_matches('\\'))
            };

            result.push(DiskStorageItem {
                id: mount.clone(),
                name: display_name,
                mount_point: mount,
                total_bytes: total,
                used_bytes: used,
                available_bytes: available,
                used_pct,
                is_removable: disk.is_removable(),
            });
        }
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        for disk in &disks {
            let total = disk.total_space();
            let available = disk.available_space();
            if total == 0 {
                continue;
            }
            let mount = disk.mount_point().to_string_lossy().to_string();
            let name_raw = disk.name().to_string_lossy().to_string();
            let used = total.saturating_sub(available);
            let used_pct = if total > 0 {
                ((used as f64 / total as f64) * 100.0) as f32
            } else {
                0.0
            };

            result.push(DiskStorageItem {
                id: mount.clone(),
                name: if !name_raw.is_empty() { name_raw } else { mount.clone() },
                mount_point: mount,
                total_bytes: total,
                used_bytes: used,
                available_bytes: available,
                used_pct,
                is_removable: disk.is_removable(),
            });
        }
    }

    result
}

#[tauri::command]
pub fn get_system_performance_metrics(
    state: tauri::State<SystemMonitorState>,
) -> Result<SystemPerformanceReport, String> {
    let mut sys = state.sys.lock().map_err(|e| format!("Lock error: {}", e))?;

    // Refresh system CPU and Memory
    sys.refresh_cpu_specifics(CpuRefreshKind::nothing().with_cpu_usage());
    sys.refresh_memory();

    // Refresh current process specifics
    sys.refresh_processes_specifics(
        ProcessesToUpdate::Some(&[state.current_pid]),
        true,
        ProcessRefreshKind::nothing().with_cpu().with_memory(),
    );

    let (app_cpu, app_mem) = if let Some(proc) = sys.process(state.current_pid) {
        (proc.cpu_usage(), proc.memory())
    } else {
        (0.0, 0)
    };

    let total_mem = sys.total_memory();
    let used_mem = sys.used_memory();
    let avail_mem = sys.available_memory();
    let mem_usage_pct = if total_mem > 0 {
        ((used_mem as f64 / total_mem as f64) * 100.0) as f32
    } else {
        0.0
    };

    let sys_cpu = sys.global_cpu_usage();

    #[cfg(target_os = "macos")]
    let (pressure_status, pressure_desc) = detect_memory_pressure();

    #[cfg(target_os = "windows")]
    let (pressure_status, pressure_desc) = detect_memory_pressure(
        total_mem,
        avail_mem,
        sys.total_swap(),
        sys.used_swap(),
    );

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let (pressure_status, pressure_desc) = detect_memory_pressure(
        total_mem,
        avail_mem,
        sys.total_swap(),
        sys.used_swap(),
    );

    let storage = collect_storage_disks();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    Ok(SystemPerformanceReport {
        app: ProcessMetrics {
            cpu_usage: (app_cpu * 10.0).round() / 10.0,
            memory_bytes: app_mem,
            memory_formatted: format_bytes_to_human(app_mem),
        },
        system: SystemMetrics {
            cpu_usage: (sys_cpu * 10.0).round() / 10.0,
            total_memory_bytes: total_mem,
            used_memory_bytes: used_mem,
            available_memory_bytes: avail_mem,
            memory_usage_pct: (mem_usage_pct * 10.0).round() / 10.0,
        },
        memory_pressure: MemoryPressureMetrics {
            status: pressure_status,
            description: pressure_desc,
        },
        storage,
        timestamp: now,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_system_performance_collection() {
        let state = SystemMonitorState::new();
        // Give a tiny interval for delta
        std::thread::sleep(std::time::Duration::from_millis(200));

        let mut sys = state.sys.lock().unwrap();
        sys.refresh_cpu_specifics(CpuRefreshKind::nothing().with_cpu_usage());
        sys.refresh_memory();
        sys.refresh_processes_specifics(
            ProcessesToUpdate::Some(&[state.current_pid]),
            true,
            ProcessRefreshKind::nothing().with_cpu().with_memory(),
        );

        let disks = collect_storage_disks();
        assert!(!disks.is_empty(), "Must detect at least 1 primary disk");
        println!("Detected disks: {:#?}", disks);

        #[cfg(target_os = "macos")]
        {
            let (status, desc) = detect_memory_pressure();
            println!("Memory pressure: {} - {}", status, desc);
            assert!(status == "NORMAL" || status == "WARNING");
        }
    }
}
