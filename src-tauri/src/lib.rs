//! TubeGrab's native side. Rust only runs processes and manages files and storage;
//! download logic, presets and yt-dlp arguments live in the TypeScript frontend.

mod db;
mod files;
mod proxy;
mod tools;
mod tray;
mod ytdlp;

use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{Manager, WindowEvent};

/// Passed by the login item so a login launch starts hidden in the tray.
const MINIMIZED_ARG: &str = "--minimized";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Must be first: a second launch only brings the running window forward.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            tray::show_main_window(app)
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![MINIMIZED_ARG]),
        ))
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(ytdlp::Jobs::default())
        .manage(proxy::ProxyState::default())
        .manage(tray::CloseToTray(AtomicBool::new(true)))
        .setup(|app| {
            let handle = app.handle();
            app.manage(db::Db::open(&db::db_path(handle)?)?);
            app.manage(tray::build(handle)?);
            if !std::env::args().any(|a| a == MINIMIZED_ARG) {
                tray::show_main_window(handle);
            }
            // Debug builds open the web inspector so frontend errors are visible.
            #[cfg(debug_assertions)]
            if let Some(w) = app.get_webview_window("main") {
                w.open_devtools();
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let to_tray = window
                    .state::<tray::CloseToTray>()
                    .0
                    .load(Ordering::Relaxed);
                if to_tray {
                    api.prevent_close();
                    let _ = window.hide();
                } else {
                    window.app_handle().exit(0);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            tools::tools_status,
            tools::install_tool,
            tools::latest_versions,
            tools::open_bin_dir,
            ytdlp::ytdlp_json,
            ytdlp::run_download,
            ytdlp::cancel_download,
            db::downloads_list,
            db::downloads_save,
            db::downloads_delete,
            db::settings_load,
            db::settings_save,
            files::delete_partials,
            files::delete_files,
            files::rename_description,
            tray::tray_update,
            tray::set_close_to_tray,
            proxy::set_proxy,
            proxy::system_proxy,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
