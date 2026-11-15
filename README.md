# AvaTG

A cross-platform desktop app for downloading videos and audio from YouTube (and any site yt-dlp supports), built
with **Tauri 2 + React + TypeScript** and designed like its sibling [AvaDM](https://github.com/AvaDM-org/AvaDM).
It uses [yt-dlp](https://github.com/yt-dlp/yt-dlp), [Deno](https://github.com/denoland/deno) (the JavaScript runtime
yt-dlp needs for YouTube) and [FFmpeg](https://ffmpeg.org): copies already on your system are used when their
versions are good, and the rest are downloaded once.

## What it does

Add a link with **Ctrl+V**, the clipboard button, **Add link**, or by dropping it on the window:

| Link | What you get |
|---|---|
| Video (`watch?v=`, `youtu.be`, `shorts/`) | A dialog: preset menu, video and audio / video only / audio only, the video's **real** resolutions with size estimates, format, subtitles (with auto captions), description, thumbnail, chapters, SponsorBlock |
| Playlist (`/playlist?list=`) | A page where everything starts selected: checkboxes, **Shift-click ranges**, Select all / none / Invert, title filter, total length, format panel on the side |
| Channel (`/@handle`, `/channel/…`, `/c/…`, `/user/…`) | **Videos / Shorts / Playlists** tabs; pick any mix; each playlist gets its own folder |
| Several links at once | One list of all their videos |

Downloads land in the main list (search, status filter, sort, multi-select, right-click menu) with progress, speed,
time left and the current step. Pause, resume (continues from the partial file), cancel, retry, **Pause all**.
AvaTG lives in the tray, so downloads continue with the window closed. Settings: download folder, downloads at a
time, per-download speed limit, retries, proxy (system, custom or none), subtitles mode, cookies from a browser,
themes (Cherry dark, Dark glass, or your own JSON), glass effect, tools, updates.

## How the tools are shipped and updated

**Decision (made by the owner): download on first run.** The installer contains no third-party binaries. On first
launch a setup screen downloads them into the per-user app data folder:

| OS | Tools folder |
|---|---|
| Windows | `%LOCALAPPDATA%\org.avadm.avatg\bin` |
| macOS | `~/Library/Application Support/org.avadm.avatg/bin` |
| Linux | `~/.local/share/org.avadm.avatg/bin` |

That folder is always writable by the user, so updating needs no admin rights and no app reinstall.
**Settings → Tools** shows the installed versions. **Check for updates** compares them with the latest GitHub
release tag. It reads the `releases/latest` redirect, which avoids GitHub's API rate limit. **Update** or
**Reinstall** downloads the tool again and swaps it in atomically.

| Tool | Source (verified 2026-11-14) | Notes |
|---|---|---|
| yt-dlp | `github.com/yt-dlp/yt-dlp/releases/latest/download/<asset>`: `yt-dlp.exe`, `yt-dlp_arm64.exe`, `yt-dlp_macos` (universal), `yt-dlp_linux`, `yt-dlp_linux_aarch64` | The official executables already include the EJS challenge-solver scripts (yt-dlp wiki: EJS), so nothing else is needed |
| Deno | `github.com/denoland/deno/releases/latest/download/deno-<target-triple>.zip` | yt-dlp enables Deno by default; minimum version 2.3.0. We pass `--js-runtimes deno:<path>` |
| ffmpeg + ffprobe, Windows | `github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-{win64,winarm64}-gpl.zip` | yt-dlp's own builds. That project has **no macOS builds** |
| ffmpeg + ffprobe, macOS/Linux | `ffmpeg.martin-riedl.de/redirect/latest/{macos,linux}/{amd64,arm64}/release/{ffmpeg,ffprobe}.zip` | The site's documented "scripting URLs". The macOS zips are signed. Intel macOS release builds stop in Jan 2027 (per that site) |

ffmpeg has no simple "latest version" feed, so the app always offers **Reinstall** for it.

### The other options that were considered

1. **Bundle + self-update.** Ship the binaries as Tauri `externalBin` sidecars, copy them to app data on first run,
   then update them there. Works offline on first run, but the installer is about 250 MB bigger. Updating sidecars
   in place does not work: Program Files needs admin rights, and changing files breaks the macOS app signature.
   So the copy step would be required.
2. **Bundle only, update by releasing the app** (Tauri updater plugin). This is the simplest, but every time
   YouTube changes, users wait for a new app release.

## Project layout

```
src-tauri/src/ytdlp.rs     runs yt-dlp: -J metadata queries, downloads with progress events, stop
src-tauri/src/tools.rs     installs/versions yt-dlp, Deno, FFmpeg (download URLs live here); finds system copies
src-tauri/src/db.rs        SQLite: one JSON "recipe" per download, and the settings
src-tauri/src/files.rs     per-download working folders (.avatg-parts), deleting files, description → .txt
src-tauri/src/proxy.rs     the proxy setting and reading the desktop's proxy
src-tauri/src/blur.rs      glass blur behind the window (Wayland ext_background_effect, KWin, window-vibrancy)
src-tauri/src/tray.rs      tray menu, close to tray
src-tauri/src/updater.rs   AvaTG's own updates from GitHub releases
src-tauri/src/desktop.rs   Linux AppImage applications-menu entry; repairs it and the login item at startup; opening files
src-tauri/src/hostenv.rs   programs AvaTG starts get the user's environment, not the AppImage's library paths
src/ipc.ts                 every Rust command and event, typed
src/lib/                   pure logic with tests: presets → yt-dlp args, links, formatting, tool versions
src/features/              downloads, picker (video dialog, playlist/channel page), settings, tools, updates
src/components/            window chrome, shared controls, DataTable (columns, sorting, virtual rows), DetailPanel;
                           src/styles/tokens.css is the theme
src/dev/                   dev only: ?demo (browser run with mocked Rust commands) and ?gallery; never in releases
```

Design rule: Rust only runs processes and manages files. All yt-dlp format and preset logic is in TypeScript.

## Build

Prerequisites: Bun 1.x, Rust (stable, via rustup), and the platform prerequisites from
<https://v2.tauri.app/start/prerequisites/>: MSVC C++ Build Tools + WebView2 on Windows, Xcode CLT on macOS,
and on Linux (Fedora names) `webkit2gtk4.1-devel libappindicator-gtk3-devel librsvg2-devel libxdo-devel`.

```bash
bun install
bun run tauri dev      # run in development
bun run check          # tsc, eslint, vitest, rustfmt, clippy, cargo test
bun run tauri build    # installers in src-tauri/target/release/bundle (needs the signing key, see below)
```

## Releases and updates

Like AvaDM. `.github/workflows/check.yml` checks every push and pull request. `.github/workflows/release.yml`
runs on a version tag and builds Windows (NSIS), macOS (Apple Silicon and Intel), Linux `.deb`, `.rpm` and AppImage
into one **draft** release with `latest.json` (the update feed) and `SHA256SUMS.txt`; publish it by hand. The
AppImage is then rebuilt without the core system libraries linuxdeploy bundles (`.github/scripts/fix-appimage.sh`
explains why) and signed again.

1. Set the same version in `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` and `package.json`.
2. Add a `## [X.Y.Z]` section to `CHANGELOG.md` (it becomes the release notes).
3. `git tag vX.Y.Z && git push origin vX.Y.Z` (a pre-release: `vX.Y.Z-rc.N`).

The app checks `releases/latest` (or the highest release, pre-releases included, when that setting is on).
Every install type updates itself in place and restarts; `.deb`/`.rpm` installs ask for the system password first
(the updater installs the package with `pkexec`). Updates are signed:
the public key is in `tauri.conf.json`, the private key and its password are the repo secrets
`TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. Losing the private key means installed copies
can no longer update. A local `tauri build` needs the same two values as environment variables.

## Known limitations

- Single-file PyInstaller `yt-dlp.exe` unpacks itself on every start, which adds about 1 s per call. The onedir
  `yt-dlp_win.zip` is faster, but it is a folder rather than one file.
- Reading a large channel (thousands of videos) with `--flat-playlist` can take a while. It is shown as a spinner.
- Cookies-from-browser for Chromium browsers on Windows may fail while the browser is open (a yt-dlp limitation).
- yt-dlp `--print`/progress output from the same process is assumed to be UTF-8 (`PYTHONUTF8=1` is set).
