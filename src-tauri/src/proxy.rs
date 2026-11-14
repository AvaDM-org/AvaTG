//! The proxy used by yt-dlp (`--proxy`) and by tool downloads.
//!
//! The frontend decides which proxy applies (Settings > Downloads > Network: system, custom or none) and stores the
//! result here with `set_proxy`. `system_proxy` reads the desktop's proxy setting: proxy environment variables,
//! then KDE or GNOME on Linux, the Internet Settings registry key on Windows, `scutil --proxy` on macOS.

use std::sync::Mutex;
use tauri::State;

/// `None`: no proxy given (yt-dlp and reqwest fall back to environment variables).
/// `Some("")`: connect directly. `Some(url)`: use that proxy.
#[derive(Default)]
pub struct ProxyState(pub Mutex<Option<String>>);

impl ProxyState {
    pub fn get(&self) -> Option<String> {
        self.0.lock().ok().and_then(|p| p.clone())
    }
}

#[tauri::command]
pub fn set_proxy(state: State<'_, ProxyState>, url: Option<String>) {
    if let Ok(mut p) = state.0.lock() {
        *p = url;
    }
}

/// The desktop's proxy as a URL (`http://host:port`, `socks5://host:port`), if one is set.
#[tauri::command]
pub async fn system_proxy() -> Option<String> {
    if let Some(p) = from_env() {
        return Some(p);
    }
    platform_proxy().await
}

fn from_env() -> Option<String> {
    [
        "https_proxy",
        "HTTPS_PROXY",
        "all_proxy",
        "ALL_PROXY",
        "http_proxy",
        "HTTP_PROXY",
    ]
    .iter()
    .filter_map(|k| std::env::var(k).ok())
    .find(|v| !v.trim().is_empty())
}

/// "http://127.0.0.1 10809" (KDE writes a space) or "127.0.0.1:10809" → "http://127.0.0.1:10809".
fn normalize(raw: &str, default_scheme: &str) -> Option<String> {
    let raw = raw.trim().trim_matches(['"', '\'']);
    if raw.is_empty() {
        return None;
    }
    let with_port = match raw.rsplit_once(' ') {
        Some((host, port)) if port.parse::<u16>().is_ok() => format!("{host}:{port}"),
        _ => raw.to_string(),
    };
    Some(if with_port.contains("://") {
        with_port
    } else {
        format!("{default_scheme}://{with_port}")
    })
}

#[cfg(target_os = "linux")]
async fn platform_proxy() -> Option<String> {
    kde_proxy().or(gnome_proxy().await)
}

/// KDE: `~/.config/kioslaverc`, `[Proxy Settings]`, ProxyType=1 means manual.
#[cfg(target_os = "linux")]
fn kde_proxy() -> Option<String> {
    let config = std::env::var_os("XDG_CONFIG_HOME")
        .map(std::path::PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|h| std::path::Path::new(&h).join(".config")))?;
    let text = std::fs::read_to_string(config.join("kioslaverc")).ok()?;
    parse_kde(&text)
}

#[cfg(any(target_os = "linux", test))]
fn parse_kde(text: &str) -> Option<String> {
    let mut in_section = false;
    let mut kind = None;
    let mut entries = std::collections::HashMap::new();
    for line in text.lines() {
        let line = line.trim();
        if line.starts_with('[') {
            in_section = line == "[Proxy Settings]";
        } else if let (true, Some((k, v))) = (in_section, line.split_once('=')) {
            if k == "ProxyType" {
                kind = v.trim().parse::<u8>().ok();
            } else {
                entries.insert(k.trim().to_string(), v.trim().to_string());
            }
        }
    }
    if kind != Some(1) {
        return None;
    }
    let get = |k: &str| entries.get(k).and_then(|v| normalize(v, "http"));
    get("httpsProxy").or_else(|| get("httpProxy")).or_else(|| {
        entries
            .get("socksProxy")
            .and_then(|v| normalize(v, "socks5"))
    })
}

/// GNOME: `org.gnome.system.proxy`, mode 'manual'.
#[cfg(target_os = "linux")]
async fn gnome_proxy() -> Option<String> {
    let get = |key: &'static str, schema: &'static str| async move {
        let out = tokio::process::Command::new("gsettings")
            .args(["get", schema, key])
            .output()
            .await
            .ok()?;
        let v = String::from_utf8_lossy(&out.stdout)
            .trim()
            .trim_matches('\'')
            .to_string();
        (!v.is_empty()).then_some(v)
    };
    if get("mode", "org.gnome.system.proxy").await?.as_str() != "manual" {
        return None;
    }
    for (schema, scheme) in [
        ("org.gnome.system.proxy.https", "http"),
        ("org.gnome.system.proxy.http", "http"),
        ("org.gnome.system.proxy.socks", "socks5"),
    ] {
        let host = get("host", schema).await.unwrap_or_default();
        let port = get("port", schema).await.unwrap_or_default();
        if !host.is_empty() && port != "0" && !port.is_empty() {
            return Some(format!("{scheme}://{host}:{port}"));
        }
    }
    None
}

/// Windows: HKCU Internet Settings, ProxyEnable=1 and ProxyServer ("host:port" or "http=…;https=…").
#[cfg(windows)]
async fn platform_proxy() -> Option<String> {
    let out = crate::ytdlp::hidden_command("reg")
        .args([
            "query",
            r"HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings",
        ])
        .output()
        .await
        .ok()?;
    let text = String::from_utf8_lossy(&out.stdout);
    let value = |name: &str| {
        text.lines()
            .map(str::trim)
            .find(|l| l.starts_with(name))
            .and_then(|l| l.split_whitespace().last().map(str::to_string))
    };
    if value("ProxyEnable")?.as_str() != "0x1" {
        return None;
    }
    let server = value("ProxyServer")?;
    let pick = server
        .split(';')
        .find_map(|part| {
            part.strip_prefix("https=")
                .or_else(|| part.strip_prefix("http="))
        })
        .unwrap_or(&server)
        .to_string();
    normalize(&pick, "http")
}

/// macOS: `scutil --proxy` prints the active network service's proxies.
#[cfg(target_os = "macos")]
async fn platform_proxy() -> Option<String> {
    let out = tokio::process::Command::new("scutil")
        .arg("--proxy")
        .output()
        .await
        .ok()?;
    let text = String::from_utf8_lossy(&out.stdout);
    let value = |name: &str| {
        text.lines().map(str::trim).find_map(|l| {
            l.strip_prefix(name)
                .and_then(|r| r.trim().strip_prefix(':'))
                .map(|v| v.trim().to_string())
        })
    };
    for (enable, host, port, scheme) in [
        ("HTTPSEnable", "HTTPSProxy", "HTTPSPort", "http"),
        ("HTTPEnable", "HTTPProxy", "HTTPPort", "http"),
        ("SOCKSEnable", "SOCKSProxy", "SOCKSPort", "socks5"),
    ] {
        if value(enable).as_deref() == Some("1") {
            if let (Some(h), Some(p)) = (value(host), value(port)) {
                return Some(format!("{scheme}://{h}:{p}"));
            }
        }
    }
    None
}

#[cfg(not(any(target_os = "linux", windows, target_os = "macos")))]
async fn platform_proxy() -> Option<String> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_kde_and_bare_values() {
        assert_eq!(
            normalize("http://127.0.0.1 10809", "http").as_deref(),
            Some("http://127.0.0.1:10809")
        );
        assert_eq!(
            normalize("127.0.0.1:1080", "socks5").as_deref(),
            Some("socks5://127.0.0.1:1080")
        );
        assert_eq!(normalize("  ", "http"), None);
    }

    #[test]
    fn reads_a_manual_kde_proxy() {
        let cfg = "[Other]\nProxyType=0\n[Proxy Settings]\nProxyType=1\nhttpProxy=http://127.0.0.1 10809\nhttpsProxy=http://127.0.0.1 10809\n";
        assert_eq!(parse_kde(cfg).as_deref(), Some("http://127.0.0.1:10809"));
        assert_eq!(
            parse_kde("[Proxy Settings]\nProxyType=0\nhttpProxy=http://x 1\n"),
            None
        );
    }
}
