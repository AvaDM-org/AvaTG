// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // WebKitGTK's DMA-BUF renderer fails on many Linux setups (NVIDIA, hybrid GPUs, some Wayland compositors):
    // the page never loads and the window stays empty. Turn it off unless the user chose otherwise.
    #[cfg(target_os = "linux")]
    if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
        // SAFETY: called first thing in main, before any other thread exists.
        unsafe { std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1") };
    }
    tubegrab_lib::run()
}
