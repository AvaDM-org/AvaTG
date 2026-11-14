# Progress

## Status (2026-11-14)

**The redesigned app builds and runs on Linux (Fedora 44, KDE Wayland).** `bun run tauri dev` starts it; the
first launch shows the one-time tools setup. `bun run check` (tsc, eslint, vitest, rustfmt, clippy -D warnings,
cargo test) passes.

### Architecture (approved 2026-11-14)
- Rust (`src-tauri/src`): `ytdlp.rs` runs yt-dlp, `tools.rs` installs the tools, `db.rs` stores download recipes and
  settings in SQLite (`<app data>/avatg.db`, JSON document per download), `files.rs` deletes partial files and
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
- **Glass blur** (`blur.rs`): works on the owner's KDE Plasma 6.8 (Wayland) through the standard
  `ext_background_effect_v1` protocol; KWin before 6.8 uses `org_kde_kwin_blur`. Windows (acrylic) and macOS
  (vibrancy) use `window-vibrancy` but are untested. The blur is asked for when the page first calls `window_blur`
  (the window must be on screen); without blur the window stays at most 12% see-through, with blur 40%.
  X11 sessions get no blur yet (`_KDE_NET_WM_BLUR_BEHIND_REGION` would add it).

- In the app (owner, 2026-11-14): downloads work end to end; the repaint glitch (parts of the window disappearing
  on click) went away after dropping the `WEBKIT_DISABLE_DMABUF_RENDERER` override.

- File names are `Title.ext` (`001 - Title.ext` in numbered playlists), no `[id]`. Unfinished files live in a
  per-download working folder `<download folder>/.avatg-parts/<download id>/` (`--paths temp:`); Cancel,
  Remove and finishing delete it. Checked with a real download. Two different videos with the same title in one
  folder now share a file name, and yt-dlp skips the second as already downloaded (rare; could add a suffix).

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
The mockups live in the Claude design canvas "AvaTG main window":
https://claude.ai/artifact/QkT75qvfYzuqEXLTHNdXEo


### Small features to carry over from AvaDM (owner: keep them)
Collected from AvaDM's git history and CHANGELOG. Each needs a AvaTG equivalent:
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
- Project name: avatg.
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
- Tools (2026-11-14): FFmpeg is **not bundled**. Each tool (yt-dlp, Deno, FFmpeg) can come from AvaTG's own
  downloaded copy, a copy installed on the system (found automatically), or a custom file the user picks. A version
  map decides what is accepted (Deno ≥ 2.3, FFmpeg ≥ 5, yt-dlp warned when older than ~90 days); the downloaded copy
  is the fallback.
- Proxy (2026-11-14): YouTube is unreachable on the owner's network without a proxy. Settings > Downloads > Network:
  use the system proxy (default; KDE, GNOME, Windows, macOS settings or proxy environment variables), a custom proxy
  URL (http, https, socks5), or none. Used by yt-dlp (`--proxy`) and by the tools download.
- Window glass (2026-11-14): real blur like AvaDM. Windows/macOS via `window-vibrancy`; KDE via KWin's
  `org_kde_kwin_blur` Wayland protocol (native Wayland, X11 property as fallback); solid fallback elsewhere.
- Brand and themes (2026-11-15, designed on the canvas, not built yet): the app is renamed **AvaTG**. Logo = AvaDM's
  mark recoloured to cherry (`#B0153A`). New default theme **Cherry dark** (accent `#EF4765`, dark text on it);
  **Dark glass** stays as a built-in theme. Theming like AvaDM: one JSON file of colour tokens per theme in AvaDM's
  format (`#AARRGGBB`, so AvaDM themes import as they are), built-ins inside the app, imported ones in a themes
  folder, theme cards plus "Import theme…" in Settings › Appearance (which comes back, with the glass slider).
- Download records (2026-11-14): keep one **"recipe" per download in SQLite** (link, format choice, folder, status),
  like AvaDM. yt-dlp's own `.part` files do the byte-level resuming; Resume re-runs the same command. No AvaDM-style
  working files.

## Claude Code setup for this repo
- Official plugins (project scope, `.claude/settings.json`): `rust-analyzer-lsp`, `typescript-lsp`
  (needs `typescript-language-server` on PATH; installed with `bun add -g typescript-language-server typescript`),
  `code-simplifier`.
- Skills in `.claude/skills/`: Vercel's `react-best-practices` and `composition-patterns` (vercel-labs/agent-skills,
  MIT). Their Next.js/server rules do not apply to this app. There is no official Tauri skill.
