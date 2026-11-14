// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Development only: a desktop-wide proxy without a localhost exception (seen with KDE's proxy settings and
    // VPN proxy apps) sends the dev server's 127.0.0.1 address to the proxy and the window stays blank. The
    // dev webview connects directly; yt-dlp and tool downloads use AvaTG's own proxy setting.
    #[cfg(all(debug_assertions, target_os = "linux"))]
    if std::env::var_os("GIO_USE_PROXY_RESOLVER").is_none() {
        // SAFETY: called first thing in main, before any other thread exists.
        unsafe { std::env::set_var("GIO_USE_PROXY_RESOLVER", "dummy") };
    }
    avatg_lib::run()
}
