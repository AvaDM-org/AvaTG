# Progress

## Status (2026-11-14)

**The redesigned app builds and runs on Linux (Fedora 44, KDE Wayland).** `bun run tauri dev` starts it; the
first launch shows the one-time tools setup. `bun run check` (tsc, eslint, vitest, rustfmt, clippy -D warnings,
cargo test) passes.

### Architecture (approved 2026-11-14)
- Rust (`src-tauri/src`): `ytdlp.rs` runs yt-dlp, `tools.rs` installs the tools, `db.rs` stores download recipes and
  settings in SQLite (`<app data>/tubegrab.db`, JSON document per download), `files.rs` deletes partial files and
  renames the description to `.txt`, `tray.rs` is the tray menu and close-to-tray. Errors are `String`s.
- Frontend (`src`): `ipc.ts` is every command and event; `lib/` is pure logic with tests (presets → yt-dlp args,
  link parsing, formatting, yt-dlp JSON); `features/{downloads,picker,settings,tools}` hold each feature's store,
  views and CSS module; `components/ui` holds the shared controls; `styles/tokens.css` is AvaDM's Dark glass.
- State: Zustand. The download queue lives in the frontend (the webview keeps running while the window is hidden).
- Not used, on purpose: shadcn/Tailwind (CSS Modules plus the AvaDM tokens cover it), tauri-specta (still a
  release candidate; `ipc.ts` is the single hand-typed mirror), a router.

### Verified
- Builds, lints, tests; the app window opens and creates its database.
- Tool download URLs (README table, 2026-11-14).

### Known issues
- **Blank window in `tauri dev`** on the owner's machine came from the webview not reaching the Vite dev server
  while a VPN/system proxy app was running (turning it off fixed it). Vite is pinned to 127.0.0.1 and WebKitGTK's
  DMA-BUF renderer is off on Linux (`main.rs`). Release builds load the frontend from inside the app, so they don't
  depend on the dev server.
- **No blur behind the window on Linux.** WebKitGTK cannot ask the compositor for blur, so Linux caps transparency at
  12%. Real blur on KDE would need KWin's `org_kde_kwin_blur` Wayland protocol (or `_KDE_NET_WM_BLUR_BEHIND_REGION`
  on X11) called from Rust: possible later, owner to decide. Windows/macOS can use `window-vibrancy`.

### Verified with real downloads (2026-11-14, yt-dlp 2026.10.26, through the owner's proxy)
- yt-dlp's exact arguments from `presets.ts` plus `ytdlp.rs`'s fixed ones: 1080p MP4 (H.264 now preferred; it
  picked AV1 before), Best MKV, MP3, M4A; subtitles embedded only (mov_text track, `.srt` removed), separate
  (`.en.srt`), both; description written as `.description` (the app renames it to `.txt`).
- Progress lines (`TGP|`, `TGPP|`, `TGF|`) parse; post-processor keys are `Merger`, `Metadata`, `EmbedThumbnail`,
  `ExtractAudio`, `EmbedSubtitle`, `SubtitlesConvertor`, `FixupM4a`, `MoveFiles` (no `FFmpeg` prefix).
- Tools setup installed yt-dlp and Deno; FFmpeg's download crawled at ~2 KB/s without the proxy and never finished.
  The installer has no stall timeout and no proxy yet (both planned).

### Not verified yet (do next)
1. FFmpeg install through the proxy; tool sources (system / custom) once built.
2. In the app: Pause then Resume continuing from the `.part` file, Cancel deleting the partial files, Pause all
   holding waiting downloads.
3. Channel tabs and playlist expansion against real channels.
4. Tray: menu actions, tooltip, close to tray, `--minimized` login launch; single instance.
5. Drag and drop from Firefox and Chrome (`dragDropEnabled: false` in tauri.conf.json).
6. Windows and macOS builds (glass needs `window-vibrancy` there; not added yet).

## UI redesign (in planning)

The look and structure follow AvaDM (`/data/projects/AvaDM/docs/DESIGN.md`, canvas "AvaDM main window").
The mockups live in the Claude design canvas "TubeGrab main window":
https://claude.ai/artifact/QkT75qvfYzuqEXLTHNdXEo


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
  - Pause all / Resume all (also to be added to AvaDM later): a status-bar chip and a tray menu item. Pause all
    pauses running downloads and **holds waiting ones: nothing new starts until Resume all**. Resume all also resumes
    interrupted downloads.
- Tools (2026-11-14): FFmpeg is **not bundled**. Each tool (yt-dlp, Deno, FFmpeg) can come from TubeGrab's own
  downloaded copy, a copy installed on the system (found automatically), or a custom file the user picks. A version
  map decides what is accepted (Deno ≥ 2.3, FFmpeg ≥ 5, yt-dlp warned when older than ~90 days); the downloaded copy
  is the fallback.
- Proxy (2026-11-14): YouTube is unreachable on the owner's network without a proxy. Settings > Downloads > Network:
  use the system proxy (default; KDE, GNOME, Windows, macOS settings or proxy environment variables), a custom proxy
  URL (http, https, socks5), or none. Used by yt-dlp (`--proxy`) and by the tools download.
- Window glass (2026-11-14): real blur like AvaDM. Windows/macOS via `window-vibrancy`; KDE via KWin's
  `org_kde_kwin_blur` Wayland protocol (native Wayland, X11 property as fallback); solid fallback elsewhere.
- Download records (2026-11-14): keep one **"recipe" per download in SQLite** (link, format choice, folder, status),
  like AvaDM. yt-dlp's own `.part` files do the byte-level resuming; Resume re-runs the same command. No AvaDM-style
  working files.

## Claude Code setup for this repo
- Official plugins (project scope, `.claude/settings.json`): `rust-analyzer-lsp`, `typescript-lsp`
  (needs `typescript-language-server` on PATH; installed with `bun add -g typescript-language-server typescript`),
  `code-simplifier`.
- Skills in `.claude/skills/`: Vercel's `react-best-practices` and `composition-patterns` (vercel-labs/agent-skills,
  MIT). Their Next.js/server rules do not apply to this app. There is no official Tauri skill.
