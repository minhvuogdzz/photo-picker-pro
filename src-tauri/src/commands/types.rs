use serde::{Deserialize, Serialize};

/// Represents a photo file discovered during scanning
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhotoFile {
    pub full_path: String,
    pub filename: String,
    pub extension: String,
    pub folder: String,
    pub size: u64,
    /// The numeric portion extracted from the filename for matching
    pub normalized_number: String,
}

/// A customer code parsed from user input
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomerCode {
    pub raw: String,
    pub normalized: String,
}

/// Options for scanning folders
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanOptions {
    pub filter_raw: bool,
    pub filter_jpg: bool,
    pub recursive: bool,
}

/// The matching mode to use when comparing codes to filenames
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MatchMode {
    ExactNumber,
    Contains,
    Regex,
}

/// The status of a matched photo
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum MatchStatus {
    Found,
    Missing,
    Duplicate,
}

/// A matched photo result linking a customer code to a photo file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchedPhoto {
    pub code: String,
    pub photo: Option<PhotoFile>,
    pub status: MatchStatus,
    pub all_matches: Vec<PhotoFile>,
}

/// Result of matching operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchResult {
    pub matches: Vec<MatchedPhoto>,
    pub found_count: usize,
    pub missing_count: usize,
    pub duplicate_count: usize,
    pub total_codes: usize,
}

/// Policy for handling duplicate matches
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DuplicatePolicy {
    CopyFirst,
    CopyAll,
    RenameAutomatically,
    Skip,
}

/// How the output folder structure should be organized
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FolderStructure {
    Flat,
    Preserve,
}

/// The file operation to perform
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FileOperation {
    Copy,
    Move,
    HardLink,
    SymbolicLink,
}

/// How the output destination is determined
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum OutputMode {
    Folder,
    SameAsOriginal,
    Studio,
}

/// Options for the copy/move operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CopyOptions {
    pub operation: FileOperation,
    pub output_mode: OutputMode,
    pub output_folder: String,
    pub duplicate_policy: DuplicatePolicy,
    pub folder_structure: FolderStructure,
    pub prefix: Option<String>,
    pub suffix: Option<String>,
    /// Base input folder paths for relative path computation when preserving structure
    pub input_folders: Vec<String>,
}

/// Progress event sent from Rust to the frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressEvent {
    pub current: usize,
    pub total: usize,
    pub percentage: f64,
    pub message: String,
    pub eta_seconds: Option<f64>,
    pub speed: Option<String>,
}

/// Result of a copy/move operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CopyResult {
    pub success_count: usize,
    pub error_count: usize,
    pub skipped_count: usize,
    pub errors: Vec<String>,
}

/// Scan result returned to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub files: Vec<PhotoFile>,
    pub total_files: usize,
    pub total_folders: usize,
    pub elapsed_ms: u64,
}

/// Export format for logs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ExportFormat {
    Txt,
    Csv,
    Json,
}

/// Application settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub theme: String,
    pub language: String,
    pub default_match_mode: String,
    pub default_output: String,
    pub default_duplicate_policy: String,
    pub default_preserve_folder: bool,
    pub favorite_folders: Vec<String>,
    pub auto_check_updates: bool,
    pub auto_download_updates: bool,
    pub install_on_exit: bool,
    pub beta_channel: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: "dark".to_string(),
            language: "vi".to_string(),
            default_match_mode: "ExactNumber".to_string(),
            default_output: String::new(),
            default_duplicate_policy: "CopyFirst".to_string(),
            default_preserve_folder: false,
            favorite_folders: Vec::new(),
            auto_check_updates: true,
            auto_download_updates: true,
            install_on_exit: true,
            beta_channel: false,
        }
    }
}

/// A history entry recording a past operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub id: String,
    pub timestamp: String,
    pub input_folders: Vec<String>,
    pub output_folder: String,
    pub codes_count: usize,
    pub found_count: usize,
    pub missing_count: usize,
    pub operation: String,
}
