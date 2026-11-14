# Progress

## Status (2026-11-14)

The first full implementation is written but has **never been compiled or run**. The machine it was written on
has no Rust or MSVC toolchain. The owner continues on another machine.

### Verified
- `npx tsc --noEmit` passes and `npx vite build` succeeds (frontend only).
- Every tool download URL and asset name was checked against the live release pages on 2026-11-14
  (yt-dlp 2026.10.26, Deno v2.9.8, yt-dlp/FFmpeg-Builds `latest`, martin-riedl.de scripting URLs). The table is in README.
- The yt-dlp JS runtime requirements come from the yt-dlp wiki "EJS" page (Deno is the default, minimum 2.3.0).

### Not verified (do these first)
1. **Rust compiles.** `src-tauri/src/tools.rs` and `process.rs` were written against reqwest 0.12, zip 2,
   tokio 1 and tauri-plugin-dialog 2 without a compiler. Expect a few small fixes.
2. The tool installer works on each OS (the setup screen's **Download tools** button).
3. yt-dlp argument sets. Run one download per quick preset and check:
   - The progress template lines `TGP|…`, `TGPP|…` and `--print after_move:TGF|%(filepath)s` come back on stdout
     with `--quiet --progress --newline --no-simulate`.
   - `-S res:H,ext:mp4:m4a` + `--merge-output-format mp4` gives an MP4 at ≤H.
   - Audio: `-f ba/b -x --audio-format mp3 --audio-quality 0`.
4. Channel view: `<base>/videos`, `/shorts` and `/playlists` with `--flat-playlist` return entries. Check that
   `toEntry` in `src/lib/youtube.ts` detects playlist entries (`ie_key === "YoutubeTab"` or `list=` in the URL).
5. Cancel kills yt-dlp and its ffmpeg child (Windows uses `taskkill /T /F`).
6. The capability permissions in `src-tauri/capabilities/default.json` (`opener:allow-open-path` with a `**` scope,
   `dialog:default`) are accepted by the Tauri build.

## Next up
On the other machine (with Rust installed via rustup, plus the Tauri prerequisites):

```bash
cd tubegrab && npm install && npm run tauri dev
```

Fix any compile errors in `src-tauri/src/*.rs`, then work through the "Not verified" list above. After that:
- Add a GitHub Actions release workflow (`tauri-apps/tauri-action`, matrix: windows-latest, macos-latest
  for aarch64 and x86_64, ubuntu-22.04).
- Replace the template icons: `npm run tauri icon path/to/icon.png`.
- Optional: the Tauri updater plugin for the app itself (tools already update on their own).

## Decisions (owner)
- Stack: Tauri 2 + React/TS.
- Tools are downloaded on first run into app data and updated from Settings → Tools. They are not bundled.
- Project name: tubegrab.
