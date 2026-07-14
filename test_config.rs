use std::path::PathBuf;

fn find_child_dir(parent: &PathBuf, search: &str) -> Option<PathBuf> {
    let search_lower = search.to_lowercase().replace(" ", "");
    println!("Searching for '{}' in {:?}", search_lower, parent);
    if let Ok(entries) = std::fs::read_dir(parent) {
        for entry in entries.filter_map(|e| e.ok()) {
            if entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
                let name = entry.file_name().to_string_lossy().to_lowercase().replace(" ", "");
                println!("Found dir: '{}'", name);
                if name.contains(&search_lower) {
                    return Some(entry.path());
                }
            }
        }
    } else {
        println!("Failed to read_dir {:?}", parent);
    }
    None
}

fn main() {
    let base = PathBuf::from("/Users/http_minhvuoqdev/Library/CloudStorage/GoogleDrive-pinkaskyart03@gmail.com/.shortcut-targets-by-id/1wmPRksbQLAUMq5SnBi7TazBZ7ax5WuYI");
    
    let mut current = base;
    if let Some(p) = find_child_dir(&current, "photoshop") {
        current = p;
        println!("Matched photoshop: {:?}", current);
    } else {
        println!("Failed to match photoshop");
        return;
    }

    if let Some(p) = find_child_dir(&current, "nhcho") {
        current = p;
        println!("Matched nhcho: {:?}", current);
    } else {
        println!("Failed to match nhcho");
        return;
    }

    if let Some(p) = find_child_dir(&current, "nhto") {
        current = p;
        println!("Matched nhto: {:?}", current);
    } else {
        println!("Failed to match nhto");
        return;
    }
}
