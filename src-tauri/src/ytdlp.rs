//! Runs yt-dlp: metadata queries (`-J`) and downloads with streamed progress.
//! All format/preset logic lives in the frontend (src/lib/presets.ts); this module only
//! adds the fixed arguments that wire yt-dlp to the bundled Deno and ffmpeg.

use serde::Serialize;
use std::collections::HashMap;
use std::ffi::OsStr;
use std::process::Stdio;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::io::{AsyncBufReadExt, AsyncRead, BufReader};
use tokio::process::Command;
use tokio::sync::oneshot;

use crate::tools::resolved_path;

/// Running downloads: job id -> cancel signal.
#[derive(Default)]
pub struct Jobs(pub Mutex<HashMap<String, oneshot::Sender<()>>>);

/// A Command that never opens a console window on Windows and talks UTF-8.
pub fn hidden_command<S: AsRef<OsStr>>(program: S) -> Command {
    let mut cmd = Command::new(program);
    cmd.env("PYTHONUTF8", "1").env("PYTHONIOENCODING", "utf-8");
    #[cfg(windows)]
    {
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd.kill_on_drop(true);
    cmd
}

fn ytdlp_command(app: &AppHandle, cookies_browser: &Option<String>) -> Result<Command, String> {
    let ytdlp = resolved_path(app, "ytdlp", "yt-dlp")?;
    if !ytdlp.exists() {
        return Err("yt-dlp is not installed. Open Settings → Tools.".into());
    }
    let deno = resolved_path(app, "deno", "deno")?;
    // yt-dlp finds ffprobe next to the ffmpeg it is given.
    let ffmpeg = resolved_path(app, "ffmpeg", "ffmpeg")?;
    let mut cmd = hidden_command(&ytdlp);
    // Keep Deno's cache inside AvaTG's data folder instead of the user's ~/.cache/deno.
    let data_dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
    cmd.env("DENO_DIR", data_dir.join("deno-cache"));
    cmd.arg("--ignore-config")
        .arg("--ffmpeg-location")
        .arg(&ffmpeg)
        .arg("--js-runtimes")
        .arg(format!("deno:{}", deno.to_string_lossy()));
    if let Some(proxy) = app.state::<crate::proxy::ProxyState>().get() {
        cmd.arg("--proxy").arg(proxy);
    }
    if let Some(b) = cookies_browser.as_deref().filter(|b| !b.is_empty()) {
        cmd.arg("--cookies-from-browser").arg(b);
    }
    Ok(cmd)
}

fn error_from_stderr(stderr: &str) -> String {
    let errs: Vec<&str> = stderr.lines().filter(|l| l.starts_with("ERROR")).collect();
    if !errs.is_empty() {
        return errs.join("\n");
    }
    let tail: Vec<&str> = stderr.lines().rev().take(5).collect();
    let msg = tail.into_iter().rev().collect::<Vec<_>>().join("\n");
    if msg.trim().is_empty() {
        "yt-dlp failed".into()
    } else {
        msg
    }
}

/// `yt-dlp -J [--flat-playlist] <url>` → parsed JSON.
#[tauri::command]
pub async fn ytdlp_json(
    app: AppHandle,
    url: String,
    flat: bool,
    cookies_browser: Option<String>,
) -> Result<serde_json::Value, String> {
    let mut cmd = ytdlp_command(&app, &cookies_browser)?;
    cmd.arg("-J").arg("--no-warnings");
    if flat {
        cmd.arg("--flat-playlist");
    }
    cmd.arg("--").arg(&url);
    let out = cmd.output().await.map_err(|e| e.to_string())?;
    if !out.status.success() {
        return Err(error_from_stderr(&String::from_utf8_lossy(&out.stderr)));
    }
    serde_json::from_slice(&out.stdout).map_err(|e| format!("Could not parse yt-dlp output: {e}"))
}

#[derive(Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
struct DownloadEvent {
    id: String,
    /// "progress" | "postprocess" | "file" | "log"
    kind: String,
    status: Option<String>,
    downloaded: Option<f64>,
    total: Option<f64>,
    speed: Option<f64>,
    eta: Option<f64>,
    postprocessor: Option<String>,
    filepath: Option<String>,
    /// for "log": one line of yt-dlp's output
    message: Option<String>,
    /// for "log": "info" | "warning" | "error"
    level: Option<String>,
}

fn num(s: &str) -> Option<f64> {
    s.trim().parse::<f64>().ok()
}

fn parse_line(id: &str, line: &str) -> Option<DownloadEvent> {
    let base = DownloadEvent {
        id: id.into(),
        ..Default::default()
    };
    if let Some(rest) = line.strip_prefix("TGP|") {
        let f: Vec<&str> = rest.split('|').collect();
        if f.len() < 6 {
            return None;
        }
        return Some(DownloadEvent {
            kind: "progress".into(),
            status: Some(f[0].into()),
            downloaded: num(f[1]),
            total: num(f[2]).or_else(|| num(f[3])),
            speed: num(f[4]),
            eta: num(f[5]),
            ..base
        });
    }
    if let Some(rest) = line.strip_prefix("TGPP|") {
        let f: Vec<&str> = rest.split('|').collect();
        return Some(DownloadEvent {
            kind: "postprocess".into(),
            status: f.first().map(|s| s.to_string()),
            postprocessor: f.get(1).map(|s| s.to_string()),
            ..base
        });
    }
    if let Some(rest) = line.strip_prefix("TGF|") {
        return Some(DownloadEvent {
            kind: "file".into(),
            filepath: Some(rest.trim().into()),
            ..base
        });
    }
    Some(log_event(base, line))
}

/// Any other line of output, for the download's log.
fn log_event(base: DownloadEvent, line: &str) -> DownloadEvent {
    let level = if line.starts_with("ERROR") {
        "error"
    } else if line.starts_with("WARNING") {
        "warning"
    } else {
        "info"
    };
    DownloadEvent {
        kind: "log".into(),
        message: Some(line.to_string()),
        level: Some(level.into()),
        ..base
    }
}

async fn read_lines<R: AsyncRead + Unpin>(r: R, mut f: impl FnMut(String)) {
    let mut reader = BufReader::new(r);
    let mut buf = Vec::new();
    loop {
        buf.clear();
        match reader.read_until(b'\n', &mut buf).await {
            Ok(0) | Err(_) => break,
            Ok(_) => {
                let line = String::from_utf8_lossy(&buf);
                for part in line.split('\r') {
                    let p = part.trim_end();
                    if !p.is_empty() {
                        f(p.to_string());
                    }
                }
            }
        }
    }
}

/// Download one URL. `args` are the preset arguments built by the frontend
/// (format selection, -P output dir, -o template, embeds...).
/// Resolves with the final file path, or rejects with an error / "cancelled".
#[tauri::command]
pub async fn run_download(
    app: AppHandle,
    jobs: State<'_, Jobs>,
    id: String,
    url: String,
    args: Vec<String>,
    cookies_browser: Option<String>,
) -> Result<Option<String>, String> {
    let mut cmd = ytdlp_command(&app, &cookies_browser)?;
    cmd.args([
        // --print implies --quiet; the log lines (and warnings, on stderr) are wanted for the download's log.
        "--no-quiet",
        "--progress",
        "--newline",
        "--no-simulate",
        "--no-playlist",
        "--progress-template",
        "download:TGP|%(progress.status)s|%(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress.total_bytes_estimate)s|%(progress.speed)s|%(progress.eta)s",
        "--progress-template",
        "postprocess:TGPP|%(progress.status)s|%(progress.postprocessor)s",
        "--print",
        "after_move:TGF|%(filepath)s",
    ]);
    cmd.args(&args);
    cmd.arg("--").arg(&url);
    cmd.stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::null());

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Could not start yt-dlp: {e}"))?;
    let pid = child.id();
    let (tx, rx) = oneshot::channel();
    jobs.0.lock().unwrap().insert(id.clone(), tx);

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();
    let app2 = app.clone();
    let id2 = id.clone();
    let out_task = tokio::spawn(async move {
        let mut filepath = None;
        read_lines(stdout, |line| {
            if let Some(ev) = parse_line(&id2, &line) {
                if ev.kind == "file" {
                    filepath = ev.filepath.clone();
                }
                let _ = app2.emit("download-progress", ev);
            }
        })
        .await;
        filepath
    });
    let app3 = app.clone();
    let id3 = id.clone();
    let err_task = tokio::spawn(async move {
        let mut text = String::new();
        read_lines(stderr, |line| {
            let base = DownloadEvent {
                id: id3.clone(),
                ..Default::default()
            };
            let _ = app3.emit("download-progress", log_event(base, &line));
            text.push_str(&line);
            text.push('\n');
        })
        .await;
        text
    });

    let outcome = tokio::select! {
        status = child.wait() => Some(status),
        _ = rx => None,
    };
    jobs.0.lock().unwrap().remove(&id);

    match outcome {
        None => {
            kill_tree(&mut child, pid).await;
            Err("cancelled".into())
        }
        Some(status) => {
            let filepath = out_task.await.unwrap_or(None);
            let stderr = err_task.await.unwrap_or_default();
            match status {
                Ok(s) if s.success() => Ok(filepath),
                Ok(_) => Err(error_from_stderr(&stderr)),
                Err(e) => Err(e.to_string()),
            }
        }
    }
}

/// yt-dlp spawns ffmpeg; on Windows kill the whole tree so nothing keeps running.
async fn kill_tree(child: &mut tokio::process::Child, pid: Option<u32>) {
    #[cfg(windows)]
    if let Some(pid) = pid {
        let _ = hidden_command("taskkill")
            .args(["/T", "/F", "/PID", &pid.to_string()])
            .output()
            .await;
    }
    #[cfg(not(windows))]
    let _ = pid;
    let _ = child.kill().await;
}

#[tauri::command]
pub fn cancel_download(jobs: State<'_, Jobs>, id: String) {
    if let Some(tx) = jobs.0.lock().unwrap().remove(&id) {
        let _ = tx.send(());
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_progress_files_and_log_lines() {
        let p = parse_line("d1", "TGP|downloading|100|NA|400|50.5|6").unwrap();
        assert_eq!(p.kind, "progress");
        assert_eq!(p.total, Some(400.0));
        assert_eq!(p.speed, Some(50.5));

        let f = parse_line("d1", "TGF|/videos/Clip.mp4").unwrap();
        assert_eq!(f.filepath.as_deref(), Some("/videos/Clip.mp4"));

        let w = parse_line(
            "d1",
            "WARNING: [youtube] Falling back to generic n function",
        )
        .unwrap();
        assert_eq!(
            (w.kind.as_str(), w.level.as_deref()),
            ("log", Some("warning"))
        );
        let i = parse_line("d1", "[info] abc: Downloading 1 format(s): 22").unwrap();
        assert_eq!(i.level.as_deref(), Some("info"));
    }
}
