//! Files on disk: clean-up for cancelled and deleted downloads, sizes, the description file.

use std::path::Path;

/// Each download keeps its unfinished files in `<download folder>/.avatg-parts/<download id>/`
/// (yt-dlp's `--paths temp:`); only the finished file is moved out next to the others.
const PARTS_DIR: &str = ".avatg-parts";

/// Delete a download's working folder (on cancel, remove, or once it is finished), and the
/// `.avatg-parts` folder too when nothing else is in it. Refuses any folder that is not a working folder.
#[tauri::command]
pub fn delete_parts(dir: String) -> Result<(), String> {
    let dir = Path::new(&dir);
    let parent = dir.parent().ok_or("not a working folder")?;
    if parent.file_name().and_then(|n| n.to_str()) != Some(PARTS_DIR) {
        return Err(format!("{} is not a working folder", dir.display()));
    }
    match std::fs::remove_dir_all(dir) {
        Ok(()) => {}
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
        Err(e) => return Err(e.to_string()),
    }
    let _ = std::fs::remove_dir(parent); // only succeeds when empty
    Ok(())
}

/// Delete finished files from disk ("Delete files…"). Missing files are not an error.
#[tauri::command]
pub fn delete_files(paths: Vec<String>) -> Result<(), String> {
    for p in paths {
        match std::fs::remove_file(&p) {
            Ok(()) => {}
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => return Err(format!("Could not delete {p}: {e}")),
        }
    }
    Ok(())
}

/// The size of each file in bytes, or None when it doesn't exist (also used to ask whether files exist).
#[tauri::command]
pub fn file_sizes(paths: Vec<String>) -> Vec<Option<u64>> {
    paths
        .iter()
        .map(|p| {
            std::fs::metadata(p)
                .ok()
                .filter(|m| m.is_file())
                .map(|m| m.len())
        })
        .collect()
}

/// Free space on the disk that holds `path`, in bytes. The folder may not exist yet (a new playlist folder),
/// so the nearest existing parent is asked.
#[tauri::command]
pub fn free_space(path: String) -> Result<u64, String> {
    let mut dir = Path::new(&path);
    while !dir.exists() {
        dir = dir.parent().ok_or("No such folder")?;
    }
    fs4::available_space(dir).map_err(|e| e.to_string())
}

/// Lists of links bigger than this are refused (a list of 2 MB is tens of thousands of links).
const MAX_LIST_BYTES: u64 = 2 * 1024 * 1024;

/// Read a text file the user picked as a list of links. The frontend finds the links in it.
#[tauri::command]
pub fn read_link_list(path: String) -> Result<String, String> {
    let size = std::fs::metadata(&path).map_err(|e| e.to_string())?.len();
    if size > MAX_LIST_BYTES {
        return Err("This file is too big to be a list of links".into());
    }
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

/// yt-dlp writes the description as `<name>.description`; AvaTG saves it as `<name>.txt` next to the video.
#[tauri::command]
pub fn rename_description(video_path: String) -> Result<(), String> {
    let video = Path::new(&video_path);
    let from = video.with_extension("description");
    if !from.exists() {
        return Ok(());
    }
    std::fs::rename(&from, video.with_extension("txt")).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deletes_only_working_folders() {
        let root = std::env::temp_dir().join(format!("avatg-test-{}", std::process::id()));
        let parts = root.join(PARTS_DIR).join("d123");
        std::fs::create_dir_all(&parts).unwrap();
        std::fs::write(parts.join("Slab.f137.mp4.part"), b"x").unwrap();
        std::fs::write(root.join("Keep.mp4"), b"x").unwrap();

        assert!(delete_parts(root.to_string_lossy().into_owned()).is_err());
        delete_parts(parts.to_string_lossy().into_owned()).unwrap();
        assert!(
            !root.join(PARTS_DIR).exists(),
            "the empty .avatg-parts folder is removed too"
        );
        assert!(root.join("Keep.mp4").exists());
        let keep = root.join("Keep.mp4").to_string_lossy().into_owned();
        assert_eq!(
            file_sizes(vec![keep, root.to_string_lossy().into_owned()]),
            vec![Some(1), None]
        );
        std::fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn free_space_of_a_folder_that_does_not_exist_yet() {
        let missing = std::env::temp_dir().join("avatg-no-such-folder/inner");
        assert!(free_space(missing.to_string_lossy().into_owned()).unwrap() > 0);
    }
}
