mod process;
mod tools;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(process::Jobs::default())
        .invoke_handler(tauri::generate_handler![
            tools::tools_status,
            tools::install_tool,
            tools::latest_versions,
            tools::open_bin_dir,
            process::ytdlp_json,
            process::run_download,
            process::cancel_download,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
