use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Runtime,
};

#[cfg(target_os = "macos")]
extern "C" {
    fn macos_configure_tray_panel_window();
}

pub fn create_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let show_i = MenuItem::with_id(app, "show", "Hiện DH Studio Pro", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let quit_i = MenuItem::with_id(app, "quit", "Thoát ứng dụng", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_i, &sep, &quit_i])?;

    // Sử dụng tray-white-44.png chuẩn màu trắng sắc nét hiển thị tuyệt đẹp trên Menu Bar macOS
    let tray_icon_bytes = include_bytes!("../icons/tray-white-44.png");
    let icon = Image::from_bytes(tray_icon_bytes)?;

    let builder = TrayIconBuilder::with_id("main-tray")
        .icon(icon)
        .icon_as_template(true)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("DH Studio Pro");

    builder
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                show_main_window(app);
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                rect,
                ..
            } = event
            {
                let app = tray.app_handle();
                toggle_tray_panel(app, Some(rect));
            }
        })
        .build(app)?;

    Ok(())
}

pub fn toggle_tray_panel<R: Runtime>(app: &AppHandle<R>, rect: Option<tauri::Rect>) {
    if let Some(panel) = app.get_webview_window("tray-panel") {
        let is_visible = panel.is_visible().unwrap_or(false);
        if is_visible {
            let _ = panel.hide();
        } else {
            let panel_width = 340.0;
            if let Some(r) = rect {
                let scale_factor = panel.scale_factor().unwrap_or(1.0);
                let pos = r.position.to_logical::<f64>(scale_factor);
                let size = r.size.to_logical::<f64>(scale_factor);
                let center_x = pos.x + (size.width / 2.0);
                let mut target_x = center_x - (panel_width / 2.0);
                if target_x < 10.0 {
                    target_x = 10.0;
                }
                let target_y = pos.y + size.height + 1.0;
                let _ = panel.set_position(tauri::LogicalPosition::new(target_x, target_y));
            } else if let Ok(Some(mon)) = panel.primary_monitor() {
                let mon_size = mon.size().to_logical::<f64>(mon.scale_factor());
                let target_x = (mon_size.width - panel_width - 20.0).max(10.0);
                let target_y = 26.0;
                let _ = panel.set_position(tauri::LogicalPosition::new(target_x, target_y));
            }

            #[cfg(target_os = "macos")]
            unsafe {
                macos_configure_tray_panel_window();
            }

            let _ = panel.show();
            let _ = panel.set_focus();
            use tauri::Emitter;
            let _ = panel.emit("tray-panel-shown", ());
        }
    } else {
        toggle_main_window(app);
    }
}

pub fn show_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app
        .get_webview_window("main")
        .or_else(|| app.webview_windows().values().next().cloned())
    {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

pub fn toggle_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app
        .get_webview_window("main")
        .or_else(|| app.webview_windows().values().next().cloned())
    {
        let is_visible = window.is_visible().unwrap_or(false);
        if is_visible {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.unminimize();
            let _ = window.set_focus();
        }
    }
}
