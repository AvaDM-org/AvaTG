//! Updates for AvaTG itself, like AvaDM: check GitHub releases, then install in place where AvaTG owns its files.
//!
//! - Releases are built by `.github/workflows/release.yml`; each carries a signed `latest.json` (Tauri updater).
//! - Stable: `releases/latest/download/latest.json`. With "Include pre-release versions" on, the highest version
//!   among all published releases (pre-releases included) wins.
//! - Windows, macOS and the AppImage install the update and restart. A `.deb` or `.rpm` install belongs to the
//!   package manager, so the frontend opens the release page instead (`install_channel`).

use serde::Serialize;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_updater::{Update, UpdaterExt};

const REPO: &str = "AvaDM-org/AvaTG";

#[derive(Default)]
pub struct PendingUpdate(Mutex<Option<Update>>);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub version: String,
    pub current: String,
    pub notes: Option<String>,
    pub prerelease: bool,
    pub release_page: String,
}

#[derive(Serialize, Clone)]
struct UpdateProgress {
    downloaded: u64,
    total: Option<u64>,
}

/// "auto": AvaTG can replace itself (Windows, macOS, AppImage). "package": installed by a package manager.
#[tauri::command]
pub fn install_channel() -> &'static str {
    if cfg!(target_os = "linux") && std::env::var_os("APPIMAGE").is_none() {
        "package"
    } else {
        "auto"
    }
}

/// Looks for a newer AvaTG. Returns None when this is the newest.
#[tauri::command]
pub async fn update_check(
    app: AppHandle,
    pending: State<'_, PendingUpdate>,
    include_prereleases: bool,
) -> Result<Option<UpdateInfo>, String> {
    let proxy = app
        .state::<crate::proxy::ProxyState>()
        .get()
        .filter(|p| !p.is_empty());
    let tag = if include_prereleases {
        highest_release_tag(proxy.as_deref()).await?
    } else {
        None
    };
    let endpoint = match &tag {
        Some(tag) => format!("https://github.com/{REPO}/releases/download/{tag}/latest.json"),
        None => format!("https://github.com/{REPO}/releases/latest/download/latest.json"),
    };
    let mut builder = app
        .updater_builder()
        .endpoints(vec![endpoint.parse().map_err(|e| format!("{e}"))?])
        .map_err(|e| e.to_string())?;
    if let Some(p) = &proxy {
        builder = builder.proxy(p.parse().map_err(|e| format!("Bad proxy {p}: {e}"))?);
    }
    let update = builder
        .build()
        .map_err(|e| e.to_string())?
        .check()
        .await
        .map_err(|e| e.to_string())?;
    let info = update.as_ref().map(|u| UpdateInfo {
        version: u.version.clone(),
        current: u.current_version.clone(),
        notes: u.body.clone(),
        prerelease: u.version.contains('-'),
        release_page: format!("https://github.com/{REPO}/releases/tag/v{}", u.version),
    });
    *pending.0.lock().map_err(|e| e.to_string())? = update;
    Ok(info)
}

/// Downloads and installs the update found by `update_check`, then restarts AvaTG.
/// Sends `update-progress` events while downloading.
#[tauri::command]
pub async fn update_install(
    app: AppHandle,
    pending: State<'_, PendingUpdate>,
) -> Result<(), String> {
    let update = pending
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .take()
        .ok_or("No update to install; check again")?;
    let mut downloaded = 0u64;
    let handle = app.clone();
    update
        .download_and_install(
            move |chunk, total| {
                downloaded += chunk as u64;
                let _ = handle.emit("update-progress", UpdateProgress { downloaded, total });
            },
            || {},
        )
        .await
        .map_err(|e| e.to_string())?;
    app.restart();
}

/// The tag of the highest published release, pre-releases included (GitHub API, no token: 60 calls an hour).
async fn highest_release_tag(proxy: Option<&str>) -> Result<Option<String>, String> {
    let mut client =
        reqwest::Client::builder().user_agent(concat!("avatg/", env!("CARGO_PKG_VERSION")));
    if let Some(p) = proxy {
        client = client.proxy(reqwest::Proxy::all(p).map_err(|e| e.to_string())?);
    }
    let body = client
        .build()
        .map_err(|e| e.to_string())?
        .get(format!(
            "https://api.github.com/repos/{REPO}/releases?per_page=30"
        ))
        .send()
        .await
        .and_then(|r| r.error_for_status())
        .map_err(|e| format!("Could not read the releases: {e}"))?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;
    let releases: Vec<serde_json::Value> =
        serde_json::from_slice(&body).map_err(|e| e.to_string())?;
    Ok(highest(
        releases
            .iter()
            .filter(|r| !r["draft"].as_bool().unwrap_or(true))
            .filter_map(|r| r["tag_name"].as_str()),
    ))
}

/// The highest SemVer tag ("v1.2.0" > "v1.2.0-rc.2" > "v1.1.9").
fn highest<'a>(tags: impl Iterator<Item = &'a str>) -> Option<String> {
    tags.filter_map(|t| {
        semver::Version::parse(t.trim_start_matches('v'))
            .ok()
            .map(|v| (v, t))
    })
    .max_by(|a, b| a.0.cmp(&b.0))
    .map(|(_, t)| t.to_string())
}

#[cfg(test)]
mod tests {
    use super::highest;

    #[test]
    fn picks_the_highest_semver_tag() {
        let tags = [
            "v1.1.9",
            "v1.2.0-rc.2",
            "v1.2.0",
            "v1.2.0-rc.10",
            "nonsense",
        ];
        assert_eq!(highest(tags.into_iter()).as_deref(), Some("v1.2.0"));
        let pre = ["v1.2.0-rc.2", "v1.2.0-rc.10", "v1.1.9"];
        assert_eq!(highest(pre.into_iter()).as_deref(), Some("v1.2.0-rc.10"));
    }
}
