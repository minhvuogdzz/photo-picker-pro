fn main() {
    #[cfg(target_os = "macos")]
    {
        cc::Build::new()
            .file("src/dock_icon.m")
            .flag("-fobjc-arc")
            .compile("dock_icon");
    }

    tauri_build::build()
}
