# Progress

Handoff file: a new session should be able to continue from this file, `CLAUDE.md` and `README.md` alone.

## Status (2026-11-15)

**AvaTG** (formerly TubeGrab) is a YouTube/yt-dlp downloader built like AvaDM, on Tauri 2 + React/TypeScript.
Code: https://github.com/AvaDM-org/AvaTG (public, branch `main`). The local folder is still `/data/projects/tubegrab`.

- Works on Linux (owner's Fedora 44, KDE Plasma 6.8 Wayland): dev runs, a release RPM, real downloads, blur.
- `bun run check` passes locally and the **Check** workflow passes on GitHub.
- **`v0.1.0` is built as a DRAFT release** (all platforms, signed update feed, SHA256SUMS). Not published yet.
- Design canvas (all screens, Dark glass and Cherry dark): https://claude.ai/artifact/QkT75qvfYzuqEXLTHNdXEo

### Next
0. Owner reviews the AvaDM feature port (below, all 16 items committed locally on 2026-11-16, not pushed) in the
   real app, especially the choices listed under the table.
1. Owner publishes the `v0.1.0` draft. Then test a real self-update: release `v0.1.1` (bump the three version
   fields, CHANGELOG entry, tag), run 0.1.0 as an AppImage on Linux and update it from the notice.
2. Test the installers on Windows and macOS (nothing has run there yet; macOS builds are unsigned, so users need
   right-click › Open the first time).
3. The "Not built yet" items below, in whatever order the owner picks.

## Feature port (2026-11-15)

The owner picked these from AvaDM's `docs/FEATURES.md` (queues, schedules, speed limits and AvaDM's own engine are
out). Work through them in this order, design first, one commit each, **commit locally only (no push, no tag)**.
Code must stay easy to move into a Tauri port of AvaDM: generic pieces go in `src/components` or `src/lib` with no
download-specific knowledge; feature code in `src/features/downloads`.

Owner answers (2026-11-15): duplicates offer **Skip / Rename / Replace** (Skip is the default, one choice covers a
whole batch); visible columns **Name, Format, Size, Status, Speed, Added**, hidden by default Channel, Duration,
Took, Avg speed, Folder; the **detail panel opens on selection** and stays closed once closed (remembered) until
reopened; columns **reorder, resize and hide like Dolphin/Explorer**.

| # | Item | Status |
|---|---|---|
| 1 | DB backup before each schema migration (`avatg.db.bak-v<N>`, `VACUUM INTO`) | done |
| 2 | Dev-only demo mode: the frontend runs in a normal browser with mocked IPC (`?demo`), one row per status, fake progress; a `?gallery` page of every control. Never in release builds | done (`src/dev/demo.ts`, `src/dev/Gallery.tsx`) |
| 3 | Generic table: column defs, drag to reorder, resize grips, header right-click menu (show/hide, reset), horizontal scroll, sort by header (arrow, click again reverses). Layout, sort and filters saved | done |
| 4 | Virtualized rows (own fixed-height hook, no dependency): long channel lists stay fast | done |
| 5 | Type filter (All / Video / Audio, live counts) and new columns: Added, Channel, Duration, Took, Avg speed, Folder | done |
| 6 | History stats: started/finished time, time running and time transferring summed across resumes; "Took" and "Average speed"; the real file size once finished | done |
| 7 | yt-dlp output per download (warnings no longer hidden): a log kept in memory, WARNING lines as toasts (once per message) | done |
| 8 | Detail panel: General / Format / Log tabs, action column, selection summary for several rows | done |
| 9 | "N interrupted · Resume" status-bar chip | done |
| 10 | Import links from a file (Add link › Import list: From clipboard / From file…), dropping `.list/.lst/.url` too | done |
| 11 | Free disk space under Save to (one shared folder field for the video dialog and the playlist page) | done |
| 12 | Already downloaded / already in the list: inline warning with Skip / Rename / Replace | done (channel Playlists tab not checked: those videos are only known after expanding) |
| 13 | Contrast test for built-in themes (Fg2/Fg3 ≥ 4.5:1) | done (Fg2/Fg3 on every surface: window, panels, bars, selection, hover, fields) |
| 14 | Linux: applications-menu entry for the AppImage, AppImage-safe autostart path, self-repair at startup | done, not tried with a real AppImage yet |
| 15 | Windows: the uninstaller removes the login entry (NSIS hook) | nothing to add: Tauri's NSIS uninstaller already deletes `HKCU\…\Run` "AvaTG" (the name tauri-plugin-autostart uses, productName) and skips it during updates (checked against tauri-bundler's installer.nsi, 2026-11-16) |
| 16 | Theme builder in Settings › Appearance: pick each colour with a live preview that shows where it is used; it writes the theme's JSON file as you edit. Theme cards get Edit, Duplicate, Export, Import (owner request, 2026-11-15) | done (design choices below are Claude's, for the owner to review) |

Choices made while building these (2026-11-16, not yet seen by the owner; change freely):
- **Columns**: Name fills the spare width until you resize it, then keeps its width (Explorer-like). Widths,
  order, visibility, sort and both filters are saved; the search is not. Header right-click: show/hide columns,
  Move left/right, Reset columns. Column headings are uppercase like before.
- **Detail panel**: 196 px (token `--h-panel`), tabs General / Format / Log; the Log is this session's yt-dlp
  output (not saved). A "Details" chip in the status bar and "Show details" in the row menu reopen it.
- **Warnings as toasts**: each distinct yt-dlp warning once per session (video ids stripped), so a playlist
  doesn't flood. They fade like other notices.
- **Duplicates**: Rename puts " (2)" after the title in the file name and on the row; Replace deletes the old
  file and row before downloading again. The channel Playlists tab is not checked (its videos are unknown until
  the playlists are read).
- **Theme builder**: Settings › Appearance › a card's "⋯" menu (Edit / Edit a copy… for built-ins, Duplicate,
  Export…, Remove… with a confirmation) and a "New theme" card that copies the current theme. The editor lists
  every token in groups with a swatch (system colour picker), an opacity slider and the `#AARRGGBB` value, next to
  a live preview built from the real controls; pointing at a colour outlines where it is used. It saves to
  `<id>.theme.json` 0.3 s after each change and the app shows it at once (the edited theme is selected). Renaming
  keeps the file id. Contrast warnings show under the preview.

## How to work

- `bun run tauri dev` runs the app; `bun run check` = tsc, eslint, vitest, rustfmt, clippy -D warnings, cargo test.
- Debug builds open the web inspector automatically (`lib.rs`).
- **Demo mode** (dev only): `bun run dev`, then open `http://127.0.0.1:1420/?demo` in a normal browser. Every Rust
  command is mocked in `src/dev/demo.ts` (one row per status, fake progress, no disk or network). Options:
  `&many=2000`, `&empty`, `&setup`. Handy for screenshots and for checking UI changes without a real download.
  `http://127.0.0.1:1420/?gallery` shows every shared control on each built-in theme, with a contrast report.
- Releases: see README "Releases and updates". Version lives in `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`
  and `package.json`; `release.yml` refuses a tag that does not match them or has no `CHANGELOG.md` section.
- Updater signing key: private key `~/.tauri/avatg.key`, password `~/.tauri/avatg.key.password` (owner's machine,
  never commit), also stored as repo secrets `TAURI_SIGNING_PRIVATE_KEY` / `_PASSWORD`. The public key is in
  `tauri.conf.json`. Losing the private key means installed apps can never update again.
- A local release build: `TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/avatg.key)"
  TAURI_SIGNING_PRIVATE_KEY_PASSWORD="$(cat ~/.tauri/avatg.key.password)" bun run tauri build --bundles rpm`
  (without them the updater-signature step fails).
- Real yt-dlp checks without the GUI: build the arguments with `buildArgs` from `src/lib/presets.ts` (bun script)
  and run yt-dlp with `ytdlp.rs`'s fixed arguments; test with a short video (e.g. "Me at the zoo", jNQXAC9IVRw).
  On the owner's network YouTube needs `--proxy http://127.0.0.1:10809` (their VPN proxy).

## Architecture

- **Rust** (`src-tauri/src`) only runs processes and manages files and storage. Errors are `String`s.
  `ytdlp.rs` (runs yt-dlp, progress lines `TGP|`/`TGPP|`/`TGF|`), `tools.rs` (install/version tools, system copies,
  chosen paths), `db.rs` (SQLite `<app data>/avatg.db`: one JSON recipe per download, settings key/value),
  `files.rs` (per-download working folders, delete files, description `.txt`), `proxy.rs` (proxy setting, desktop
  proxy), `blur.rs` (glass blur), `tray.rs` (tray, close to tray), `updater.rs` (self-update), `themes.rs`
  (imported theme files), `lib.rs` (plugins, setup, command list).
- **Frontend** (`src`): `ipc.ts` mirrors every Rust command and event (typed by hand; keep in sync).
  `lib/` is pure logic with tests: `presets.ts` (preset → yt-dlp args, the only place for format logic),
  `youtube.ts` (links and yt-dlp JSON), `links.ts`, `format.ts`, `toolVersions.ts`, `themes.ts`.
  `features/{downloads,picker,settings,appearance,tools,updates}` each hold a Zustand store, views and a CSS module.
  `components/` holds window chrome (`layout.tsx`, `ResizeGrips`, `WindowControls`, `DropOverlay`, `Toasts`) and
  `components/ui` the shared controls. `styles/tokens.css` holds the design tokens (colours overwritten at runtime by
  the theme). Built-in themes: `src/themes/*.theme.json`.
- The download queue runs in the frontend (`features/downloads/store.ts`); the webview keeps running while the window
  is hidden in the tray. The yt-dlp command is built from the recipe each time a download starts, so waiting,
  paused and retried downloads use the current settings.
- Not used, on purpose: shadcn/Tailwind (CSS Modules + tokens cover it), tauri-specta (release candidate), a router.

## Verified

- Real downloads with the app's exact arguments (yt-dlp 2026.10.26, through the owner's proxy): 1080p MP4 (H.264
  preferred), Best MKV, MP3, M4A; subtitles embedded only / separate / both; description file; plain file names
  with the per-download working folder. Post-processor keys: `Merger`, `Metadata`, `EmbedThumbnail`, `ExtractAudio`,
  `EmbedSubtitle`, `SubtitlesConvertor`, `FixupM4a`, `MoveFiles` (no `FFmpeg` prefix).
- Owner, in the app: downloads end to end; resizing; Cancel/Esc on the playlist page; scrolling dialogs;
  Pause/Resume and downloads-at-a-time applying at once; blur in dev and in the release RPM; system yt-dlp
  (`~/.local/bin`) and FFmpeg (`/usr/bin`) picked up automatically; the Cherry dark theme ("looks good").
- `v0.1.0` release run: Windows NSIS, macOS arm64 + x64 dmg, Linux deb/rpm/AppImage, `latest.json` with all
  platform entries, `.sig` files, SHA256SUMS. About 9 minutes (Rust compiles everything; owner declined speed-ups).

## Not built yet (carried over from AvaDM, owner wants these eventually)

- Rolling log files with "Open log folder", and a crash report that opens a prefilled GitHub issue.
- Tray menu listing running downloads with Pause/Resume (the tray has Open, Pause all, Add link from clipboard, Quit).
- Middle truncation of long titles (now: end ellipsis) and full-text tooltips on everything truncated.
- Pause/Cancel while an AvaTG update downloads (Tauri's updater downloads in one go).
- Blur on X11 sessions (`_KDE_NET_WM_BLUR_BEHIND_REGION`); Windows/macOS blur is written but untested.
- A suffix for two *different* videos with the same title in one folder (yt-dlp skips the second). The same video
  twice is handled now (Rename).

## Not verified yet

- Feature port, in the real Tauri app (checked only in the browser demo): column drag/resize in WebKitGTK, the
  detail panel with a real download's log, warning toasts, Import list › From file…, free space, Skip/Rename/
  Replace with real files, the theme builder's colour picker (GTK dialog) and Export….
- The AppImage applications-menu entry and the startup repair of it and of the login item (needs an AppImage).

- Tray: menu actions, tooltip, `--minimized` login launch; single instance.
- Drag and drop from Firefox and Chrome (`dragDropEnabled: false`), and dropping a theme `.json`.
- Channel tabs and channel playlist expansion against big real channels.
- Pre-release tags: the RPM build may reject versions with `-` (e.g. `0.2.0-rc.1`).
- Theme import from Settings, theme removal, the contrast warning, in the real app.

## Known issues and gotchas

- **Blank dev window behind a proxy.** A desktop-wide proxy without a localhost exception (KDE proxy settings +
  the owner's VPN proxy app) sent the webview's dev-server requests to the proxy. Fixed for dev builds by
  `GIO_USE_PROXY_RESOLVER=dummy` (`main.rs`, debug + Linux only) and Vite pinned to 127.0.0.1. Release builds load
  the frontend from inside the app.
- **AppImage environment.** The AppImage starts AvaTG with `LD_LIBRARY_PATH`, `PYTHONHOME`, `GST_PLUGIN_*` etc.
  pointing into the bundle. Passed on to child programs, a system FFmpeg loaded the bundle's GnuTLS and failed and a
  pip yt-dlp looked for Python in the bundle, so 0.2.0's AppImage downloaded tools the system already had. Every
  child program now runs with `hostenv::HostEnv` (also `open_external`, which replaces the opener plugin's
  openPath/openUrl; "show in folder" uses D-Bus and is fine).
- **AppImage crash on quit (0.2.0, Fedora 44 + NVIDIA laptop).** WebKitWebProcess aborted with
  `free(): corrupted unsorted chunks` in its exit handlers. The host Mesa/LLVM/NVIDIA EGL ran against the bundle's
  Ubuntu 22.04 GLib, Wayland, GStreamer, libelf, libzstd, libffi, systemd. Not reproduced on demand (5 tray quits
  were clean), so the fix is the known one (tauri-apps/tauri#15665): `.github/scripts/fix-appimage.sh` removes
  those libraries in the release workflow and the AppImage is signed again; `hostenv::prepare` drops the bundle's
  empty GStreamer plugin path. Checked locally: the stripped 0.2.0 renders, quits cleanly, and the page process
  loads only host copies of those libraries. libxml2 and ICU 70 stay bundled (WebKit needs ICU 70).
- **Do not set `WEBKIT_DISABLE_DMABUF_RENDERER`.** It was tried and caused parts of the window to stop repainting.
- **Blur timing.** The window needs a native surface first, so `blur.rs` applies the blur after the window is
  shown (retrying) and sends `window-blur`; asking from the page at startup was too early in release builds.
  KWin 6.8 offers only `ext_background_effect_v1` (not `org_kde_kwin_blur`); both are supported.
- **Canvas page saves stray pastes.** Twice a stray paragraph (a pasted URL / text) appeared in a board after the
  owner had the canvas open. The owner did not add them; when a publish is refused, diff the page's copy and drop
  such lines.
- `dnf install` of a rebuilt RPM with the same version needs `dnf reinstall`.
- The owner's old `tubegrab` RPM may still be installed (`pkexec dnf remove -y tubegrab`); its data was moved to
  `~/.local/share/com.mparnian.tubegrab.bak-dev` for the fresh-install test.

## Decisions (owner)

Ask the owner before inventing new UI rules; record answers here.

- **Stack**: Tauri 2 + React/TS, **bun** as the package manager.
- **Name and brand** (2026-11-15): **AvaTG**, identifier `org.avadm.avatg`, repo AvaDM-org/AvaTG. Logo = AvaDM's
  mark recoloured to cherry `#B0153A` (`assets/avatg-logo-1024.png`; icons generated with `bun run tauri icon`).
- **Look**: AvaDM's design system (`/data/projects/AvaDM/docs/DESIGN.md`). Default theme **Cherry dark** (accent
  `#EF4765` with dark text; Failed stays soft red, owner said keep it). **Dark glass** is a built-in theme too.
  No light theme.
- **Themes**: AvaDM's JSON format (`#AARRGGBB`, AvaDM themes import as they are), missing tokens fall back to Dark
  glass, imported files in `<app data>/themes`, import from Settings › Appearance or by dropping a `.json`.
- **Glass**: real blur like AvaDM (see gotchas). A strength slider in Settings › Appearance; without blur the window
  stays at least 88% opaque.
- **Tray app like AvaDM**: closing hides to the tray, downloads continue, launch at login starts in the tray.
  **No scheduler or queues in v1.**
- **Settings pages**: General, Appearance, Downloads, Files, Tools, Storage, About & updates. Apply immediately.
  Defaults: **1 download at a time**, 4 parts per download, 10 retries, 20 s stall timeout, 3 automatic resumes,
  description file off, proxy "System".
- **Downloads**: one recipe per download in SQLite; yt-dlp's `.part` files resume. File names `Title.ext` (no id).
  Speed limit per download only. Running downloads keep their settings until paused and resumed.
- **Pause all / Resume all**: status-bar chip and tray item. Pause all pauses running downloads and **holds waiting
  ones: nothing starts until Resume all**. (Owner wants this in AvaDM too, later.)
- **Subtitles** offered per download, including auto-generated captions; a setting picks embedded / separate /
  both. **Description** can be saved as a `.txt` next to the video.
- **Tools**: not bundled (not even FFmpeg). Each tool can be the system copy (auto-detected), AvaTG's downloaded
  copy, or a custom file; version rules Deno ≥ 2.3, FFmpeg ≥ 5, yt-dlp warned after ~90 days. Each tool links its
  official GitHub page. Deno's cache lives in AvaTG's data folder (`DENO_DIR`).
- **Proxy**: System (KDE, GNOME, Windows, macOS, env vars) / Custom URL / None; used by yt-dlp, tool downloads and
  the updater. Needed on the owner's network.
- **Updates like AvaDM**: tag → draft release → owner publishes. Check on launch, "Update now" notice, include
  pre-releases switch. Every install type updates in place and restarts (owner, 2026-11-15: "all platforms should
  update the same"); `.deb`/`.rpm` go through `pkexec`, so the system asks for a password. Signed. Copies before
  0.2.1 installed from `.deb`/`.rpm` still open the release page once.
- **Release builds**: Windows NSIS, macOS arm64 + x64, Linux deb + rpm + AppImage. Owner declined build speed-ups.

## Claude Code setup for this repo

- Official plugins (project scope, `.claude/settings.json`): `rust-analyzer-lsp`, `typescript-lsp` (needs
  `typescript-language-server` on PATH: `bun add -g typescript-language-server typescript`), `code-simplifier`.
- Skills in `.claude/skills/`: Vercel's `react-best-practices` and `composition-patterns` (MIT). Their Next.js/server
  rules do not apply. There is no official Tauri skill.
- Linux build packages (Fedora): `webkit2gtk4.1-devel libappindicator-gtk3-devel librsvg2-devel libxdo-devel`.
