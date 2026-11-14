//! File clean-up for cancelled and deleted downloads.

use std::path::{Path, PathBuf};

/// Suffixes yt-dlp leaves behind while a download is unfinished.
fn is_partial(name: &str) -> bool {
    name.ends_with(".part")
        || name.ends_with(".ytdl")
        || name.contains(".part-Frag")
        || name.ends_with(".temp")
}

/// Unfinished files of one video in `dir`. Our output template ends in `[<video id>].<ext>`,
/// so the id in brackets identifies them (separate video/audio streams look like `name [id].f137.mp4.part`).
fn partial_files(dir: &Path, video_id: &str) -> Vec<PathBuf> {
    let tag = format!("[{video_id}]");
    let Ok(entries) = std::fs::read_dir(dir) else {
        return Vec::new();
    };
    entries
        .flatten()
        .map(|e| e.path())
        .filter(|p| {
            p.file_name()
                .and_then(|n| n.to_str())
                .is_some_and(|n| n.contains(&tag) && is_partial(n))
        })
        .collect()
}

/// Delete the unfinished files of a cancelled download. Returns how many were removed.
#[tauri::command]
pub fn delete_partials(dir: String, video_id: String) -> usize {
    if video_id.is_empty() {
        return 0;
    }
    partial_files(Path::new(&dir), &video_id)
        .into_iter()
        .filter(|p| std::fs::remove_file(p).is_ok())
        .count()
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

/// yt-dlp writes the description as `<name>.description`; TubeGrab saves it as `<name>.txt` next to the video.
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
    fn finds_only_partials_of_the_given_video() {
        let dir = std::env::temp_dir().join(format!("tubegrab-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        for name in [
            "Slab [abc123].f137.mp4.part",
            "Slab [abc123].f140.m4a.part-Frag12",
            "Slab [abc123].mp4.ytdl",
            "Slab [abc123].mp4",
            "Other [zzz999].mp4.part",
        ] {
            std::fs::write(dir.join(name), b"x").unwrap();
        }
        let mut found: Vec<_> = partial_files(&dir, "abc123")
            .iter()
            .map(|p| p.file_name().unwrap().to_string_lossy().into_owned())
            .collect();
        found.sort();
        assert_eq!(
            found,
            [
                "Slab [abc123].f137.mp4.part",
                "Slab [abc123].f140.m4a.part-Frag12",
                "Slab [abc123].mp4.ytdl"
            ]
        );
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
