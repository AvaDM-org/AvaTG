# TubeGrab: notes for agents

- Read `README.md` (architecture, tool sources) and `PROGRESS.md` (status, next steps) first. Update
  `PROGRESS.md` and commit after each item.
- Rust (`src-tauri/src`) only runs processes and manages files. Put yt-dlp format and preset logic in
  `src/lib/presets.ts` and metadata parsing in `src/lib/youtube.ts`, not in Rust.
- Tool download URLs live only in `src-tauri/src/tools.rs`. If you change them, re-check them against the live
  release pages and update the README table with the date.
- yt-dlp needs a JS runtime for YouTube. Deno is passed explicitly with `--js-runtimes deno:<path>`. Do not remove it.
- yt-dlp/FFmpeg-Builds has no macOS builds. macOS and Linux ffmpeg comes from martin-riedl.de.
- Lesson: `create-tauri-app` scaffolds fine without Rust, but nothing in `src-tauri` can be checked without
  rustup + platform build tools. Check `rustc -V` before promising a Rust build.
- Features belong to the owner. Ask before inventing new UI rules, and record the decisions in `PROGRESS.md`.
