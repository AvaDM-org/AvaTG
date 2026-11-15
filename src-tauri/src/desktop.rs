//! Desktop integration that installers don't cover.
//!
//! - The AppImage has no installer, so on Linux it can add itself to the applications menu (a `.desktop` file
//!   and an icon in `~/.local/share`). Nothing is created unless the user asks for it.
//! - Self-repair at startup: an applications-menu entry or login item that points at an old location (a moved
//!   or renamed AppImage, a reinstall elsewhere) is rewritten for this copy. The login item is written by
//!   tauri-plugin-autostart, which already uses `$APPIMAGE` rather than the temporary mount.

use tauri::AppHandle;
use tauri_plugin_autostart::ManagerExt;

/// Rewrite the entries that exist so they start this copy of AvaTG. Never creates one.
pub fn repair(app: &AppHandle) {
    let autolaunch = app.autolaunch();
    if autolaunch.is_enabled().unwrap_or(false) {
        let _ = autolaunch.enable(); // writes the current path
    }
    #[cfg(target_os = "linux")]
    linux::repair_menu_entry();
}

#[derive(serde::Serialize)]
pub struct MenuEntry {
    /// false: not offered (not an AppImage, or not Linux); packages install their own entry
    available: bool,
    installed: bool,
}

#[tauri::command]
pub fn menu_entry_status() -> MenuEntry {
    #[cfg(target_os = "linux")]
    return MenuEntry {
        available: linux::appimage().is_some(),
        installed: linux::entry_path().is_some_and(|p| p.exists()),
    };
    #[cfg(not(target_os = "linux"))]
    MenuEntry {
        available: false,
        installed: false,
    }
}

#[tauri::command]
pub fn menu_entry_set(enabled: bool) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    return if enabled {
        linux::install()
    } else {
        linux::uninstall()
    };
    #[cfg(not(target_os = "linux"))]
    {
        let _ = enabled;
        Err("Only the Linux AppImage adds itself to the applications menu".into())
    }
}

/// Opens a file, folder or link with the user's default app. Unlike the opener plugin, the app is started
/// with the user's own environment when AvaTG runs as an AppImage (see `hostenv`).
#[tauri::command]
pub fn open_external(target: String) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    if crate::hostenv::in_appimage() {
        use crate::hostenv::HostEnv;
        use std::process::Stdio;
        for mut cmd in open::commands(&target) {
            cmd.host_env()
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null());
            if let Ok(mut child) = cmd.spawn() {
                // xdg-open may wait for the app; reap it without holding up the caller.
                std::thread::spawn(move || child.wait());
                return Ok(());
            }
        }
        return Err(format!("No program found to open {target}"));
    }
    open::that_detached(&target).map_err(|e| format!("Could not open {target}: {e}"))
}

#[cfg(target_os = "linux")]
mod linux {
    use crate::hostenv::HostEnv;
    use std::path::PathBuf;

    const ID: &str = "org.avadm.avatg";
    const ICON: &[u8] = include_bytes!("../icons/128x128@2x.png");

    /// The AppImage file this process runs from (not its temporary mount).
    pub fn appimage() -> Option<PathBuf> {
        std::env::var_os("APPIMAGE")
            .map(PathBuf::from)
            .filter(|p| p.is_file())
    }

    fn data_dir() -> Option<PathBuf> {
        std::env::var_os("XDG_DATA_HOME")
            .map(PathBuf::from)
            .filter(|p| p.is_absolute())
            .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".local/share")))
    }

    pub fn entry_path() -> Option<PathBuf> {
        Some(
            data_dir()?
                .join("applications")
                .join(format!("{ID}.desktop")),
        )
    }

    fn icon_path() -> Option<PathBuf> {
        Some(data_dir()?.join(format!("icons/hicolor/256x256/apps/{ID}.png")))
    }

    /// The `.desktop` text for an AppImage at `exe`. Exec quotes the path (spaces) as the spec asks.
    pub fn entry_text(exe: &str) -> String {
        let quoted = exe
            .replace('\\', "\\\\")
            .replace('"', "\\\"")
            .replace('`', "\\`")
            .replace('$', "\\$");
        format!(
            "[Desktop Entry]\n\
             Type=Application\n\
             Name=AvaTG\n\
             GenericName=Video downloader\n\
             Comment=Download videos and audio from YouTube and other sites\n\
             Exec=\"{quoted}\"\n\
             Icon={ID}\n\
             Terminal=false\n\
             Categories=Network;AudioVideo;\n"
        )
    }

    pub fn install() -> Result<(), String> {
        let exe = appimage().ok_or("AvaTG is not running as an AppImage")?;
        let (entry, icon) = (
            entry_path().ok_or("No home folder")?,
            icon_path().ok_or("No home folder")?,
        );
        for dir in [entry.parent(), icon.parent()].into_iter().flatten() {
            std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
        }
        std::fs::write(&icon, ICON).map_err(|e| e.to_string())?;
        std::fs::write(&entry, entry_text(&exe.to_string_lossy())).map_err(|e| e.to_string())?;
        refresh_menu(&entry);
        Ok(())
    }

    pub fn uninstall() -> Result<(), String> {
        for p in [entry_path(), icon_path()].into_iter().flatten() {
            match std::fs::remove_file(&p) {
                Ok(()) => {}
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
                Err(e) => return Err(e.to_string()),
            }
        }
        if let Some(entry) = entry_path() {
            refresh_menu(&entry);
        }
        Ok(())
    }

    /// The entry exists but starts another file: point it at this AppImage.
    pub fn repair_menu_entry() {
        let (Some(exe), Some(entry)) = (appimage(), entry_path()) else {
            return;
        };
        let Ok(text) = std::fs::read_to_string(&entry) else {
            return;
        };
        if text != entry_text(&exe.to_string_lossy()) {
            let _ = install();
        }
    }

    /// Ask the desktop to re-read the menu. Optional: most desktops watch the folder anyway.
    fn refresh_menu(entry: &std::path::Path) {
        if let Some(dir) = entry.parent() {
            let _ = std::process::Command::new("update-desktop-database")
                .host_env()
                .arg(dir)
                .output();
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn quotes_the_appimage_path() {
            let text = entry_text("/home/me/Apps/AvaTG 0.1.0 \"x\".AppImage");
            assert!(text.contains("Exec=\"/home/me/Apps/AvaTG 0.1.0 \\\"x\\\".AppImage\"\n"));
            assert!(text.contains("Icon=org.avadm.avatg\n"));
        }
    }
}
