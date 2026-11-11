use chrono::{DateTime, Datelike, FixedOffset, Local, NaiveDate, NaiveDateTime, NaiveTime, Timelike, Utc};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::time::{Instant, UNIX_EPOCH};

// ============================================================================
// Constants: TIFF / EXIF Tag IDs
// ============================================================================
pub const TAG_MAKE: u16 = 0x010F;
pub const TAG_MODEL: u16 = 0x0110;
pub const TAG_ORIENTATION: u16 = 0x0112;
pub const TAG_DATETIME: u16 = 0x0132; // ModifyDate / DateTime in IFD0
pub const TAG_EXIF_IFD_POINTER: u16 = 0x8769;
pub const TAG_GPS_IFD_POINTER: u16 = 0x8825;
pub const TAG_RATING: u16 = 0x4746;

// ExifIFD tags
#[allow(dead_code)]
pub const TAG_EXPOSURE_TIME: u16 = 0x829A;
#[allow(dead_code)]
pub const TAG_FNUMBER: u16 = 0x829D;
pub const TAG_ISO: u16 = 0x8827;
pub const TAG_EXIF_VERSION: u16 = 0x9000;
pub const TAG_DATETIME_ORIGINAL: u16 = 0x9003;
pub const TAG_CREATE_DATE: u16 = 0x9004; // DateTimeDigitized
pub const TAG_OFFSET_TIME: u16 = 0x9010;
pub const TAG_OFFSET_TIME_ORIGINAL: u16 = 0x9011;
pub const TAG_OFFSET_TIME_DIGITIZED: u16 = 0x9012;
#[allow(dead_code)]
pub const TAG_FOCAL_LENGTH: u16 = 0x920A;
pub const TAG_INTEROP_IFD_POINTER: u16 = 0xA005;
pub const TAG_LENS_MODEL: u16 = 0xA434;

// TIFF Field Types
pub const TYPE_BYTE: u16 = 1;
pub const TYPE_ASCII: u16 = 2;
pub const TYPE_SHORT: u16 = 3;
pub const TYPE_LONG: u16 = 4;
pub const TYPE_RATIONAL: u16 = 5;
pub const TYPE_SBYTE: u16 = 6;
pub const TYPE_UNDEFINED: u16 = 7;
pub const TYPE_SSHORT: u16 = 8;
pub const TYPE_SLONG: u16 = 9;
pub const TYPE_SRATIONAL: u16 = 10;
pub const TYPE_FLOAT: u16 = 11;
pub const TYPE_DOUBLE: u16 = 12;

// ============================================================================
// Data Structures for Frontend / Tauri IPC
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExifStatusCategory {
    Valid,
    Abnormal,
    Missing,
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExifAnomalyReason {
    None,
    MissingAllDates,
    MissingDateTimeOriginal,
    MissingCreateDate,
    InconsistentDates,
    DeviceResetEpoch,
    FutureTimestamp,
    InvalidFormat,
    OutOfReasonableRange,
    InvalidOffsetFormat,
    UnreadableContainer,
}

impl ExifAnomalyReason {
    pub fn description_vi(&self) -> &'static str {
        match self {
            Self::None => "Hợp lệ",
            Self::MissingAllDates => "Thiếu toàn bộ metadata ngày chụp",
            Self::MissingDateTimeOriginal => "Thiếu trường DateTimeOriginal",
            Self::MissingCreateDate => "Thiếu trường CreateDate",
            Self::InconsistentDates => "DateTimeOriginal và CreateDate lệch nhau bất thường",
            Self::DeviceResetEpoch => "Dấu hiệu reset ngày thiết bị (Epoch / mặc định)",
            Self::FutureTimestamp => "Ngày chụp nằm trong tương lai",
            Self::InvalidFormat => "Chuỗi ngày giờ lỗi hoặc không thể phân tích",
            Self::OutOfReasonableRange => "Năm chụp nằm ngoài ngưỡng hợp lý",
            Self::InvalidOffsetFormat => "Múi giờ (OffsetTime) sai định dạng",
            Self::UnreadableContainer => "Không xác định được cấu trúc metadata",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedExifInfo {
    pub date_time_original: Option<String>,
    pub create_date: Option<String>,
    pub modify_date: Option<String>,
    pub offset_time_original: Option<String>,
    pub offset_time_digitized: Option<String>,
    pub offset_time: Option<String>,
    pub camera_make: Option<String>,
    pub camera_model: Option<String>,
    pub lens_model: Option<String>,
    pub iso: Option<u32>,
    pub orientation: Option<u16>,
    pub has_gps: bool,
    pub has_exif_segment: bool,
}

impl Default for ParsedExifInfo {
    fn default() -> Self {
        Self {
            date_time_original: None,
            create_date: None,
            modify_date: None,
            offset_time_original: None,
            offset_time_digitized: None,
            offset_time: None,
            camera_make: None,
            camera_model: None,
            lens_model: None,
            iso: None,
            orientation: None,
            has_gps: false,
            has_exif_segment: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileMetadataAnalysis {
    pub file_path: String,
    pub file_name: String,
    pub category: ExifStatusCategory,
    pub reason: ExifAnomalyReason,
    pub reason_text: String,
    pub detected_date: Option<String>,
    pub target_supported: bool,
    pub exif: ParsedExifInfo,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExifDateSource {
    Current,
    FileCreated,
    Custom,
    ReferencePhoto,
}

impl Default for ExifDateSource {
    fn default() -> Self {
        Self::Current
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FileTimestampKind {
    Created,
    Modified,
}

impl Default for FileTimestampKind {
    fn default() -> Self {
        Self::Created
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExifCorrectionScope {
    AbnormalOnly,
    AllFiles,
}

impl Default for ExifCorrectionScope {
    fn default() -> Self {
        Self::AbnormalOnly
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExifCorrectionOptions {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub date_source: ExifDateSource,
    #[serde(default)]
    pub file_timestamp_kind: FileTimestampKind,
    #[serde(default)]
    pub custom_date_time: String,
    #[serde(default)]
    pub keep_original_time_of_day: bool,
    #[serde(default)]
    pub reference_photo_path: Option<String>,
    #[serde(default)]
    pub scope: ExifCorrectionScope,
    #[serde(default)]
    pub include_missing: bool,
    #[serde(default = "default_min_reasonable_year")]
    pub min_reasonable_year: i32,
}

fn default_min_reasonable_year() -> i32 {
    1995
}

impl Default for ExifCorrectionOptions {
    fn default() -> Self {
        Self {
            enabled: false,
            date_source: ExifDateSource::Current,
            file_timestamp_kind: FileTimestampKind::Created,
            custom_date_time: String::new(),
            keep_original_time_of_day: false,
            reference_photo_path: None,
            scope: ExifCorrectionScope::AbnormalOnly,
            include_missing: false,
            min_reasonable_year: 1995,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ExifScanSummary {
    pub total_files: usize,
    pub valid_count: usize,
    pub abnormal_count: usize,
    pub missing_count: usize,
    pub unknown_count: usize,
    pub fixable_count: usize,
    pub unsupported_count: usize,
    pub scan_duration_ms: u64,
    pub sample_items: Vec<FileMetadataAnalysis>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileErrorDetail {
    pub file_name: String,
    pub stage: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ConvertBatchReport {
    pub total_processed: usize,
    pub converted_success: usize,
    pub metadata_fixed: usize,
    pub metadata_kept: usize,
    pub metadata_unsupported: usize,
    pub failed_count: usize,
    pub errors: Vec<FileErrorDetail>,
    pub scan_duration_ms: u64,
    pub convert_duration_ms: u64,
    pub exif_fix_duration_ms: u64,
    pub total_duration_ms: u64,
    pub throughput_files_per_sec: f64,
    pub output_dir: String,
    pub scan_summary: ExifScanSummary,
}

// ============================================================================
// Format Support Matrix
// ============================================================================

/// Returns whether the output format supports writing standard EXIF metadata cleanly.
pub fn is_target_format_exif_supported(actual_kind: &str) -> bool {
    matches!(actual_kind, "jpeg" | "jpg" | "tiff" | "tif" | "png" | "webp")
}

// ============================================================================
// Binary Endian Helpers
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Endian {
    Little,
    Big,
}

impl Endian {
    #[inline]
    pub fn read_u16(self, b: &[u8]) -> u16 {
        match self {
            Endian::Little => u16::from_le_bytes([b[0], b[1]]),
            Endian::Big => u16::from_be_bytes([b[0], b[1]]),
        }
    }

    #[inline]
    pub fn read_u32(self, b: &[u8]) -> u32 {
        match self {
            Endian::Little => u32::from_le_bytes([b[0], b[1], b[2], b[3]]),
            Endian::Big => u32::from_be_bytes([b[0], b[1], b[2], b[3]]),
        }
    }

    #[inline]
    pub fn write_u16(self, val: u16) -> [u8; 2] {
        match self {
            Endian::Little => val.to_le_bytes(),
            Endian::Big => val.to_be_bytes(),
        }
    }

    #[inline]
    pub fn write_u32(self, val: u32) -> [u8; 4] {
        match self {
            Endian::Little => val.to_le_bytes(),
            Endian::Big => val.to_be_bytes(),
        }
    }
}

pub fn type_unit_size(field_type: u16) -> usize {
    match field_type {
        TYPE_BYTE | TYPE_ASCII | TYPE_SBYTE | TYPE_UNDEFINED => 1,
        TYPE_SHORT | TYPE_SSHORT => 2,
        TYPE_LONG | TYPE_SLONG | TYPE_FLOAT => 4,
        TYPE_RATIONAL | TYPE_SRATIONAL | TYPE_DOUBLE => 8,
        _ => 0,
    }
}

// ============================================================================
// Fast Container Header Reader & EXIF Parser
// ============================================================================

/// Extracts raw TIFF bytes from a file without reading the entire image into memory.
/// Only reads container headers (typically 64KB - 256KB).
pub fn extract_tiff_header_from_file(path: &Path) -> Option<Vec<u8>> {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let mut file = File::open(path).ok()?;
    let mut head = [0u8; 16];
    let n = file.read(&mut head).ok()?;
    if n < 4 {
        return None;
    }

    // 1. JPEG: starts with 0xFF 0xD8
    if head[0] == 0xFF && head[1] == 0xD8 {
        file.seek(SeekFrom::Start(2)).ok()?;
        let mut marker_hdr = [0u8; 4];
        loop {
            if file.read_exact(&mut marker_hdr[0..2]).is_err() {
                break;
            }
            // Skip any padding 0xFF bytes
            while marker_hdr[0] == 0xFF && marker_hdr[1] == 0xFF {
                if file.read_exact(&mut marker_hdr[1..2]).is_err() {
                    return None;
                }
            }
            if marker_hdr[0] != 0xFF {
                break;
            }
            let marker = marker_hdr[1];
            // SOS (0xDA) or EOI (0xD9) -> stop scanning before pixel data!
            if marker == 0xDA || marker == 0xD9 {
                break;
            }
            // Standalone markers without length
            if marker == 0xD8 || (0xD0..=0xD7).contains(&marker) || marker == 0x01 {
                continue;
            }
            if file.read_exact(&mut marker_hdr[2..4]).is_err() {
                break;
            }
            let seg_len = u16::from_be_bytes([marker_hdr[2], marker_hdr[3]]) as usize;
            if seg_len < 2 {
                break;
            }
            let payload_len = seg_len - 2;
            if marker == 0xE1 && payload_len >= 6 {
                let mut sig = [0u8; 6];
                file.read_exact(&mut sig).ok()?;
                if &sig == b"Exif\0\0" {
                    let tiff_len = payload_len - 6;
                    let mut tiff = vec![0u8; tiff_len];
                    file.read_exact(&mut tiff).ok()?;
                    return Some(tiff);
                } else {
                    file.seek(SeekFrom::Current((payload_len - 6) as i64)).ok()?;
                }
            } else {
                file.seek(SeekFrom::Current(payload_len as i64)).ok()?;
            }
        }
        return None;
    }

    // 2. Standard TIFF & TIFF-based RAWs (CR2, ARW, NEF, DNG, ORF, RW2, PEF, SRW):
    // Little-endian "II*\0" or "II\x55\0" (RW2) or "IIRO" (ORF), or Big-endian "MM\0*"
    if (head[0] == b'I' && head[1] == b'I') || (head[0] == b'M' && head[1] == b'M') {
        file.seek(SeekFrom::Start(0)).ok()?;
        let mut buf = vec![0u8; 256 * 1024];
        let read_n = file.read(&mut buf).ok()?;
        buf.truncate(read_n);
        return Some(buf);
    }

    // 3. PNG: "\x89PNG\r\n\x1a\n"
    if n >= 8 && &head[0..8] == b"\x89PNG\r\n\x1a\n" {
        file.seek(SeekFrom::Start(8)).ok()?;
        let mut chunk_hdr = [0u8; 8];
        loop {
            if file.read_exact(&mut chunk_hdr).is_err() {
                break;
            }
            let length = u32::from_be_bytes([chunk_hdr[0], chunk_hdr[1], chunk_hdr[2], chunk_hdr[3]]) as usize;
            let ctype = &chunk_hdr[4..8];
            if ctype == b"eXIf" && length >= 8 && length <= 10 * 1024 * 1024 {
                let mut tiff = vec![0u8; length];
                file.read_exact(&mut tiff).ok()?;
                return Some(tiff);
            }
            if ctype == b"IEND" || ctype == b"IDAT" {
                // Note: eXIf can occasionally appear after IDAT, but skipping IDAT is easy with Seek
            }
            // Seek past chunk data + 4-byte CRC
            if file.seek(SeekFrom::Current(length as i64 + 4)).is_err() {
                break;
            }
            if ctype == b"IEND" {
                break;
            }
        }
        return None;
    }

    // 4. WebP: "RIFF....WEBP"
    if n >= 12 && &head[0..4] == b"RIFF" && &head[8..12] == b"WEBP" {
        file.seek(SeekFrom::Start(12)).ok()?;
        let mut chunk_hdr = [0u8; 8];
        while file.read_exact(&mut chunk_hdr).is_ok() {
            let fourcc = &chunk_hdr[0..4];
            let size = u32::from_le_bytes([chunk_hdr[4], chunk_hdr[5], chunk_hdr[6], chunk_hdr[7]]) as usize;
            if fourcc == b"EXIF" && size >= 6 && size <= 10 * 1024 * 1024 {
                let mut data = vec![0u8; size];
                file.read_exact(&mut data).ok()?;
                if data.starts_with(b"Exif\0\0") {
                    return Some(data[6..].to_vec());
                }
                return Some(data);
            }
            let padded = size + (size & 1);
            if file.seek(SeekFrom::Current(padded as i64)).is_err() {
                break;
            }
        }
        return None;
    }

    // 5. Camera RAW containers & ISO BMFF (HEIC, HEIF, CR2, CR3, ARW, NEF, DNG, RAF, etc.):
    // Read up to 512KB and locate embedded "Exif\0\0" or TIFF header containing EXIF tags
    if matches!(
        ext.as_str(),
        "heic" | "heif" | "cr2" | "cr3" | "arw" | "dng" | "raw" | "nef" | "orf" | "raf"
            | "sr2" | "rw2" | "pef" | "x3f" | "srw" | "crw" | "mrw"
    ) {
        file.seek(SeekFrom::Start(0)).ok()?;
        let mut buf = vec![0u8; 512 * 1024];
        let read_n = file.read(&mut buf).ok()?;
        buf.truncate(read_n);
        if let Some(pos) = buf.windows(6).position(|w| w == b"Exif\0\0") {
            if pos + 14 <= buf.len() {
                let slice = &buf[pos + 6..];
                if slice.starts_with(b"II\x2A\x00") || slice.starts_with(b"MM\x00\x2A") {
                    return Some(slice.to_vec());
                }
            }
        }
        // CR3 CMT1/CMT2 boxes contain raw TIFF headers ("II*\0" or "MM\0*")
        for sig in [b"II\x2A\x00", b"MM\x00\x2A"] {
            let mut search_from = 0;
            while search_from + 8 < buf.len() {
                if let Some(rel) = buf[search_from..].windows(4).position(|w| w == sig) {
                    let abs = search_from + rel;
                    let candidate = &buf[abs..];
                    let info = parse_tiff_exif(candidate);
                    if info.date_time_original.is_some()
                        || info.create_date.is_some()
                        || info.camera_make.is_some()
                        || info.camera_model.is_some()
                    {
                        return Some(candidate.to_vec());
                    }
                    search_from = abs + 4;
                } else {
                    break;
                }
            }
        }
    }

    None
}

/// Parses TIFF/EXIF bytes into `ParsedExifInfo`.
pub fn parse_tiff_exif(tiff: &[u8]) -> ParsedExifInfo {
    let mut info = ParsedExifInfo::default();
    if tiff.len() < 8 {
        return info;
    }

    let endian = if &tiff[0..2] == b"II" {
        Endian::Little
    } else if &tiff[0..2] == b"MM" {
        Endian::Big
    } else {
        return info;
    };

    let magic = endian.read_u16(&tiff[2..4]);
    if magic != 42 && magic != 0x0055 && magic != 0x4F52 {
        return info;
    }

    let ifd0_offset = endian.read_u32(&tiff[4..8]) as usize;
    if ifd0_offset + 2 > tiff.len() {
        return info;
    }

    info.has_exif_segment = true;
    let mut exif_ifd_offset: Option<usize> = None;

    // Parse IFD0
    parse_ifd_entries(tiff, endian, ifd0_offset, &mut |tag, field_type, count, val_bytes| {
        match tag {
            TAG_MAKE => {
                if let Some(s) = read_ascii_tag(tiff, endian, field_type, count, val_bytes) {
                    info.camera_make = Some(s);
                }
            }
            TAG_MODEL => {
                if let Some(s) = read_ascii_tag(tiff, endian, field_type, count, val_bytes) {
                    info.camera_model = Some(s);
                }
            }
            TAG_ORIENTATION => {
                if field_type == TYPE_SHORT && count >= 1 {
                    info.orientation = Some(endian.read_u16(&val_bytes[0..2]));
                }
            }
            TAG_DATETIME => {
                if let Some(s) = read_ascii_tag(tiff, endian, field_type, count, val_bytes) {
                    info.modify_date = Some(s);
                }
            }
            TAG_DATETIME_ORIGINAL => {
                if let Some(s) = read_ascii_tag(tiff, endian, field_type, count, val_bytes) {
                    if info.date_time_original.is_none() {
                        info.date_time_original = Some(s);
                    }
                }
            }
            TAG_CREATE_DATE => {
                if let Some(s) = read_ascii_tag(tiff, endian, field_type, count, val_bytes) {
                    if info.create_date.is_none() {
                        info.create_date = Some(s);
                    }
                }
            }
            TAG_EXIF_IFD_POINTER => {
                if (field_type == TYPE_LONG || field_type == TYPE_SHORT) && count == 1 {
                    let ptr = if field_type == TYPE_LONG {
                        endian.read_u32(val_bytes) as usize
                    } else {
                        endian.read_u16(&val_bytes[0..2]) as usize
                    };
                    exif_ifd_offset = Some(ptr);
                }
            }
            TAG_GPS_IFD_POINTER => {
                info.has_gps = true;
            }
            _ => {}
        }
    });

    // Parse ExifIFD if present
    if let Some(offset) = exif_ifd_offset {
        if offset + 2 <= tiff.len() {
            parse_ifd_entries(tiff, endian, offset, &mut |tag, field_type, count, val_bytes| {
                match tag {
                    TAG_DATETIME_ORIGINAL => {
                        if let Some(s) = read_ascii_tag(tiff, endian, field_type, count, val_bytes) {
                            info.date_time_original = Some(s);
                        }
                    }
                    TAG_CREATE_DATE => {
                        if let Some(s) = read_ascii_tag(tiff, endian, field_type, count, val_bytes) {
                            info.create_date = Some(s);
                        }
                    }
                    TAG_OFFSET_TIME => {
                        if let Some(s) = read_ascii_tag(tiff, endian, field_type, count, val_bytes) {
                            info.offset_time = Some(s);
                        }
                    }
                    TAG_OFFSET_TIME_ORIGINAL => {
                        if let Some(s) = read_ascii_tag(tiff, endian, field_type, count, val_bytes) {
                            info.offset_time_original = Some(s);
                        }
                    }
                    TAG_OFFSET_TIME_DIGITIZED => {
                        if let Some(s) = read_ascii_tag(tiff, endian, field_type, count, val_bytes) {
                            info.offset_time_digitized = Some(s);
                        }
                    }
                    TAG_LENS_MODEL => {
                        if let Some(s) = read_ascii_tag(tiff, endian, field_type, count, val_bytes) {
                            info.lens_model = Some(s);
                        }
                    }
                    TAG_ISO => {
                        if field_type == TYPE_SHORT && count >= 1 {
                            info.iso = Some(endian.read_u16(&val_bytes[0..2]) as u32);
                        } else if field_type == TYPE_LONG && count >= 1 {
                            info.iso = Some(endian.read_u32(val_bytes));
                        }
                    }
                    _ => {}
                }
            });
        }
    }

    info
}

fn parse_ifd_entries<F>(tiff: &[u8], endian: Endian, ifd_offset: usize, callback: &mut F)
where
    F: FnMut(u16, u16, u32, &[u8]),
{
    if ifd_offset + 2 > tiff.len() {
        return;
    }
    let entry_count = endian.read_u16(&tiff[ifd_offset..ifd_offset + 2]) as usize;
    if entry_count > 512 {
        return;
    }
    let entries_start = ifd_offset + 2;
    for i in 0..entry_count {
        let pos = entries_start + i * 12;
        if pos + 12 > tiff.len() {
            break;
        }
        let tag = endian.read_u16(&tiff[pos..pos + 2]);
        let field_type = endian.read_u16(&tiff[pos + 2..pos + 4]);
        let count = endian.read_u32(&tiff[pos + 4..pos + 8]);
        let val_bytes = &tiff[pos + 8..pos + 12];
        callback(tag, field_type, count, val_bytes);
    }
}

fn read_ascii_tag(
    tiff: &[u8],
    endian: Endian,
    field_type: u16,
    count: u32,
    val_bytes: &[u8],
) -> Option<String> {
    if field_type != TYPE_ASCII && field_type != TYPE_UNDEFINED {
        return None;
    }
    let len = count as usize;
    if len == 0 || len > 4096 {
        return None;
    }
    let slice = if len <= 4 {
        &val_bytes[0..len]
    } else {
        let offset = endian.read_u32(val_bytes) as usize;
        if offset.checked_add(len)? > tiff.len() {
            return None;
        }
        &tiff[offset..offset + len]
    };
    let trimmed = slice
        .split(|&b| b == 0)
        .next()
        .unwrap_or(slice);
    Some(String::from_utf8_lossy(trimmed).trim_matches('\0').to_string())
}

// ============================================================================
// Flexible EXIF Date Parsing & Anomaly Detection (Section 3)
// ============================================================================

/// Parses an EXIF date string (`"YYYY:MM:DD HH:MM:SS"` or `"YYYY-MM-DD HH:MM:SS"`).
/// Strictly validates calendar dates (e.g. rejects Feb 30, month 00/13, hour 25, zero dates).
pub fn parse_exif_datetime_str(raw: &str) -> Option<NaiveDateTime> {
    let s = raw.trim();
    if s.len() < 19 {
        return None;
    }
    // Check for empty/zero placeholders like "0000:00:00 00:00:00" or "    :  :     :  :  "
    let s19 = &s[0..19];
    let bytes = s19.as_bytes();
    if ! matches!(bytes[4], b':' | b'-' | b'/')
        || !matches!(bytes[7], b':' | b'-' | b'/')
        || !matches!(bytes[10], b' ' | b'T')
        || bytes[13] != b':'
        || bytes[16] != b':'
    {
        return None;
    }

    let year: i32 = s19[0..4].parse().ok()?;
    let month: u32 = s19[5..7].parse().ok()?;
    let day: u32 = s19[8..10].parse().ok()?;
    let hour: u32 = s19[11..13].parse().ok()?;
    let minute: u32 = s19[14..16].parse().ok()?;
    let second: u32 = s19[17..19].parse().ok()?;

    let date = NaiveDate::from_ymd_opt(year, month, day)?;
    let time = NaiveTime::from_hms_opt(hour, minute, second)?;
    Some(NaiveDateTime::new(date, time))
}

/// Validates an EXIF OffsetTime string (`"+07:00"`, `"-05:00"`, `"Z"`).
pub fn is_valid_offset_str(raw: &str) -> bool {
    let s = raw.trim();
    if s.is_empty() {
        return false;
    }
    if s == "Z" {
        return true;
    }
    if s.len() != 6 {
        return false;
    }
    let b = s.as_bytes();
    if (b[0] != b'+' && b[0] != b'-') || b[3] != b':' {
        return false;
    }
    let Ok(hh) = s[1..3].parse::<u32>() else { return false };
    let Ok(mm) = s[4..6].parse::<u32>() else { return false };
    hh <= 14 && mm < 60
}

/// Checks if a parsed NaiveDateTime matches known device/RTC clock reset signatures.
pub fn is_device_reset_signature(dt: NaiveDateTime) -> bool {
    let y = dt.year();
    let m = dt.month();
    let d = dt.day();

    // Known epoch / factory reset dates across Canon, Nikon, Sony, Fujifilm, Panasonic, Android/iOS/FAT/Unix:
    // - 1970-01-01 (Unix epoch)
    // - 1980-01-01 (DOS/FAT/Camera RTC default)
    // - 1999-11-30 / 1999-12-31
    // - 2000-01-01 (Y2K / Camera CMOS battery reset default)
    // - 1900-01-01 / 1904-01-01 (Mac HFS / NTP epoch)
    if (y == 1970 && m == 1 && d <= 2)
        || (y == 1980 && m == 1 && d <= 2)
        || (y == 1999 && ((m == 11 && d == 30) || (m == 12 && d == 31)))
        || (y == 2000 && m == 1 && d == 1)
        || y == 1900
        || y == 1904
    {
        return true;
    }

    // Also if year is 1970, 1980, or 2000 with midnight 00:00:00
    if (y == 1970 || y == 1980 || y == 2000) && dt.hour() == 0 && dt.minute() == 0 && dt.second() == 0 {
        return true;
    }

    false
}

/// Analyzes a single file's EXIF metadata and classifies it into:
/// - `Valid` (Hợp lệ)
/// - `Abnormal` (Có dấu hiệu bất thường)
/// - `Missing` (Thiếu metadata)
/// - `Unknown` (Không xác định)
pub fn analyze_file_metadata(
    path: &Path,
    target_kind: &str,
    min_reasonable_year: i32,
) -> FileMetadataAnalysis {
    let file_name = path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let file_path = path.to_string_lossy().to_string();
    let target_supported = is_target_format_exif_supported(target_kind);

    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    // Formats that do not carry EXIF structures (e.g. BMP, GIF, TGA, SGI, ICNS)
    let container_can_have_exif = matches!(
        ext.as_str(),
        "jpg" | "jpeg" | "png" | "webp" | "tiff" | "tif" | "heic" | "heif"
            | "cr2" | "cr3" | "arw" | "dng" | "raw" | "nef" | "orf" | "raf"
            | "sr2" | "rw2" | "pef" | "x3f" | "srw" | "crw" | "mrw"
    );

    if !container_can_have_exif {
        return FileMetadataAnalysis {
            file_path,
            file_name,
            category: ExifStatusCategory::Missing,
            reason: ExifAnomalyReason::MissingAllDates,
            reason_text: ExifAnomalyReason::MissingAllDates.description_vi().to_string(),
            detected_date: None,
            target_supported,
            exif: ParsedExifInfo::default(),
        };
    }

    let tiff_opt = extract_tiff_header_from_file(path);
    let Some(tiff) = tiff_opt else {
        // Check if file is readable and has valid container magic
        if is_corrupt_or_unrecognized_container(path) {
            return FileMetadataAnalysis {
                file_path,
                file_name,
                category: ExifStatusCategory::Unknown,
                reason: ExifAnomalyReason::UnreadableContainer,
                reason_text: ExifAnomalyReason::UnreadableContainer.description_vi().to_string(),
                detected_date: None,
                target_supported,
                exif: ParsedExifInfo::default(),
            };
        }
        return FileMetadataAnalysis {
            file_path,
            file_name,
            category: ExifStatusCategory::Missing,
            reason: ExifAnomalyReason::MissingAllDates,
            reason_text: ExifAnomalyReason::MissingAllDates.description_vi().to_string(),
            detected_date: None,
            target_supported,
            exif: ParsedExifInfo::default(),
        };
    };

    let exif = parse_tiff_exif(&tiff);
    if !exif.has_exif_segment {
        return FileMetadataAnalysis {
            file_path,
            file_name,
            category: ExifStatusCategory::Unknown,
            reason: ExifAnomalyReason::UnreadableContainer,
            reason_text: ExifAnomalyReason::UnreadableContainer.description_vi().to_string(),
            detected_date: None,
            target_supported,
            exif,
        };
    }

    classify_parsed_exif(file_path, file_name, exif, target_supported, min_reasonable_year)
}

fn is_corrupt_or_unrecognized_container(path: &Path) -> bool {
    let Ok(mut f) = File::open(path) else { return true };
    let mut head = [0u8; 12];
    let Ok(n) = f.read(&mut head) else { return true };
    if n < 4 {
        return true;
    }
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
    match ext.as_str() {
        "jpg" | "jpeg" => !(head[0] == 0xFF && head[1] == 0xD8),
        "png" => n < 8 || &head[0..8] != b"\x89PNG\r\n\x1a\n",
        "webp" => n < 12 || &head[0..4] != b"RIFF" || &head[8..12] != b"WEBP",
        "tif" | "tiff" => !(&head[0..2] == b"II" || &head[0..2] == b"MM"),
        _ => false,
    }
}

pub fn classify_parsed_exif(
    file_path: String,
    file_name: String,
    exif: ParsedExifInfo,
    target_supported: bool,
    min_reasonable_year: i32,
) -> FileMetadataAnalysis {
    let dto_raw = exif.date_time_original.as_deref();
    let cd_raw = exif.create_date.as_deref();
    let md_raw = exif.modify_date.as_deref();

    let detected_date = dto_raw
        .or(cd_raw)
        .or(md_raw)
        .map(|s| s.to_string());

    // 1. All date fields absent -> Missing Metadata
    if dto_raw.is_none() && cd_raw.is_none() && md_raw.is_none() {
        return FileMetadataAnalysis {
            file_path,
            file_name,
            category: ExifStatusCategory::Missing,
            reason: ExifAnomalyReason::MissingAllDates,
            reason_text: ExifAnomalyReason::MissingAllDates.description_vi().to_string(),
            detected_date: None,
            target_supported,
            exif,
        };
    }

    // 2. Check if any present date string is malformed / unparseable
    let dto_parsed = match dto_raw {
        Some(s) => match parse_exif_datetime_str(s) {
            Some(dt) => Some(dt),
            None => {
                return FileMetadataAnalysis {
                    file_path,
                    file_name,
                    category: ExifStatusCategory::Abnormal,
                    reason: ExifAnomalyReason::InvalidFormat,
                    reason_text: format!("DateTimeOriginal không hợp lệ ({s})"),
                    detected_date,
                    target_supported,
                    exif,
                };
            }
        },
        None => None,
    };

    let cd_parsed = match cd_raw {
        Some(s) => match parse_exif_datetime_str(s) {
            Some(dt) => Some(dt),
            None => {
                return FileMetadataAnalysis {
                    file_path,
                    file_name,
                    category: ExifStatusCategory::Abnormal,
                    reason: ExifAnomalyReason::InvalidFormat,
                    reason_text: format!("CreateDate không hợp lệ ({s})"),
                    detected_date,
                    target_supported,
                    exif,
                };
            }
        },
        None => None,
    };

    if let Some(s) = md_raw {
        if parse_exif_datetime_str(s).is_none() {
            return FileMetadataAnalysis {
                file_path,
                file_name,
                category: ExifStatusCategory::Abnormal,
                reason: ExifAnomalyReason::InvalidFormat,
                reason_text: format!("ModifyDate không hợp lệ ({s})"),
                detected_date,
                target_supported,
                exif,
            };
        }
    }

    // 3. Check if DateTimeOriginal or CreateDate is missing while other date tags exist
    if dto_parsed.is_none() && cd_parsed.is_none() {
        // Only ModifyDate exists -> missing both DateTimeOriginal and CreateDate
        return FileMetadataAnalysis {
            file_path,
            file_name,
            category: ExifStatusCategory::Abnormal,
            reason: ExifAnomalyReason::MissingDateTimeOriginal,
            reason_text: ExifAnomalyReason::MissingDateTimeOriginal.description_vi().to_string(),
            detected_date,
            target_supported,
            exif,
        };
    }

    let primary_dt = dto_parsed.or(cd_parsed).unwrap();

    // 4. Device reset signature check (1970-01-01, 1980-01-01, 2000-01-01, etc.)
    if is_device_reset_signature(primary_dt)
        || cd_parsed.map(is_device_reset_signature).unwrap_or(false)
    {
        return FileMetadataAnalysis {
            file_path,
            file_name,
            category: ExifStatusCategory::Abnormal,
            reason: ExifAnomalyReason::DeviceResetEpoch,
            reason_text: ExifAnomalyReason::DeviceResetEpoch.description_vi().to_string(),
            detected_date,
            target_supported,
            exif,
        };
    }

    // 5. Out of reasonable range check (year < min_reasonable_year)
    let min_year = min_reasonable_year.clamp(1971, 2025);
    if primary_dt.year() < min_year {
        return FileMetadataAnalysis {
            file_path,
            file_name,
            category: ExifStatusCategory::Abnormal,
            reason: ExifAnomalyReason::OutOfReasonableRange,
            reason_text: format!("Năm chụp ({}) nhỏ hơn ngưỡng hợp lý ({})", primary_dt.year(), min_year),
            detected_date,
            target_supported,
            exif,
        };
    }

    // 6. Future date check (> current OS local time + 15 minutes grace)
    let now_local = Local::now().naive_local();
    if (primary_dt - now_local).num_minutes() > 15 {
        return FileMetadataAnalysis {
            file_path,
            file_name,
            category: ExifStatusCategory::Abnormal,
            reason: ExifAnomalyReason::FutureTimestamp,
            reason_text: ExifAnomalyReason::FutureTimestamp.description_vi().to_string(),
            detected_date,
            target_supported,
            exif,
        };
    }

    // 7. Missing DateTimeOriginal or missing CreateDate
    if dto_parsed.is_none() {
        return FileMetadataAnalysis {
            file_path,
            file_name,
            category: ExifStatusCategory::Abnormal,
            reason: ExifAnomalyReason::MissingDateTimeOriginal,
            reason_text: ExifAnomalyReason::MissingDateTimeOriginal.description_vi().to_string(),
            detected_date,
            target_supported,
            exif,
        };
    }
    if cd_parsed.is_none() {
        return FileMetadataAnalysis {
            file_path,
            file_name,
            category: ExifStatusCategory::Abnormal,
            reason: ExifAnomalyReason::MissingCreateDate,
            reason_text: ExifAnomalyReason::MissingCreateDate.description_vi().to_string(),
            detected_date,
            target_supported,
            exif,
        };
    }

    // 8. Inconsistency between DateTimeOriginal and CreateDate (> 24 hours apart)
    if let (Some(dto), Some(cd)) = (dto_parsed, cd_parsed) {
        let diff_secs = (dto - cd).num_seconds().abs();
        if diff_secs > 86_400 {
            return FileMetadataAnalysis {
                file_path,
                file_name,
                category: ExifStatusCategory::Abnormal,
                reason: ExifAnomalyReason::InconsistentDates,
                reason_text: ExifAnomalyReason::InconsistentDates.description_vi().to_string(),
                detected_date,
                target_supported,
                exif,
            };
        }
    }

    // 9. Check OffsetTime format if present
    let invalid_offset = [
        exif.offset_time_original.as_deref(),
        exif.offset_time_digitized.as_deref(),
        exif.offset_time.as_deref(),
    ]
    .into_iter()
    .flatten()
    .find(|off| !is_valid_offset_str(off))
    .map(|s| s.to_string());

    if let Some(off) = invalid_offset {
        return FileMetadataAnalysis {
            file_path,
            file_name,
            category: ExifStatusCategory::Abnormal,
            reason: ExifAnomalyReason::InvalidOffsetFormat,
            reason_text: format!("OffsetTime sai định dạng ({off})"),
            detected_date,
            target_supported,
            exif,
        };
    }

    FileMetadataAnalysis {
        file_path,
        file_name,
        category: ExifStatusCategory::Valid,
        reason: ExifAnomalyReason::None,
        reason_text: ExifAnomalyReason::None.description_vi().to_string(),
        detected_date,
        target_supported,
        exif,
    }
}

/// Determines whether a file should have its EXIF date modified based on its analysis and user options.
pub fn should_fix_file_metadata(
    analysis: &FileMetadataAnalysis,
    options: &ExifCorrectionOptions,
) -> bool {
    if !options.enabled || !analysis.target_supported {
        return false;
    }
    match options.scope {
        ExifCorrectionScope::AllFiles => true,
        ExifCorrectionScope::AbnormalOnly => match analysis.category {
            ExifStatusCategory::Valid => false,
            ExifStatusCategory::Abnormal => true,
            ExifStatusCategory::Missing => options.include_missing,
            ExifStatusCategory::Unknown => false,
        },
    }
}

// ============================================================================
// Replacement Timestamp Resolution (Section 4)
// ============================================================================

#[derive(Debug, Clone)]
pub struct ResolvedExifTimestamp {
    /// Formatted as `"YYYY:MM:DD HH:MM:SS"` (19 chars)
    pub exif_datetime: String,
    /// Formatted as `"+HH:MM"` or `"-HH:MM"` (6 chars)
    pub exif_offset: String,
    pub naive_dt: NaiveDateTime,
}

impl ResolvedExifTimestamp {
    pub fn from_naive_and_offset(dt: NaiveDateTime, offset_str: String) -> Self {
        let exif_datetime = format!(
            "{:04}:{:02}:{:02} {:02}:{:02}:{:02}",
            dt.year(),
            dt.month(),
            dt.day(),
            dt.hour(),
            dt.minute(),
            dt.second()
        );
        Self {
            exif_datetime,
            exif_offset: offset_str,
            naive_dt: dt,
        }
    }
}

pub fn local_offset_string() -> String {
    let offset_secs = Local::now().offset().local_minus_utc();
    let sign = if offset_secs >= 0 { '+' } else { '-' };
    let abs = offset_secs.abs();
    let hh = abs / 3600;
    let mm = (abs % 3600) / 60;
    format!("{sign}{hh:02}:{mm:02}")
}

/// Resolves the target timestamp for a given input file according to `ExifCorrectionOptions`.
pub fn resolve_target_timestamp(
    input_path: &Path,
    analysis: &FileMetadataAnalysis,
    options: &ExifCorrectionOptions,
    cached_reference_dt: Option<&ResolvedExifTimestamp>,
) -> Result<ResolvedExifTimestamp, String> {
    let default_offset = local_offset_string();

    match options.date_source {
        ExifDateSource::Current => {
            let now = Local::now().naive_local();
            Ok(ResolvedExifTimestamp::from_naive_and_offset(now, default_offset))
        }
        ExifDateSource::FileCreated => {
            let meta = fs::metadata(input_path)
                .map_err(|e| format!("Không đọc được metadata filesystem: {e}"))?;
            let sys_time = match options.file_timestamp_kind {
                FileTimestampKind::Created => meta.created().or_else(|_| meta.modified()),
                FileTimestampKind::Modified => meta.modified(),
            }
            .map_err(|e| format!("Không lấy được thời gian tạo/sửa file: {e}"))?;

            let dur = sys_time
                .duration_since(UNIX_EPOCH)
                .map_err(|_| "Timestamp của file nằm trước năm 1970".to_string())?;
            let dt_utc = DateTime::<Utc>::from_timestamp(dur.as_secs() as i64, 0)
                .ok_or_else(|| "Timestamp của file không hợp lệ".to_string())?;
            let offset_secs = Local::now().offset().local_minus_utc();
            let fixed = FixedOffset::east_opt(offset_secs)
                .unwrap_or_else(|| FixedOffset::east_opt(0).unwrap());
            let dt_local = dt_utc.with_timezone(&fixed).naive_local();
            Ok(ResolvedExifTimestamp::from_naive_and_offset(dt_local, default_offset))
        }
        ExifDateSource::Custom => {
            let custom_raw = options.custom_date_time.trim();
            if custom_raw.is_empty() {
                return Err("Chưa nhập ngày giờ tùy chỉnh".to_string());
            }
            let mut base_dt = parse_flexible_user_datetime(custom_raw)
                .ok_or_else(|| format!("Định dạng ngày giờ tùy chỉnh không hợp lệ: '{custom_raw}' (Ví dụ đúng: 2026-11-11 14:30:00)"))?;

            if options.keep_original_time_of_day {
                if let Some(orig_str) = analysis.detected_date.as_deref() {
                    if let Some(orig_dt) = parse_exif_datetime_str(orig_str) {
                        base_dt = NaiveDateTime::new(base_dt.date(), orig_dt.time());
                    }
                }
            }
            Ok(ResolvedExifTimestamp::from_naive_and_offset(base_dt, default_offset))
        }
        ExifDateSource::ReferencePhoto => {
            if let Some(ref_ts) = cached_reference_dt {
                let mut dt = ref_ts.naive_dt;
                if options.keep_original_time_of_day {
                    if let Some(orig_str) = analysis.detected_date.as_deref() {
                        if let Some(orig_dt) = parse_exif_datetime_str(orig_str) {
                            dt = NaiveDateTime::new(dt.date(), orig_dt.time());
                        }
                    }
                }
                return Ok(ResolvedExifTimestamp::from_naive_and_offset(
                    dt,
                    ref_ts.exif_offset.clone(),
                ));
            }
            Err("Không tìm thấy hoặc không đọc được ngày chụp từ ảnh tham chiếu".to_string())
        }
    }
}

pub fn parse_flexible_user_datetime(s: &str) -> Option<NaiveDateTime> {
    let trimmed = s.trim();
    if let Some(dt) = parse_exif_datetime_str(trimmed) {
        return Some(dt);
    }
    // Support "YYYY-MM-DD HH:MM" (without seconds)
    if trimmed.len() == 16 {
        let with_sec = format!("{trimmed}:00");
        if let Some(dt) = parse_exif_datetime_str(&with_sec) {
            return Some(dt);
        }
    }
    // Support "YYYY-MM-DD" (date only -> defaults to current time of day)
    if trimmed.len() == 10 {
        let now_time = Local::now().time();
        let full = format!(
            "{} {:02}:{:02}:{:02}",
            trimmed,
            now_time.hour(),
            now_time.minute(),
            now_time.second()
        );
        if let Some(dt) = parse_exif_datetime_str(&full) {
            return Some(dt);
        }
    }
    None
}

pub fn read_reference_photo_timestamp(path: &Path) -> Result<ResolvedExifTimestamp, String> {
    let tiff = extract_tiff_header_from_file(path)
        .ok_or_else(|| "Ảnh tham chiếu không chứa dữ liệu EXIF".to_string())?;
    let info = parse_tiff_exif(&tiff);
    let raw_dt = info
        .date_time_original
        .or(info.create_date)
        .or(info.modify_date)
        .ok_or_else(|| "Ảnh tham chiếu không có trường ngày chụp EXIF".to_string())?;
    let dt = parse_exif_datetime_str(&raw_dt)
        .ok_or_else(|| format!("Ngày chụp trong ảnh tham chiếu không hợp lệ: {raw_dt}"))?;
    let offset = info
        .offset_time_original
        .or(info.offset_time_digitized)
        .or(info.offset_time)
        .filter(|s| is_valid_offset_str(s))
        .unwrap_or_else(local_offset_string);
    Ok(ResolvedExifTimestamp::from_naive_and_offset(dt, offset))
}

// ============================================================================
// High-Performance Lossless TIFF / EXIF Patcher & Builder (Section 5, 7, 16)
// ============================================================================

#[derive(Clone)]
struct RawIfdEntry {
    tag: u16,
    field_type: u16,
    count: u32,
    data: Vec<u8>,
}

/// Attempts an ultra-fast in-place byte patch on a TIFF buffer if `DateTime` (0x0132),
/// `DateTimeOriginal` (0x9003), and `CreateDate` (0x9004) are all present with >= 20 bytes.
/// If any of the 3 required date tags is missing, returns `None` so the full IFD builder runs.
fn try_patch_tiff_dates_in_place(
    tiff: &mut [u8],
    ts: &ResolvedExifTimestamp,
) -> Option<()> {
    if tiff.len() < 8 {
        return None;
    }
    let endian = if &tiff[0..2] == b"II" {
        Endian::Little
    } else if &tiff[0..2] == b"MM" {
        Endian::Big
    } else {
        return None;
    };
    if endian.read_u16(&tiff[2..4]) != 42 {
        return None;
    }
    let ifd0_offset = endian.read_u32(&tiff[4..8]) as usize;
    if ifd0_offset + 2 > tiff.len() {
        return None;
    }

    let mut dt_offset: Option<usize> = None;
    let mut dto_offset: Option<usize> = None;
    let mut cd_offset: Option<usize> = None;
    let mut off_orig_loc: Option<(usize, usize)> = None;
    let mut off_dig_loc: Option<(usize, usize)> = None;
    let mut off_loc: Option<(usize, usize)> = None;
    let mut exif_ifd_ptr: Option<usize> = None;

    let find_ascii_value_offset = |tiff: &[u8], pos: usize| -> Option<(usize, usize)> {
        let field_type = endian.read_u16(&tiff[pos + 2..pos + 4]);
        let count = endian.read_u32(&tiff[pos + 4..pos + 8]) as usize;
        if field_type != TYPE_ASCII || count < 7 {
            return None;
        }
        let val_offset = endian.read_u32(&tiff[pos + 8..pos + 12]) as usize;
        if val_offset.checked_add(count)? <= tiff.len() {
            Some((val_offset, count))
        } else {
            None
        }
    };

    let n0 = endian.read_u16(&tiff[ifd0_offset..ifd0_offset + 2]) as usize;
    for i in 0..n0 {
        let pos = ifd0_offset + 2 + i * 12;
        if pos + 12 > tiff.len() {
            return None;
        }
        let tag = endian.read_u16(&tiff[pos..pos + 2]);
        match tag {
            TAG_DATETIME => {
                if let Some((off, cnt)) = find_ascii_value_offset(tiff, pos) {
                    if cnt >= 20 {
                        dt_offset = Some(off);
                    }
                }
            }
            TAG_EXIF_IFD_POINTER => {
                let ft = endian.read_u16(&tiff[pos + 2..pos + 4]);
                if ft == TYPE_LONG {
                    exif_ifd_ptr = Some(endian.read_u32(&tiff[pos + 8..pos + 12]) as usize);
                }
            }
            _ => {}
        }
    }

    let exif_offset = exif_ifd_ptr?;
    if exif_offset + 2 > tiff.len() {
        return None;
    }
    let ne = endian.read_u16(&tiff[exif_offset..exif_offset + 2]) as usize;
    for i in 0..ne {
        let pos = exif_offset + 2 + i * 12;
        if pos + 12 > tiff.len() {
            return None;
        }
        let tag = endian.read_u16(&tiff[pos..pos + 2]);
        match tag {
            TAG_DATETIME_ORIGINAL => {
                if let Some((off, cnt)) = find_ascii_value_offset(tiff, pos) {
                    if cnt >= 20 {
                        dto_offset = Some(off);
                    }
                }
            }
            TAG_CREATE_DATE => {
                if let Some((off, cnt)) = find_ascii_value_offset(tiff, pos) {
                    if cnt >= 20 {
                        cd_offset = Some(off);
                    }
                }
            }
            TAG_OFFSET_TIME => {
                off_loc = find_ascii_value_offset(tiff, pos);
            }
            TAG_OFFSET_TIME_ORIGINAL => {
                off_orig_loc = find_ascii_value_offset(tiff, pos);
            }
            TAG_OFFSET_TIME_DIGITIZED => {
                off_dig_loc = find_ascii_value_offset(tiff, pos);
            }
            _ => {}
        }
    }

    // Require all 3 main date fields AND all 3 offset fields to exist for in-place patching;
    // otherwise rebuild the EXIF block so all 6 fields are guaranteed present and synchronized.
    let (dt_off, dto_off, cd_off) = (dt_offset?, dto_offset?, cd_offset?);
    let (oo_off, oo_cnt) = off_orig_loc?;
    let (od_off, od_cnt) = off_dig_loc?;
    let (o_off, o_cnt) = off_loc?;
    if oo_cnt < 7 || od_cnt < 7 || o_cnt < 7 {
        return None;
    }

    let mut dt_bytes = [0u8; 20];
    dt_bytes[0..19].copy_from_slice(ts.exif_datetime.as_bytes());
    dt_bytes[19] = 0;

    tiff[dt_off..dt_off + 20].copy_from_slice(&dt_bytes);
    tiff[dto_off..dto_off + 20].copy_from_slice(&dt_bytes);
    tiff[cd_off..cd_off + 20].copy_from_slice(&dt_bytes);

    let mut off_bytes = [0u8; 7];
    let ob = ts.exif_offset.as_bytes();
    let copy_len = ob.len().min(6);
    off_bytes[0..copy_len].copy_from_slice(&ob[0..copy_len]);
    off_bytes[copy_len] = 0;

    tiff[oo_off..oo_off + 7].copy_from_slice(&off_bytes);
    tiff[od_off..od_off + 7].copy_from_slice(&off_bytes);
    tiff[o_off..o_off + 7].copy_from_slice(&off_bytes);

    Some(())
}

/// Builds a complete, valid TIFF/EXIF byte buffer preserving all existing IFD0, ExifIFD, and GPSIFD
/// entries from `existing_tiff` (if provided) and setting the 6 synchronized date/offset tags.
pub fn build_or_update_tiff_exif(
    existing_tiff: Option<&[u8]>,
    ts: &ResolvedExifTimestamp,
    override_orientation: Option<u16>,
) -> Vec<u8> {
    if let Some(orig) = existing_tiff {
        if override_orientation.is_none() {
            let mut cloned = orig.to_vec();
            if try_patch_tiff_dates_in_place(&mut cloned, ts).is_some() {
                return cloned;
            }
        }
    }

    let mut ifd0_entries: Vec<RawIfdEntry> = Vec::new();
    let mut exif_entries: Vec<RawIfdEntry> = Vec::new();
    let mut gps_entries: Vec<RawIfdEntry> = Vec::new();
    let mut endian = Endian::Little;

    if let Some(tiff) = existing_tiff {
        if tiff.len() >= 8 {
            if &tiff[0..2] == b"MM" {
                endian = Endian::Big;
            }
            let magic = endian.read_u16(&tiff[2..4]);
            if magic == 42 {
                let ifd0_off = endian.read_u32(&tiff[4..8]) as usize;
                let mut exif_ptr = None;
                let mut gps_ptr = None;

                for entry in extract_raw_ifd_entries(tiff, endian, ifd0_off) {
                    if entry.tag == TAG_EXIF_IFD_POINTER && entry.data.len() == 4 {
                        exif_ptr = Some(endian.read_u32(&entry.data) as usize);
                        continue;
                    }
                    if entry.tag == TAG_GPS_IFD_POINTER && entry.data.len() == 4 {
                        gps_ptr = Some(endian.read_u32(&entry.data) as usize);
                        continue;
                    }
                    // Strip thumbnail IFD pointers or strip offsets from IFD0 when rebuilding standalone APP1
                    if matches!(entry.tag, 0x0111 | 0x0117 | 0x0201 | 0x0202) {
                        continue;
                    }
                    ifd0_entries.push(entry);
                }

                if let Some(ep) = exif_ptr {
                    for entry in extract_raw_ifd_entries(tiff, endian, ep) {
                        if entry.tag == TAG_INTEROP_IFD_POINTER {
                            continue;
                        }
                        exif_entries.push(entry);
                    }
                }

                if let Some(gp) = gps_ptr {
                    gps_entries = extract_raw_ifd_entries(tiff, endian, gp);
                }
            }
        }
    }

    if let Some(orient) = override_orientation {
        upsert_entry(
            &mut ifd0_entries,
            RawIfdEntry {
                tag: TAG_ORIENTATION,
                field_type: TYPE_SHORT,
                count: 1,
                data: endian.write_u16(orient).to_vec(),
            },
        );
    }

    let mut dt_bytes = ts.exif_datetime.as_bytes().to_vec();
    dt_bytes.push(0); // 20 bytes ASCII with NUL
    let dt_count = dt_bytes.len() as u32;

    let mut off_bytes = ts.exif_offset.as_bytes().to_vec();
    off_bytes.push(0); // 7 bytes ASCII with NUL
    let off_count = off_bytes.len() as u32;

    // Synchronize all 6 date/offset tags across IFD0 and ExifIFD
    upsert_entry(
        &mut ifd0_entries,
        RawIfdEntry {
            tag: TAG_DATETIME,
            field_type: TYPE_ASCII,
            count: dt_count,
            data: dt_bytes.clone(),
        },
    );

    // Ensure ExifVersion 0232 is present so all readers parse OffsetTime* tags
    if !exif_entries.iter().any(|e| e.tag == TAG_EXIF_VERSION) {
        upsert_entry(
            &mut exif_entries,
            RawIfdEntry {
                tag: TAG_EXIF_VERSION,
                field_type: TYPE_UNDEFINED,
                count: 4,
                data: b"0232".to_vec(),
            },
        );
    }

    for tag in [TAG_DATETIME_ORIGINAL, TAG_CREATE_DATE] {
        upsert_entry(
            &mut exif_entries,
            RawIfdEntry {
                tag,
                field_type: TYPE_ASCII,
                count: dt_count,
                data: dt_bytes.clone(),
            },
        );
    }

    for tag in [
        TAG_OFFSET_TIME,
        TAG_OFFSET_TIME_ORIGINAL,
        TAG_OFFSET_TIME_DIGITIZED,
    ] {
        upsert_entry(
            &mut exif_entries,
            RawIfdEntry {
                tag,
                field_type: TYPE_ASCII,
                count: off_count,
                data: off_bytes.clone(),
            },
        );
    }

    serialize_tiff_structure(endian, &mut ifd0_entries, &mut exif_entries, &mut gps_entries)
}

/// Carries over camera EXIF metadata from `existing_tiff` without altering dates,
/// optionally normalizing `Orientation` if pixel orientation was already applied.
pub fn rebuild_tiff_preserving_metadata(
    existing_tiff: &[u8],
    override_orientation: Option<u16>,
) -> Option<Vec<u8>> {
    if existing_tiff.len() < 8 {
        return None;
    }
    let mut endian = Endian::Little;
    if &existing_tiff[0..2] == b"MM" {
        endian = Endian::Big;
    } else if &existing_tiff[0..2] != b"II" {
        return None;
    }
    if endian.read_u16(&existing_tiff[2..4]) != 42 {
        return None;
    }
    let ifd0_off = endian.read_u32(&existing_tiff[4..8]) as usize;
    let mut ifd0_entries = Vec::new();
    let mut exif_entries = Vec::new();
    let mut gps_entries = Vec::new();
    let mut exif_ptr = None;
    let mut gps_ptr = None;

    for entry in extract_raw_ifd_entries(existing_tiff, endian, ifd0_off) {
        if entry.tag == TAG_EXIF_IFD_POINTER && entry.data.len() == 4 {
            exif_ptr = Some(endian.read_u32(&entry.data) as usize);
            continue;
        }
        if entry.tag == TAG_GPS_IFD_POINTER && entry.data.len() == 4 {
            gps_ptr = Some(endian.read_u32(&entry.data) as usize);
            continue;
        }
        if matches!(entry.tag, 0x0111 | 0x0117 | 0x0201 | 0x0202) {
            continue;
        }
        ifd0_entries.push(entry);
    }
    if let Some(ep) = exif_ptr {
        for entry in extract_raw_ifd_entries(existing_tiff, endian, ep) {
            if entry.tag == TAG_INTEROP_IFD_POINTER {
                continue;
            }
            exif_entries.push(entry);
        }
    }
    if let Some(gp) = gps_ptr {
        gps_entries = extract_raw_ifd_entries(existing_tiff, endian, gp);
    }
    if ifd0_entries.is_empty() && exif_entries.is_empty() && gps_entries.is_empty() {
        return None;
    }
    if let Some(orient) = override_orientation {
        upsert_entry(
            &mut ifd0_entries,
            RawIfdEntry {
                tag: TAG_ORIENTATION,
                field_type: TYPE_SHORT,
                count: 1,
                data: endian.write_u16(orient).to_vec(),
            },
        );
    }
    Some(serialize_tiff_structure(
        endian,
        &mut ifd0_entries,
        &mut exif_entries,
        &mut gps_entries,
    ))
}

fn extract_raw_ifd_entries(tiff: &[u8], endian: Endian, ifd_offset: usize) -> Vec<RawIfdEntry> {
    let mut out = Vec::new();
    if ifd_offset + 2 > tiff.len() {
        return out;
    }
    let count = endian.read_u16(&tiff[ifd_offset..ifd_offset + 2]) as usize;
    if count > 512 {
        return out;
    }
    for i in 0..count {
        let pos = ifd_offset + 2 + i * 12;
        if pos + 12 > tiff.len() {
            break;
        }
        let tag = endian.read_u16(&tiff[pos..pos + 2]);
        let field_type = endian.read_u16(&tiff[pos + 2..pos + 4]);
        let unit = type_unit_size(field_type);
        if unit == 0 {
            continue;
        }
        let val_count = endian.read_u32(&tiff[pos + 4..pos + 8]);
        let Some(byte_len) = (val_count as usize).checked_mul(unit) else {
            continue;
        };
        if byte_len > 64 * 1024 {
            continue;
        }
        let data = if byte_len <= 4 {
            tiff[pos + 8..pos + 8 + byte_len].to_vec()
        } else {
            let off = endian.read_u32(&tiff[pos + 8..pos + 12]) as usize;
            if off.checked_add(byte_len).map(|end| end <= tiff.len()).unwrap_or(false) {
                tiff[off..off + byte_len].to_vec()
            } else {
                continue;
            }
        };
        out.push(RawIfdEntry {
            tag,
            field_type,
            count: val_count,
            data,
        });
    }
    out
}

fn upsert_entry(entries: &mut Vec<RawIfdEntry>, entry: RawIfdEntry) {
    if let Some(existing) = entries.iter_mut().find(|e| e.tag == entry.tag) {
        *existing = entry;
    } else {
        entries.push(entry);
    }
}

fn serialize_tiff_structure(
    endian: Endian,
    ifd0_entries: &mut Vec<RawIfdEntry>,
    exif_entries: &mut Vec<RawIfdEntry>,
    gps_entries: &mut Vec<RawIfdEntry>,
) -> Vec<u8> {
    let has_exif = !exif_entries.is_empty();
    let has_gps = !gps_entries.is_empty();

    if has_exif {
        upsert_entry(
            ifd0_entries,
            RawIfdEntry {
                tag: TAG_EXIF_IFD_POINTER,
                field_type: TYPE_LONG,
                count: 1,
                data: vec![0, 0, 0, 0], // Placeholder patched below
            },
        );
    }
    if has_gps {
        upsert_entry(
            ifd0_entries,
            RawIfdEntry {
                tag: TAG_GPS_IFD_POINTER,
                field_type: TYPE_LONG,
                count: 1,
                data: vec![0, 0, 0, 0], // Placeholder patched below
            },
        );
    }

    ifd0_entries.sort_by_key(|e| e.tag);
    exif_entries.sort_by_key(|e| e.tag);
    gps_entries.sort_by_key(|e| e.tag);

    let mut buf = Vec::with_capacity(1024);
    match endian {
        Endian::Little => buf.extend_from_slice(b"II"),
        Endian::Big => buf.extend_from_slice(b"MM"),
    }
    buf.extend_from_slice(&endian.write_u16(42));
    buf.extend_from_slice(&endian.write_u32(8)); // IFD0 starts at byte 8

    let ifd0_start = 8usize;
    let ifd0_table_len = 2 + ifd0_entries.len() * 12 + 4;
    let ifd0_data_offset = ifd0_start + ifd0_table_len;
    let mut exif_ptr_field_pos = None;
    let mut gps_ptr_field_pos = None;

    let mut ifd0_table = Vec::with_capacity(ifd0_table_len);
    let mut ifd0_heap = Vec::new();
    ifd0_table.extend_from_slice(&endian.write_u16(ifd0_entries.len() as u16));

    for e in ifd0_entries.iter() {
        ifd0_table.extend_from_slice(&endian.write_u16(e.tag));
        ifd0_table.extend_from_slice(&endian.write_u16(e.field_type));
        ifd0_table.extend_from_slice(&endian.write_u32(e.count));
        if e.tag == TAG_EXIF_IFD_POINTER {
            exif_ptr_field_pos = Some(ifd0_start + ifd0_table.len());
        } else if e.tag == TAG_GPS_IFD_POINTER {
            gps_ptr_field_pos = Some(ifd0_start + ifd0_table.len());
        }
        if e.data.len() <= 4 {
            let mut inline = [0u8; 4];
            inline[0..e.data.len()].copy_from_slice(&e.data);
            ifd0_table.extend_from_slice(&inline);
        } else {
            let off = ifd0_data_offset + ifd0_heap.len();
            ifd0_table.extend_from_slice(&endian.write_u32(off as u32));
            ifd0_heap.extend_from_slice(&e.data);
            if ifd0_heap.len() % 2 != 0 {
                ifd0_heap.push(0);
            }
        }
    }
    ifd0_table.extend_from_slice(&endian.write_u32(0)); // Next IFD = 0
    buf.extend_from_slice(&ifd0_table);
    buf.extend_from_slice(&ifd0_heap);

    if has_exif {
        let exif_start = buf.len();
        if let Some(pos) = exif_ptr_field_pos {
            let bytes = endian.write_u32(exif_start as u32);
            buf[pos..pos + 4].copy_from_slice(&bytes);
        }
        write_sub_ifd(&mut buf, endian, exif_entries);
    }

    if has_gps {
        let gps_start = buf.len();
        if let Some(pos) = gps_ptr_field_pos {
            let bytes = endian.write_u32(gps_start as u32);
            buf[pos..pos + 4].copy_from_slice(&bytes);
        }
        write_sub_ifd(&mut buf, endian, gps_entries);
    }

    buf
}

fn write_sub_ifd(buf: &mut Vec<u8>, endian: Endian, entries: &[RawIfdEntry]) {
    let start = buf.len();
    let table_len = 2 + entries.len() * 12 + 4;
    let data_start = start + table_len;
    let mut table = Vec::with_capacity(table_len);
    let mut heap = Vec::new();

    table.extend_from_slice(&endian.write_u16(entries.len() as u16));
    for e in entries {
        table.extend_from_slice(&endian.write_u16(e.tag));
        table.extend_from_slice(&endian.write_u16(e.field_type));
        table.extend_from_slice(&endian.write_u32(e.count));
        if e.data.len() <= 4 {
            let mut inline = [0u8; 4];
            inline[0..e.data.len()].copy_from_slice(&e.data);
            table.extend_from_slice(&inline);
        } else {
            let off = data_start + heap.len();
            table.extend_from_slice(&endian.write_u32(off as u32));
            heap.extend_from_slice(&e.data);
            if heap.len() % 2 != 0 {
                heap.push(0);
            }
        }
    }
    table.extend_from_slice(&endian.write_u32(0));
    buf.extend_from_slice(&table);
    buf.extend_from_slice(&heap);
}

// ============================================================================
// Metadata-Only Container Writers (JPEG, TIFF, PNG, WebP) + Rollback Safety
// ============================================================================

/// Writes or updates EXIF metadata on `output_path` without decoding or re-encoding image pixels.
/// Uses atomic write + rollback so the output file is never corrupted if an error occurs.
pub fn write_exif_to_output_file(
    output_path: &Path,
    actual_kind: &str,
    source_tiff: Option<&[u8]>,
    target_ts: Option<&ResolvedExifTimestamp>,
    override_orientation: Option<u16>,
) -> Result<(), String> {
    if !is_target_format_exif_supported(actual_kind) {
        return Err("Định dạng đích không hỗ trợ ghi EXIF".to_string());
    }

    // Build the desired TIFF payload
    let existing_output_tiff = extract_tiff_header_from_file(output_path);
    let base_tiff = existing_output_tiff.as_deref().or(source_tiff);

    let new_tiff = if let Some(ts) = target_ts {
        build_or_update_tiff_exif(base_tiff, ts, override_orientation)
    } else if let Some(bt) = base_tiff {
        match rebuild_tiff_preserving_metadata(bt, override_orientation) {
            Some(rebuilt) => rebuilt,
            None => return Ok(()),
        }
    } else {
        return Ok(());
    };

    if new_tiff.len() > 65500 && actual_kind == "jpeg" {
        return Err("Khối EXIF vượt quá giới hạn 64KB của phân đoạn JPEG APP1".to_string());
    }

    match actual_kind {
        "jpeg" | "jpg" => write_exif_to_jpeg_atomic(output_path, &new_tiff),
        "png" => write_exif_to_png_atomic(output_path, &new_tiff),
        "webp" => write_exif_to_webp_atomic(output_path, &new_tiff),
        "tiff" | "tif" => write_exif_to_tiff_atomic(output_path, source_tiff, target_ts),
        other => Err(format!("Không hỗ trợ ghi EXIF cho định dạng: {other}")),
    }
}

fn temp_sibling_path(path: &Path) -> PathBuf {
    let file_name = path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy();
    path.with_file_name(format!(".{file_name}.exif_tmp"))
}

/// Lossless metadata-only JPEG APP1 writer.
/// Preserves all pixel scan data (SOS onwards) and all other APPn segments (e.g. APP2 ICC Color Profile).
fn write_exif_to_jpeg_atomic(jpeg_path: &Path, new_tiff: &[u8]) -> Result<(), String> {
    let bytes = fs::read(jpeg_path).map_err(|e| format!("Không đọc được file JPEG output: {e}"))?;
    if bytes.len() < 4 || bytes[0] != 0xFF || bytes[1] != 0xD8 {
        return Err("File output không phải là JPEG hợp lệ".to_string());
    }

    let app1_payload_len = 2 + 6 + new_tiff.len();
    if app1_payload_len > 0xFFFF {
        return Err("APP1 EXIF vượt quá 65535 bytes".to_string());
    }

    let mut out = Vec::with_capacity(bytes.len() + new_tiff.len() + 16);
    out.extend_from_slice(&[0xFF, 0xD8]); // SOI

    let mut pos = 2usize;
    let mut inserted_exif = false;

    // Inspect segments before SOS (0xFF 0xDA)
    while pos + 4 <= bytes.len() && bytes[pos] == 0xFF {
        let marker = bytes[pos + 1];
        if marker == 0xFF {
            pos += 1;
            continue;
        }
        // Start of Scan or End of Image -> insert APP1 before SOS if not yet inserted, then copy rest verbatim!
        if marker == 0xDA || marker == 0xD9 {
            break;
        }
        if marker == 0xD8 || (0xD0..=0xD7).contains(&marker) || marker == 0x01 {
            out.extend_from_slice(&bytes[pos..pos + 2]);
            pos += 2;
            continue;
        }
        let seg_len = u16::from_be_bytes([bytes[pos + 2], bytes[pos + 3]]) as usize;
        if seg_len < 2 || pos + 2 + seg_len > bytes.len() {
            break;
        }
        let seg_end = pos + 2 + seg_len;
        let is_exif_app1 = marker == 0xE1
            && seg_len >= 8
            && &bytes[pos + 4..pos + 10] == b"Exif\0\0";

        if is_exif_app1 {
            if !inserted_exif {
                write_jpeg_app1_segment(&mut out, new_tiff);
                inserted_exif = true;
            }
            // Skip old Exif APP1 segment
        } else {
            out.extend_from_slice(&bytes[pos..seg_end]);
            // If this was APP0 (JFIF), insert APP1 right after APP0
            if marker == 0xE0 && !inserted_exif {
                write_jpeg_app1_segment(&mut out, new_tiff);
                inserted_exif = true;
            }
        }
        pos = seg_end;
    }

    if !inserted_exif {
        write_jpeg_app1_segment(&mut out, new_tiff);
    }

    // Copy all remaining segments and compressed pixel scan stream byte-for-byte untouched
    out.extend_from_slice(&bytes[pos..]);

    atomic_replace_file(jpeg_path, &out)
}

fn write_jpeg_app1_segment(out: &mut Vec<u8>, tiff: &[u8]) {
    let seg_len = (2 + 6 + tiff.len()) as u16;
    out.extend_from_slice(&[0xFF, 0xE1]);
    out.extend_from_slice(&seg_len.to_be_bytes());
    out.extend_from_slice(b"Exif\0\0");
    out.extend_from_slice(tiff);
}

/// Copies APP2 (ICC Color Profile) segments from `src_jpeg` into `dst_jpeg` if `dst_jpeg` lacks one.
pub fn preserve_jpeg_icc_profile(src_path: &Path, dst_jpeg_path: &Path) {
    let Ok(mut f) = File::open(src_path) else { return };
    let mut src_head = vec![0u8; 128 * 1024];
    let Ok(n) = f.read(&mut src_head) else { return };
    src_head.truncate(n);
    if src_head.len() < 4 || src_head[0] != 0xFF || src_head[1] != 0xD8 {
        return;
    }

    let mut icc_segments: Vec<Vec<u8>> = Vec::new();
    let mut pos = 2usize;
    while pos + 4 <= src_head.len() && src_head[pos] == 0xFF {
        let marker = src_head[pos + 1];
        if marker == 0xDA || marker == 0xD9 {
            break;
        }
        let seg_len = u16::from_be_bytes([src_head[pos + 2], src_head[pos + 3]]) as usize;
        if seg_len < 2 || pos + 2 + seg_len > src_head.len() {
            break;
        }
        if marker == 0xE2 && seg_len >= 16 && &src_head[pos + 4..pos + 16] == b"ICC_PROFILE\0" {
            icc_segments.push(src_head[pos..pos + 2 + seg_len].to_vec());
        }
        pos += 2 + seg_len;
    }

    if icc_segments.is_empty() {
        return;
    }

    let Ok(dst_bytes) = fs::read(dst_jpeg_path) else { return };
    if dst_bytes.len() < 4 || dst_bytes[0] != 0xFF || dst_bytes[1] != 0xD8 {
        return;
    }
    // Check if dst already has ICC_PROFILE
    if dst_bytes.windows(12).take(65536).any(|w| w == b"ICC_PROFILE\0") {
        return;
    }
    let mut out = Vec::with_capacity(dst_bytes.len() + 4096);
    out.extend_from_slice(&dst_bytes[0..2]);
    for seg in icc_segments {
        out.extend_from_slice(&seg);
    }
    out.extend_from_slice(&dst_bytes[2..]);
    let _ = atomic_replace_file(dst_jpeg_path, &out);
}

/// Lossless metadata-only PNG `eXIf` chunk writer.
/// Computes IEEE 802.3 CRC32 and injects/updates the `eXIf` chunk before `IDAT` without touching pixels.
fn write_exif_to_png_atomic(png_path: &Path, new_tiff: &[u8]) -> Result<(), String> {
    let bytes = fs::read(png_path).map_err(|e| format!("Không đọc được file PNG output: {e}"))?;
    if bytes.len() < 8 || &bytes[0..8] != b"\x89PNG\r\n\x1a\n" {
        return Err("File output không phải là PNG hợp lệ".to_string());
    }

    let mut out = Vec::with_capacity(bytes.len() + new_tiff.len() + 16);
    out.extend_from_slice(&bytes[0..8]);

    let mut pos = 8usize;
    let mut inserted_exif = false;

    while pos + 8 <= bytes.len() {
        let length = u32::from_be_bytes([bytes[pos], bytes[pos + 1], bytes[pos + 2], bytes[pos + 3]]) as usize;
        let ctype = &bytes[pos + 4..pos + 8];
        let chunk_end = pos + 8 + length + 4;
        if chunk_end > bytes.len() {
            break;
        }

        if ctype == b"eXIf" {
            // Skip old eXIf chunk
            pos = chunk_end;
            continue;
        }

        if ctype == b"IDAT" && !inserted_exif {
            write_png_chunk(&mut out, b"eXIf", new_tiff);
            inserted_exif = true;
        }

        out.extend_from_slice(&bytes[pos..chunk_end]);
        pos = chunk_end;
    }

    atomic_replace_file(png_path, &out)
}

fn write_png_chunk(out: &mut Vec<u8>, chunk_type: &[u8; 4], data: &[u8]) {
    let len = data.len() as u32;
    out.extend_from_slice(&len.to_be_bytes());
    out.extend_from_slice(chunk_type);
    out.extend_from_slice(data);
    let crc = crc32_ieee(chunk_type, data);
    out.extend_from_slice(&crc.to_be_bytes());
}

fn crc32_ieee(chunk_type: &[u8; 4], data: &[u8]) -> u32 {
    let mut crc: u32 = 0xFFFF_FFFF;
    for &b in chunk_type.iter().chain(data.iter()) {
        crc ^= b as u32;
        for _ in 0..8 {
            if crc & 1 != 0 {
                crc = (crc >> 1) ^ 0xEDB8_8320;
            } else {
                crc >>= 1;
            }
        }
    }
    !crc
}

/// Lossless metadata-only WebP `EXIF` chunk writer.
/// Handles both Simple WebP (`VP8 `/`VP8L` -> upgrades to `VP8X` extended container) and Extended WebP (`VP8X`).
fn write_exif_to_webp_atomic(webp_path: &Path, new_tiff: &[u8]) -> Result<(), String> {
    let bytes = fs::read(webp_path).map_err(|e| format!("Không đọc được file WebP output: {e}"))?;
    if bytes.len() < 20 || &bytes[0..4] != b"RIFF" || &bytes[8..12] != b"WEBP" {
        return Err("File output không phải là WebP hợp lệ".to_string());
    }

    let mut body_chunks: Vec<([u8; 4], Vec<u8>)> = Vec::new();
    let mut vp8x_payload: Option<Vec<u8>> = None;
    let mut canvas_wh: Option<(u32, u32)> = None;

    let mut pos = 12usize;
    while pos + 8 <= bytes.len() {
        let mut fourcc = [0u8; 4];
        fourcc.copy_from_slice(&bytes[pos..pos + 4]);
        let size = u32::from_le_bytes([bytes[pos + 4], bytes[pos + 5], bytes[pos + 6], bytes[pos + 7]]) as usize;
        let data_start = pos + 8;
        let data_end = data_start + size;
        if data_end > bytes.len() {
            break;
        }
        let chunk_data = &bytes[data_start..data_end];

        if &fourcc == b"VP8X" && chunk_data.len() >= 10 {
            vp8x_payload = Some(chunk_data.to_vec());
        } else if &fourcc == b"EXIF" {
            // Skip old EXIF chunk
        } else {
            if canvas_wh.is_none() {
                if &fourcc == b"VP8L" && chunk_data.len() >= 5 && chunk_data[0] == 0x2F {
                    let bits = u32::from_le_bytes([
                        chunk_data[1],
                        chunk_data[2],
                        chunk_data[3],
                        chunk_data[4],
                    ]);
                    let w = (bits & 0x3FFF) + 1;
                    let h = ((bits >> 14) & 0x3FFF) + 1;
                    canvas_wh = Some((w, h));
                } else if &fourcc == b"VP8 " && chunk_data.len() >= 10 {
                    // Keyframe start code 0x9D 0x01 0x2A at offset 3..6
                    if chunk_data[3] == 0x9D && chunk_data[4] == 0x01 && chunk_data[5] == 0x2A {
                        let w = (u16::from_le_bytes([chunk_data[6], chunk_data[7]]) & 0x3FFF) as u32;
                        let h = (u16::from_le_bytes([chunk_data[8], chunk_data[9]]) & 0x3FFF) as u32;
                        canvas_wh = Some((w, h));
                    }
                }
            }
            body_chunks.push((fourcc, chunk_data.to_vec()));
        }

        pos = data_end + (size & 1);
    }

    let mut vp8x = match vp8x_payload {
        Some(mut p) => {
            p[0] |= 0x08; // Set EXIF flag bit (bit 3)
            p
        }
        None => {
            let (w, h) = canvas_wh.unwrap_or((1, 1));
            let w_minus_1 = w.saturating_sub(1);
            let h_minus_1 = h.saturating_sub(1);
            let mut p = vec![0u8; 10];
            p[0] = 0x08; // EXIF flag bit
            p[4] = (w_minus_1 & 0xFF) as u8;
            p[5] = ((w_minus_1 >> 8) & 0xFF) as u8;
            p[6] = ((w_minus_1 >> 16) & 0xFF) as u8;
            p[7] = (h_minus_1 & 0xFF) as u8;
            p[8] = ((h_minus_1 >> 8) & 0xFF) as u8;
            p[9] = ((h_minus_1 >> 16) & 0xFF) as u8;
            p
        }
    };
    vp8x.truncate(10);

    let mut riff_body = Vec::with_capacity(bytes.len() + new_tiff.len() + 32);
    riff_body.extend_from_slice(b"WEBP");
    write_riff_chunk(&mut riff_body, b"VP8X", &vp8x);
    for (fourcc, data) in &body_chunks {
        write_riff_chunk(&mut riff_body, fourcc, data);
    }
    write_riff_chunk(&mut riff_body, b"EXIF", new_tiff);

    let mut out = Vec::with_capacity(8 + riff_body.len());
    out.extend_from_slice(b"RIFF");
    out.extend_from_slice(&(riff_body.len() as u32).to_le_bytes());
    out.extend_from_slice(&riff_body);

    atomic_replace_file(webp_path, &out)
}

fn write_riff_chunk(out: &mut Vec<u8>, fourcc: &[u8; 4], data: &[u8]) {
    out.extend_from_slice(fourcc);
    out.extend_from_slice(&(data.len() as u32).to_le_bytes());
    out.extend_from_slice(data);
    if data.len() % 2 != 0 {
        out.push(0);
    }
}

/// Lossless metadata-only TIFF writer.
/// Appends updated IFD0 + ExifIFD to the end of the TIFF file and updates the IFD0 offset at bytes 4..8,
/// keeping all existing StripOffsets / TileOffsets and image pixel bytes 100% untouched!
fn write_exif_to_tiff_atomic(
    tiff_path: &Path,
    source_tiff: Option<&[u8]>,
    target_ts: Option<&ResolvedExifTimestamp>,
) -> Result<(), String> {
    let mut bytes = fs::read(tiff_path).map_err(|e| format!("Không đọc được file TIFF output: {e}"))?;
    if bytes.len() < 8 {
        return Err("File output không phải là TIFF hợp lệ".to_string());
    }
    let endian = if &bytes[0..2] == b"II" {
        Endian::Little
    } else if &bytes[0..2] == b"MM" {
        Endian::Big
    } else {
        return Err("Header endian của TIFF không hợp lệ".to_string());
    };
    if endian.read_u16(&bytes[2..4]) != 42 {
        return Err("Magic number của TIFF không hợp lệ".to_string());
    }

    // Fast path: if no source_tiff needs merging and all 6 date/offset tags already exist in the TIFF, patch in-place!
    if source_tiff.is_none() {
        if let Some(ts) = target_ts {
            if try_patch_tiff_dates_in_place(&mut bytes, ts).is_some() {
                return atomic_replace_file(tiff_path, &bytes);
            }
        } else {
            return Ok(());
        }
    }

    // Read all existing IFD0 entries (including StripOffsets, ImageWidth, etc.) and ExifIFD entries,
    // merge camera metadata from `source_tiff` (if present), append updated IFD0 + ExifIFD at EOF,
    // and update the 4-byte IFD0 pointer at bytes[4..8]!
    let old_ifd0_off = endian.read_u32(&bytes[4..8]) as usize;
    if old_ifd0_off + 2 > bytes.len() {
        return Err("IFD0 offset của TIFF vượt quá kích thước file".to_string());
    }

    let entry_count = endian.read_u16(&bytes[old_ifd0_off..old_ifd0_off + 2]) as usize;
    if old_ifd0_off + 2 + entry_count * 12 + 4 > bytes.len() {
        return Err("Bảng IFD0 của TIFF không đầy đủ".to_string());
    }
    let next_ifd_ptr = endian.read_u32(
        &bytes[old_ifd0_off + 2 + entry_count * 12..old_ifd0_off + 2 + entry_count * 12 + 4],
    );

    let mut raw_records: Vec<(u16, [u8; 12])> = Vec::with_capacity(entry_count + 6);
    let mut old_exif_ifd_off: Option<usize> = None;

    for i in 0..entry_count {
        let pos = old_ifd0_off + 2 + i * 12;
        let tag = endian.read_u16(&bytes[pos..pos + 2]);
        let ft = endian.read_u16(&bytes[pos + 2..pos + 4]);
        if tag == TAG_EXIF_IFD_POINTER && ft == TYPE_LONG {
            old_exif_ifd_off = Some(endian.read_u32(&bytes[pos + 8..pos + 12]) as usize);
            continue;
        }
        if tag == TAG_DATETIME && target_ts.is_some() {
            continue;
        }
        let mut rec = [0u8; 12];
        rec.copy_from_slice(&bytes[pos..pos + 12]);
        raw_records.push((tag, rec));
    }

    let mut exif_entries = if let Some(ep) = old_exif_ifd_off {
        extract_raw_ifd_entries(&bytes, endian, ep)
    } else {
        Vec::new()
    };

    let mut extra_ifd0_entries: Vec<RawIfdEntry> = Vec::new();
    if let Some(src) = source_tiff {
        if src.len() >= 8 {
            let src_endian = if &src[0..2] == b"MM" { Endian::Big } else { Endian::Little };
            if src_endian.read_u16(&src[2..4]) == 42 {
                let src_ifd0 = src_endian.read_u32(&src[4..8]) as usize;
                let mut src_exif_ptr = None;
                for entry in extract_raw_ifd_entries(src, src_endian, src_ifd0) {
                    if entry.tag == TAG_EXIF_IFD_POINTER && entry.data.len() == 4 {
                        src_exif_ptr = Some(src_endian.read_u32(&entry.data) as usize);
                        continue;
                    }
                    // Carry over camera Make, Model, Rating, Artist, Copyright, DateTime if not already in TIFF
                    if matches!(entry.tag, TAG_MAKE | TAG_MODEL | TAG_RATING | 0x013B | 0x8298 | TAG_DATETIME) {
                        if !(entry.tag == TAG_DATETIME && target_ts.is_some())
                            && !raw_records.iter().any(|(t, _)| *t == entry.tag)
                        {
                            extra_ifd0_entries.push(entry);
                        }
                    }
                }
                if let Some(sep) = src_exif_ptr {
                    for entry in extract_raw_ifd_entries(src, src_endian, sep) {
                        if entry.tag == TAG_INTEROP_IFD_POINTER {
                            continue;
                        }
                        if !exif_entries.iter().any(|e| e.tag == entry.tag) {
                            exif_entries.push(entry);
                        }
                    }
                }
            }
        }
    }

    if let Some(ts) = target_ts {
        let mut dt_bytes = ts.exif_datetime.as_bytes().to_vec();
        dt_bytes.push(0); // 20 bytes
        let mut off_bytes = ts.exif_offset.as_bytes().to_vec();
        off_bytes.push(0); // 7 bytes

        upsert_entry(
            &mut extra_ifd0_entries,
            RawIfdEntry {
                tag: TAG_DATETIME,
                field_type: TYPE_ASCII,
                count: dt_bytes.len() as u32,
                data: dt_bytes.clone(),
            },
        );

        if !exif_entries.iter().any(|e| e.tag == TAG_EXIF_VERSION) {
            upsert_entry(
                &mut exif_entries,
                RawIfdEntry {
                    tag: TAG_EXIF_VERSION,
                    field_type: TYPE_UNDEFINED,
                    count: 4,
                    data: b"0232".to_vec(),
                },
            );
        }
        for tag in [TAG_DATETIME_ORIGINAL, TAG_CREATE_DATE] {
            upsert_entry(
                &mut exif_entries,
                RawIfdEntry {
                    tag,
                    field_type: TYPE_ASCII,
                    count: dt_bytes.len() as u32,
                    data: dt_bytes.clone(),
                },
            );
        }
        for tag in [
            TAG_OFFSET_TIME,
            TAG_OFFSET_TIME_ORIGINAL,
            TAG_OFFSET_TIME_DIGITIZED,
        ] {
            upsert_entry(
                &mut exif_entries,
                RawIfdEntry {
                    tag,
                    field_type: TYPE_ASCII,
                    count: off_bytes.len() as u32,
                    data: off_bytes.clone(),
                },
            );
        }
    }

    exif_entries.sort_by_key(|e| e.tag);

    // Align end of file to 2-byte boundary
    if bytes.len() % 2 != 0 {
        bytes.push(0);
    }

    // 1. Append extra IFD0 entry values (Make, Model, DateTime, etc.)
    for entry in extra_ifd0_entries {
        let mut rec = [0u8; 12];
        rec[0..2].copy_from_slice(&endian.write_u16(entry.tag));
        rec[2..4].copy_from_slice(&endian.write_u16(entry.field_type));
        rec[4..8].copy_from_slice(&endian.write_u32(entry.count));
        if entry.data.len() <= 4 {
            rec[8..8 + entry.data.len()].copy_from_slice(&entry.data);
        } else {
            if bytes.len() % 2 != 0 {
                bytes.push(0);
            }
            let val_off = bytes.len() as u32;
            bytes.extend_from_slice(&entry.data);
            rec[8..12].copy_from_slice(&endian.write_u32(val_off));
        }
        raw_records.retain(|(t, _)| *t != entry.tag);
        raw_records.push((entry.tag, rec));
    }

    // 2. Append ExifIFD if non-empty
    if !exif_entries.is_empty() {
        if bytes.len() % 2 != 0 {
            bytes.push(0);
        }
        let new_exif_ifd_offset = bytes.len() as u32;
        write_sub_ifd(&mut bytes, endian, &exif_entries);

        let mut exif_ptr_rec = [0u8; 12];
        exif_ptr_rec[0..2].copy_from_slice(&endian.write_u16(TAG_EXIF_IFD_POINTER));
        exif_ptr_rec[2..4].copy_from_slice(&endian.write_u16(TYPE_LONG));
        exif_ptr_rec[4..8].copy_from_slice(&endian.write_u32(1));
        exif_ptr_rec[8..12].copy_from_slice(&endian.write_u32(new_exif_ifd_offset));
        raw_records.push((TAG_EXIF_IFD_POINTER, exif_ptr_rec));
    }

    raw_records.sort_by_key(|(tag, _)| *tag);

    // 3. Append new IFD0 table and update bytes[4..8]
    if bytes.len() % 2 != 0 {
        bytes.push(0);
    }
    let new_ifd0_offset = bytes.len() as u32;
    bytes.extend_from_slice(&endian.write_u16(raw_records.len() as u16));
    for (_, rec) in &raw_records {
        bytes.extend_from_slice(rec);
    }
    bytes.extend_from_slice(&endian.write_u32(next_ifd_ptr));

    let root_ptr = endian.write_u32(new_ifd0_offset);
    bytes[4..8].copy_from_slice(&root_ptr);

    atomic_replace_file(tiff_path, &bytes)
}

fn atomic_replace_file(target_path: &Path, new_bytes: &[u8]) -> Result<(), String> {
    let tmp = temp_sibling_path(target_path);
    {
        let mut f = File::create(&tmp).map_err(|e| format!("Không thể tạo file tạm metadata: {e}"))?;
        if let Err(e) = f.write_all(new_bytes).and_then(|()| f.flush()) {
            drop(f);
            let _ = fs::remove_file(&tmp);
            return Err(format!("Lỗi ghi dữ liệu metadata: {e}"));
        }
    }
    if let Err(e) = fs::rename(&tmp, target_path) {
        let _ = fs::remove_file(&tmp);
        return Err(format!("Không thể cập nhật file output: {e}"));
    }
    Ok(())
}

/// Fast post-write verification: reads only the output file's container header (never decoding pixels)
/// and verifies that `DateTimeOriginal`, `CreateDate`, and `ModifyDate` match `expected_ts`.
pub fn verify_output_exif_dates(
    output_path: &Path,
    expected_ts: &ResolvedExifTimestamp,
) -> Result<ParsedExifInfo, String> {
    let tiff = extract_tiff_header_from_file(output_path)
        .ok_or_else(|| "Không tìm thấy phân đoạn EXIF sau khi ghi".to_string())?;
    let info = parse_tiff_exif(&tiff);
    let expected = expected_ts.exif_datetime.as_str();

    if info.date_time_original.as_deref() != Some(expected) {
        return Err(format!(
            "Xác thực DateTimeOriginal thất bại: kỳ vọng '{}', thực tế '{:?}'",
            expected, info.date_time_original
        ));
    }
    if info.create_date.as_deref() != Some(expected) {
        return Err(format!(
            "Xác thực CreateDate thất bại: kỳ vọng '{}', thực tế '{:?}'",
            expected, info.create_date
        ));
    }
    if info.modify_date.as_deref() != Some(expected) {
        return Err(format!(
            "Xác thực ModifyDate thất bại: kỳ vọng '{}', thực tế '{:?}'",
            expected, info.modify_date
        ));
    }
    Ok(info)
}

// ============================================================================
// High-Performance Parallel Batch Metadata Scanner (Section 3, 11, 16)
// ============================================================================

pub fn scan_files_metadata_batch(
    files: &[PathBuf],
    target_kind: &str,
    export_jpg_2048: bool,
    raw_extensions: &[&str],
    options: &ExifCorrectionOptions,
) -> (Vec<FileMetadataAnalysis>, ExifScanSummary) {
    let start = Instant::now();

    let analyses: Vec<FileMetadataAnalysis> = files
        .par_iter()
        .map(|path| {
            let ext = path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();
            let is_raw = raw_extensions.contains(&ext.as_str());
            let actual_kind = if export_jpg_2048 && is_raw {
                "jpeg"
            } else {
                target_kind
            };
            analyze_file_metadata(path, actual_kind, options.min_reasonable_year)
        })
        .collect();

    let mut summary = ExifScanSummary {
        total_files: analyses.len(),
        ..Default::default()
    };

    for item in &analyses {
        match item.category {
            ExifStatusCategory::Valid => summary.valid_count += 1,
            ExifStatusCategory::Abnormal => summary.abnormal_count += 1,
            ExifStatusCategory::Missing => summary.missing_count += 1,
            ExifStatusCategory::Unknown => summary.unknown_count += 1,
        }
        if !item.target_supported {
            summary.unsupported_count += 1;
        } else if should_fix_file_metadata(item, options) {
            summary.fixable_count += 1;
        }
        if summary.sample_items.len() < 50 && item.category != ExifStatusCategory::Valid {
            summary.sample_items.push(item.clone());
        }
    }

    summary.scan_duration_ms = start.elapsed().as_millis() as u64;
    (analyses, summary)
}
