//! Downloads, installs and versions the external tools (yt-dlp, Deno, ffmpeg/ffprobe).
//!
//! Tools live in `<app local data>/bin`, which is always user-writable, so they can be
//! updated without reinstalling the app or needing admin rights.
//! Sources (verified 2026-11):
//! - yt-dlp:  github.com/yt-dlp/yt-dlp releases (`yt-dlp.exe`, `yt-dlp_macos`, `yt-dlp_linux`, ...)
//! - Deno:    github.com/denoland/deno releases (`deno-<target-triple>.zip`)
//! - ffmpeg:  Windows -> github.com/yt-dlp/FFmpeg-Builds (`ffmpeg-master-latest-win64-gpl.zip`)
//!            macOS/Linux -> ffmpeg.martin-riedl.de scripted release URLs (`ffmpeg.zip`, `ffprobe.zip`)

use futures_util::StreamExt;
use serde::Serialize;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

use crate::process::hidden_command;

pub const EXE: &str = if cfg!(windows) { ".exe" } else { "" };

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ToolInfo {
    /// "ytdlp" | "deno" | "ffmpeg"
    pub id: String,
    pub name: String,
    pub installed: bool,
    pub version: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ToolProgress {
    id: String,
    stage: String, // "download" | "extract" | "done"
    downloaded: u64,
    total: Option<u64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LatestVersions {
    pub ytdlp: Option<String>,
    pub deno: Option<String>,
}

pub fn bin_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_local_data_dir()
        .map(|d| d.join("bin"))
        .map_err(|e| e.to_string())
}

pub fn tool_path(app: &AppHandle, exe_name: &str) -> Result<PathBuf, String> {
    Ok(bin_dir(app)?.join(format!("{exe_name}{EXE}")))
}

fn unsupported() -> String {
    format!(
        "Unsupported platform: {} {}",
        std::env::consts::OS,
        std::env::consts::ARCH
    )
}

fn ytdlp_url() -> Result<String, String> {
    let asset = match (std::env::consts::OS, std::env::consts::ARCH) {
        ("windows", "x86_64") => "yt-dlp.exe",
        ("windows", "aarch64") => "yt-dlp_arm64.exe",
        ("windows", "x86") => "yt-dlp_x86.exe",
        ("macos", _) => "yt-dlp_macos",
        ("linux", "x86_64") => "yt-dlp_linux",
        ("linux", "aarch64") => "yt-dlp_linux_aarch64",
        _ => return Err(unsupported()),
    };
    Ok(format!(
        "https://github.com/yt-dlp/yt-dlp/releases/latest/download/{asset}"
    ))
}

fn deno_url() -> Result<String, String> {
    let triple = match (std::env::consts::OS, std::env::consts::ARCH) {
        ("windows", "x86_64") => "x86_64-pc-windows-msvc",
        ("windows", "aarch64") => "aarch64-pc-windows-msvc",
        ("macos", "x86_64") => "x86_64-apple-darwin",
        ("macos", "aarch64") => "aarch64-apple-darwin",
        ("linux", "x86_64") => "x86_64-unknown-linux-gnu",
        ("linux", "aarch64") => "aarch64-unknown-linux-gnu",
        _ => return Err(unsupported()),
    };
    Ok(format!(
        "https://github.com/denoland/deno/releases/latest/download/deno-{triple}.zip"
    ))
}

/// (zip url, executables to pull out of it)
fn ffmpeg_sources() -> Result<Vec<(String, Vec<&'static str>)>, String> {
    let os = std::env::consts::OS;
    let arch = std::env::consts::ARCH;
    if os == "windows" {
        let build = match arch {
            "x86_64" => "win64",
            "aarch64" => "winarm64",
            _ => return Err(unsupported()),
        };
        return Ok(vec![(
            format!("https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-{build}-gpl.zip"),
            vec!["ffmpeg", "ffprobe"],
        )]);
    }
    let os_name = match os {
        "macos" => "macos",
        "linux" => "linux",
        _ => return Err(unsupported()),
    };
    let arch_name = match arch {
        "x86_64" => "amd64",
        "aarch64" => "arm64",
        _ => return Err(unsupported()),
    };
    let base = format!("https://ffmpeg.martin-riedl.de/redirect/latest/{os_name}/{arch_name}/release");
    Ok(vec![
        (format!("{base}/ffmpeg.zip"), vec!["ffmpeg"]),
        (format!("{base}/ffprobe.zip"), vec!["ffprobe"]),
    ])
}

fn http() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(concat!("tubegrab/", env!("CARGO_PKG_VERSION")))
        .connect_timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())
}

async fn download(app: &AppHandle, id: &str, url: &str, dest: &Path) -> Result<(), String> {
    let resp = http()?
        .get(url)
        .send()
        .await
        .and_then(|r| r.error_for_status())
        .map_err(|e| format!("Download failed ({url}): {e}"))?;
    let total = resp.content_length();
    let mut file = std::fs::File::create(dest).map_err(|e| e.to_string())?;
    let mut stream = resp.bytes_stream();
    let mut downloaded: u64 = 0;
    let mut last_emit: u64 = 0;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Download interrupted: {e}"))?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;
        if downloaded - last_emit > 512 * 1024 {
            last_emit = downloaded;
            let _ = app.emit(
                "tool-progress",
                ToolProgress { id: id.into(), stage: "download".into(), downloaded, total },
            );
        }
    }
    file.flush().map_err(|e| e.to_string())?;
    Ok(())
}

/// Pull the named executables (matched by file name, anywhere in the archive) out of a zip.
fn extract_from_zip(zip_path: &Path, wanted: &[&str], out_dir: &Path) -> Result<(), String> {
    let file = std::fs::File::open(zip_path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("Bad archive: {e}"))?;
    let mut found = Vec::new();
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        if entry.is_dir() {
            continue;
        }
        let Some(name) = entry
            .enclosed_name()
            .and_then(|p| p.file_name().map(|n| n.to_string_lossy().to_string()))
        else {
            continue;
        };
        for w in wanted {
            if name == format!("{w}{EXE}") {
                let tmp = out_dir.join(format!("{name}.new"));
                let mut out = std::fs::File::create(&tmp).map_err(|e| e.to_string())?;
                std::io::copy(&mut entry, &mut out).map_err(|e| e.to_string())?;
                drop(out);
                finalize(&tmp, &out_dir.join(&name))?;
                found.push(*w);
            }
        }
    }
    for w in wanted {
        if !found.contains(w) {
            return Err(format!("{w} not found in downloaded archive"));
        }
    }
    Ok(())
}

/// Make executable (unix) and atomically move into place.
fn finalize(tmp: &Path, dest: &Path) -> Result<(), String> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(tmp, std::fs::Permissions::from_mode(0o755))
            .map_err(|e| e.to_string())?;
    }
    if dest.exists() {
        std::fs::remove_file(dest)
            .map_err(|e| format!("Cannot replace {} (is it running?): {e}", dest.display()))?;
    }
    std::fs::rename(tmp, dest).map_err(|e| e.to_string())
}

async fn run_version(path: &Path, arg: &str) -> Option<String> {
    if !path.exists() {
        return None;
    }
    let out = hidden_command(path).arg(arg).output().await.ok()?;
    let text = String::from_utf8_lossy(&out.stdout).to_string();
    text.lines().next().map(|l| l.trim().to_string())
}

async fn info_for(app: &AppHandle, id: &str) -> Result<ToolInfo, String> {
    let info = match id {
        "ytdlp" => {
            let p = tool_path(app, "yt-dlp")?;
            let v = run_version(&p, "--version").await;
            ToolInfo { id: id.into(), name: "yt-dlp".into(), installed: v.is_some(), version: v }
        }
        "deno" => {
            let p = tool_path(app, "deno")?;
            // "deno 2.9.8 (stable, release, x86_64-pc-windows-msvc)"
            let v = run_version(&p, "--version")
                .await
                .map(|l| l.split_whitespace().nth(1).unwrap_or(&l).to_string());
            ToolInfo { id: id.into(), name: "Deno (JS runtime)".into(), installed: v.is_some(), version: v }
        }
        "ffmpeg" => {
            let ff = tool_path(app, "ffmpeg")?;
            let fp = tool_path(app, "ffprobe")?;
            // "ffmpeg version 9.0.2 Copyright ..."
            let v = run_version(&ff, "-version")
                .await
                .map(|l| l.split_whitespace().nth(2).unwrap_or(&l).to_string());
            let installed = v.is_some() && fp.exists();
            ToolInfo { id: id.into(), name: "ffmpeg + ffprobe".into(), installed, version: v }
        }
        _ => return Err(format!("Unknown tool {id}")),
    };
    Ok(info)
}

#[tauri::command]
pub async fn tools_status(app: AppHandle) -> Result<Vec<ToolInfo>, String> {
    let mut v = Vec::new();
    for id in ["ytdlp", "deno", "ffmpeg"] {
        v.push(info_for(&app, id).await?);
    }
    Ok(v)
}

#[tauri::command]
pub async fn install_tool(app: AppHandle, id: String) -> Result<ToolInfo, String> {
    let dir = bin_dir(&app)?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    match id.as_str() {
        "ytdlp" => {
            let tmp = dir.join(format!("yt-dlp{EXE}.new"));
            download(&app, &id, &ytdlp_url()?, &tmp).await?;
            finalize(&tmp, &dir.join(format!("yt-dlp{EXE}")))?;
        }
        "deno" => {
            let zip = dir.join("deno.zip.tmp");
            download(&app, &id, &deno_url()?, &zip).await?;
            emit_stage(&app, &id, "extract");
            let r = extract_from_zip(&zip, &["deno"], &dir);
            let _ = std::fs::remove_file(&zip);
            r?;
        }
        "ffmpeg" => {
            for (i, (url, wanted)) in ffmpeg_sources()?.into_iter().enumerate() {
                let zip = dir.join(format!("ffmpeg-{i}.zip.tmp"));
                download(&app, &id, &url, &zip).await?;
                emit_stage(&app, &id, "extract");
                let r = extract_from_zip(&zip, &wanted, &dir);
                let _ = std::fs::remove_file(&zip);
                r?;
            }
        }
        _ => return Err(format!("Unknown tool {id}")),
    }
    emit_stage(&app, &id, "done");
    info_for(&app, &id).await
}

fn emit_stage(app: &AppHandle, id: &str, stage: &str) {
    let _ = app.emit(
        "tool-progress",
        ToolProgress { id: id.into(), stage: stage.into(), downloaded: 0, total: None },
    );
}

/// Latest release tag, read from the `releases/latest` redirect (no GitHub API rate limit).
async fn latest_tag(repo: &str) -> Option<String> {
    let client = reqwest::Client::builder()
        .user_agent(concat!("tubegrab/", env!("CARGO_PKG_VERSION")))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .ok()?;
    let resp = client
        .get(format!("https://github.com/{repo}/releases/latest"))
        .send()
        .await
        .ok()?;
    let loc = resp.headers().get("location")?.to_str().ok()?;
    let tag = loc.rsplit("/tag/").next()?;
    Some(tag.trim_start_matches('v').to_string())
}

#[tauri::command]
pub async fn latest_versions() -> LatestVersions {
    let (ytdlp, deno) = tokio::join!(latest_tag("yt-dlp/yt-dlp"), latest_tag("denoland/deno"));
    LatestVersions { ytdlp, deno }
}

#[tauri::command]
pub fn open_bin_dir(app: AppHandle) -> Result<String, String> {
    let d = bin_dir(&app)?;
    std::fs::create_dir_all(&d).map_err(|e| e.to_string())?;
    Ok(d.to_string_lossy().to_string())
}
