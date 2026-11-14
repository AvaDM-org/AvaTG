//! Imported themes: JSON files in `<app data>/themes`, like AvaDM. Rust only reads and writes the files;
//! `src/lib/themes.ts` parses and checks them. Built-in themes ship inside the frontend.

use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// A theme is a handful of colour tokens; anything bigger is not a theme.
const MAX_THEME_BYTES: u64 = 64 * 1024;

fn themes_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("themes");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// Theme ids become file names, so only lowercase letters, digits and dashes.
fn file_for(app: &AppHandle, id: &str) -> Result<PathBuf, String> {
    let valid = !id.is_empty()
        && id.len() <= 64
        && id
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-');
    if !valid {
        return Err(format!(
            "Bad theme id \"{id}\": use lowercase letters, digits and dashes"
        ));
    }
    Ok(themes_dir(app)?.join(format!("{id}.theme.json")))
}

/// The text of every imported theme file.
#[tauri::command]
pub fn themes_list(app: AppHandle) -> Result<Vec<String>, String> {
    let mut out = Vec::new();
    for entry in std::fs::read_dir(themes_dir(&app)?)
        .map_err(|e| e.to_string())?
        .flatten()
    {
        let path = entry.path();
        let small = entry.metadata().is_ok_and(|m| m.len() <= MAX_THEME_BYTES);
        if !(small && path.extension().is_some_and(|e| e == "json")) {
            continue;
        }
        if let Ok(text) = std::fs::read_to_string(&path) {
            out.push(text);
        }
    }
    Ok(out)
}

/// Read a theme file the user picked or dropped (checked by the frontend before it is saved).
#[tauri::command]
pub fn theme_read(path: String) -> Result<String, String> {
    let path = PathBuf::from(path);
    if path.extension().is_none_or(|e| e != "json") {
        return Err("A theme is a .json file".into());
    }
    let size = std::fs::metadata(&path).map_err(|e| e.to_string())?.len();
    if size > MAX_THEME_BYTES {
        return Err("This file is too big to be a theme".into());
    }
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn theme_save(app: AppHandle, id: String, text: String) -> Result<(), String> {
    std::fs::write(file_for(&app, &id)?, text).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn theme_remove(app: AppHandle, id: String) -> Result<(), String> {
    match std::fs::remove_file(file_for(&app, &id)?) {
        Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(e.to_string()),
        _ => Ok(()),
    }
}

/// Write a theme's JSON to a file the user chose with the save dialog ("Export…").
#[tauri::command]
pub fn theme_export(path: String, text: String) -> Result<(), String> {
    if text.len() as u64 > MAX_THEME_BYTES {
        return Err("This theme is too big".into());
    }
    let path = PathBuf::from(path);
    if path.extension().is_none_or(|e| e != "json") {
        return Err("Save the theme as a .json file".into());
    }
    std::fs::write(path, text).map_err(|e| e.to_string())
}

/// The themes folder, for "Open folder".
#[tauri::command]
pub fn themes_folder(app: AppHandle) -> Result<String, String> {
    Ok(themes_dir(&app)?.to_string_lossy().into_owned())
}
