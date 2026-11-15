//! The Linux AppImage starts AvaTG with paths into its own bundle (`LD_LIBRARY_PATH`, `PYTHONHOME`,
//! `GST_PLUGIN_SYSTEM_PATH_1_0`, `XDG_DATA_DIRS`, …). Those are for AvaTG's bundled WebKit, not for other
//! programs: a system FFmpeg run with them loads the bundle's older libraries and fails, and a pip-installed
//! yt-dlp looks for Python inside the bundle. So every program AvaTG starts (tools, `gsettings`, the app that
//! opens a file or link) gets the environment without them. Outside an AppImage nothing changes.

use std::sync::OnceLock;

/// Set by the AppImage runtime and its startup scripts, never meant for other programs.
const APPIMAGE_ONLY: [&str; 6] = [
    "APPDIR",
    "APPIMAGE",
    "ARGV0",
    "OWD",
    "GTK_THEME",
    "PYTHONDONTWRITEBYTECODE",
];

/// GStreamer settings the AppImage points at a plugin folder it does not ship. A set path replaces GStreamer's
/// own search path, so WebKit would find no plugins at all.
const GSTREAMER: [&str; 6] = [
    "GST_PLUGIN_SYSTEM_PATH",
    "GST_PLUGIN_SYSTEM_PATH_1_0",
    "GST_PLUGIN_PATH",
    "GST_PLUGIN_PATH_1_0",
    "GST_PLUGIN_SCANNER",
    "GST_PLUGIN_SCANNER_1_0",
];

/// The bundle's mount folder while running as an AppImage.
fn appdir() -> Option<String> {
    std::env::var_os("APPIMAGE")?;
    let dir = std::env::var("APPDIR").ok()?;
    let dir = dir.trim_end_matches('/');
    (!dir.is_empty()).then(|| dir.to_string())
}

pub fn in_appimage() -> bool {
    appdir().is_some()
}

/// `entry` is `dir` or a path inside it (the scripts write `$APPDIR//usr/lib`).
fn inside(entry: &str, dir: &str) -> bool {
    entry
        .strip_prefix(dir)
        .is_some_and(|rest| rest.is_empty() || rest.starts_with('/'))
}

/// What to change for a program started from the bundle at `dir`: each variable with its value minus the
/// bundle's entries, or None to remove it.
fn host_changes(
    vars: impl IntoIterator<Item = (String, String)>,
    dir: &str,
) -> Vec<(String, Option<String>)> {
    vars.into_iter()
        .filter_map(|(key, value)| {
            if APPIMAGE_ONLY.contains(&key.as_str()) {
                return Some((key, None));
            }
            if !value.contains(dir) {
                return None;
            }
            let kept: Vec<&str> = value
                .split(':')
                .filter(|e| !e.is_empty() && !inside(e, dir))
                .collect();
            Some((key, (!kept.is_empty()).then(|| kept.join(":"))))
        })
        .collect()
}

fn changes() -> &'static [(String, Option<String>)] {
    static CHANGES: OnceLock<Vec<(String, Option<String>)>> = OnceLock::new();
    CHANGES.get_or_init(|| match appdir() {
        Some(dir) => host_changes(std::env::vars(), &dir),
        None => Vec::new(),
    })
}

/// PATH as the user has it (system copies of the tools are looked up there).
pub fn path() -> Option<std::ffi::OsString> {
    match changes().iter().find(|(k, _)| k == "PATH") {
        Some((_, v)) => v.as_ref().map(Into::into),
        None => std::env::var_os("PATH"),
    }
}

/// Call first thing at startup, before any thread exists: drops the AppImage's GStreamer paths from AvaTG's
/// own environment so WebKit uses the system's GStreamer plugins.
pub fn prepare() {
    let Some(dir) = appdir() else { return };
    for key in GSTREAMER {
        if std::env::var(key).is_ok_and(|v| v.split(':').any(|e| inside(e, &dir))) {
            // SAFETY: called from `run` before the Tauri runtime starts any thread.
            unsafe { std::env::remove_var(key) };
        }
    }
}

/// Gives a command the user's own environment (see the module comment).
pub trait HostEnv {
    fn host_env(&mut self) -> &mut Self;
}

macro_rules! host_env_for {
    ($t:ty) => {
        impl HostEnv for $t {
            fn host_env(&mut self) -> &mut Self {
                for (key, value) in changes() {
                    match value {
                        Some(v) => self.env(key, v),
                        None => self.env_remove(key),
                    };
                }
                self
            }
        }
    };
}
host_env_for!(std::process::Command);
host_env_for!(tokio::process::Command);

#[cfg(test)]
mod tests {
    use super::*;

    fn run(vars: &[(&str, &str)]) -> Vec<(String, Option<String>)> {
        let vars = vars.iter().map(|(k, v)| (k.to_string(), v.to_string()));
        let mut out = host_changes(vars, "/tmp/.mount_AvaTG_x");
        out.sort();
        out
    }

    #[test]
    fn removes_the_bundle_from_the_environment() {
        let out = run(&[
            ("HOME", "/home/me"),
            (
                "PATH",
                "/tmp/.mount_AvaTG_x/usr/bin/:/tmp/.mount_AvaTG_x/bin/:/home/me/.local/bin:/usr/bin",
            ),
            (
                "LD_LIBRARY_PATH",
                "/tmp/.mount_AvaTG_x/usr/lib/:/tmp/.mount_AvaTG_x//usr/lib/x86_64-linux-gnu/",
            ),
            ("PYTHONPATH", "/tmp/.mount_AvaTG_x/usr/share/pyshared/:"),
            (
                "XDG_DATA_DIRS",
                "/tmp/.mount_AvaTG_x/usr/share/:/usr/local/share:/usr/share",
            ),
            ("APPDIR", "/tmp/.mount_AvaTG_x"),
            ("GTK_THEME", "Adwaita:dark"),
            // another AppImage's mount folder that only starts with the same text is kept
            ("OTHER", "/tmp/.mount_AvaTG_x2/lib"),
        ]);
        let get = |k: &str| out.iter().find(|(key, _)| key == k).map(|(_, v)| v.clone());
        assert_eq!(get("HOME"), None, "untouched variables are not listed");
        assert_eq!(
            get("PATH"),
            Some(Some("/home/me/.local/bin:/usr/bin".into()))
        );
        assert_eq!(get("LD_LIBRARY_PATH"), Some(None));
        assert_eq!(get("PYTHONPATH"), Some(None));
        assert_eq!(
            get("XDG_DATA_DIRS"),
            Some(Some("/usr/local/share:/usr/share".into()))
        );
        assert_eq!(get("APPDIR"), Some(None));
        assert_eq!(get("GTK_THEME"), Some(None));
        assert_eq!(get("OTHER"), Some(Some("/tmp/.mount_AvaTG_x2/lib".into())));
    }
}
