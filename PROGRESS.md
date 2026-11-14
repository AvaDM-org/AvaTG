# Progress

## Status (2026-11-14)

The first full implementation is written but has **never been compiled or run**. This machine (Fedora) now has
Rust 1.98.1 and rust-analyzer, so the Rust side can be built here. A UI redesign is being planned (see "UI redesign"
below) before more code is written.

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
cd tubegrab && bun install && bun run tauri dev
```

Fix any compile errors in `src-tauri/src/*.rs`, then work through the "Not verified" list above. After that:
- Add a GitHub Actions release workflow (`tauri-apps/tauri-action`, matrix: windows-latest, macos-latest
  for aarch64 and x86_64, ubuntu-22.04).
- Replace the template icons: `bun run tauri icon path/to/icon.png`.
- Optional: the Tauri updater plugin for the app itself (tools already update on their own).

## UI redesign (in planning)

The look and structure follow AvaDM (`/data/projects/AvaDM/docs/DESIGN.md`, canvas "AvaDM main window").
The mockups live in the Claude design canvas "TubeGrab main window":
https://claude.ai/artifact/QkT75qvfYzuqEXLTHNdXEo

Open: the code architecture and coding standards (proposal made, not yet approved).

### Small features to carry over from AvaDM (owner: keep them)
Collected from AvaDM's git history and CHANGELOG. Each needs a TubeGrab equivalent:
- **Adding links**: clipboard button in the top bar; **Ctrl+V anywhere on the list** (no text field focused, no
  dialog open) adds the clipboard's links; **drag and drop** of links or text with links onto the window, with a
  full-window overlay ("Drop to add", "N links found", amber "No link found in this item"). Read every drag format:
  `text/uri-list`, `text/plain` and `text/html` (Firefox multi-selected links only arrive as HTML). One link opens
  the video dialog; several links open a picker list like a playlist. Nothing starts without a confirmation.
  Tauri note (to verify): browser link drags need the window's native file-drop handling off (`dragDropEnabled: false`)
  so the webview gets HTML5 drag events.
- **List**: click / Ctrl / Shift multi-select, tri-state select-all, the bulk toolbar; hover row actions; row
  right-click menu (Play, Show in folder, Open on YouTube, Copy video link, Download again…, Remove, Delete files…);
  Status filter and Sort with counts; middle truncation of long titles; tooltips that show the full text of anything
  truncated; persisted sort/filter.
- **Keyboard**: Ctrl K search, Esc clears the selection and cancels dialogs, Delete removes, Enter / Ctrl+Enter confirms.
- **Remove vs Delete files**: separate actions and confirmations (Remove keeps the files).
- **Double-click a finished download**: setting (Play / Show in folder).
- **Interrupted downloads**: an "N interrupted · Resume all" chip after a restart, plus the "Resume unfinished downloads"
  setting.
- **App shell**: single instance (a second launch shows the running window; `tauri-plugin-single-instance`);
  tray menu with running downloads and Pause/Resume; in-app toasts for errors; rolling log files with "Open log folder";
  crash report that opens a prefilled GitHub issue; update-available toast and self-update (Tauri updater plugin);
  a minimum window size; settings apply immediately with inline validation (no Save button).

## Decisions (owner)
- Stack: Tauri 2 + React/TS.
- Tools are downloaded on first run into app data and updated from Settings → Tools. They are not bundled.
- Project name: tubegrab.
- Package manager: **bun** (2026-11-14). `bun.lock`, `bun run dev/build` in `tauri.conf.json`.
- UI (2026-11-14):
  - AvaDM's **Dark glass** look only. No Frost/light theme. Keep the glass (transparency) effect with a strength
    setting if Tauri can do it, with a solid fallback.
  - Settings mirror AvaDM's settings pages. Keep only the options yt-dlp (or the app) can really do; drop the rest.
  - **Tray app like AvaDM**: closing hides to the tray, downloads keep running in the background, launch at login
    (starts in the tray). **No scheduler or queues in v1.**
  - Subtitles: offered per download, including **auto-generated captions**. A setting chooses embedded, separate
    files, or both.
  - Description: an option to save it as a **`.txt` file next to the video**.
  - Speed limit: **per download** only (`--limit-rate`); yt-dlp has no shared total limit.
  - Settings pages: General (with the glass slider as a row, no Appearance page), Downloads, Files, Tools, Storage,
    About & updates. Defaults: **1 download at a time**, 4 parts per download, 10 retries, 20 s stall timeout,
    3 automatic resumes, description file off.
  - Pause all / Resume all: wanted (also to be added to AvaDM later). Placement proposed on the canvas, not decided.
- Download records (2026-11-14): keep one **"recipe" per download in SQLite** (link, format choice, folder, status),
  like AvaDM. yt-dlp's own `.part` files do the byte-level resuming; Resume re-runs the same command. No AvaDM-style
  working files.

## Claude Code setup for this repo
- Official plugins (project scope, `.claude/settings.json`): `rust-analyzer-lsp`, `typescript-lsp`
  (needs `typescript-language-server` on PATH; installed with `bun add -g typescript-language-server typescript`),
  `code-simplifier`.
- Skills in `.claude/skills/`: Vercel's `react-best-practices` and `composition-patterns` (vercel-labs/agent-skills,
  MIT). Their Next.js/server rules do not apply to this app. There is no official Tauri skill.
