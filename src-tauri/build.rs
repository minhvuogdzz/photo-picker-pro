fn main() {
    #[cfg(target_os = "macos")]
    {
        println!("cargo:rerun-if-changed=src/dock_icon.m");
        println!("cargo:rustc-link-lib=framework=UserNotifications");
        println!("cargo:rustc-link-lib=framework=Cocoa");
        cc::Build::new()
            .file("src/dock_icon.m")
            .flag("-fobjc-arc")
            .flag("-Wno-unguarded-availability-new")
            .flag("-Wno-deprecated-declarations")
            .compile("dock_icon");
    }

    tauri_build::build()
}
