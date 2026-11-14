# AvaTG

A simple cross-platform desktop app for downloading from YouTube, built with **Tauri 2 + React + TypeScript**.
It uses [yt-dlp](https://github.com/yt-dlp/yt-dlp), [Deno](https://deno.com) (the JavaScript runtime yt-dlp needs for
YouTube) and [ffmpeg](https://ffmpeg.org). The app downloads these tools on first run and can update them later.

## What it does

Paste a link and press **Go** (or just paste it; the app starts on paste):

| Link | What you get |
|---|---|
| Video (`watch?v=`, `youtu.be`, `shorts/`) | Thumbnail and title, preset chips, mode (video+audio / video only / audio only), the video's **real** resolutions with size estimates, container or audio format, bitrate, extras |
| Playlist (`/playlist?list=`) | A list where everything starts selected: checkboxes, **shift-click ranges**, All / None / Invert, title filter, selected count and total length. Preset panel on the side |
| Channel (`/@handle`, `/channel/…`, `/c/…`, `/user/…`) | **Videos / Shorts / Playlists** tabs. Pick any mix. Each selected playlist is expanded into its videos and saved in its own folder |
| `watch?v=…&list=…` | Treated as a single video, with a banner to open the whole playlist |
| Any other site yt-dlp supports | Video or playlist view, depending on what yt-dlp returns |

Downloads go to a queue on the right. You get progress, speed, ETA, and the current step (merging, converting,
embedding). Each job can be cancelled or retried, and finished files can be played or shown in their folder.
You can set 1–4 downloads to run at once.

Quick presets: **Best quality** (MKV), **1080p MP4**, **720p MP4**, **MP3 audio**, **M4A audio** (no re-encode).
Extras: embed thumbnail, metadata and chapters, subtitles (choose the languages), and SponsorBlock removal.
Settings: output folder, parallel downloads, cookies from a browser (for age-restricted or members-only videos), and a tools panel.

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
src/ipc.ts                 every Rust command and event, typed
src/lib/                   pure logic with tests: presets → yt-dlp args, links, formatting, tool versions
src/features/              downloads, picker (video dialog, playlist/channel page), settings, tools, updates
src/components/            window chrome and shared controls; src/styles/tokens.css is the theme
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
into one **draft** release with `latest.json` (the update feed) and `SHA256SUMS.txt`; publish it by hand.

1. Set the same version in `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` and `package.json`.
2. Add a `## [X.Y.Z]` section to `CHANGELOG.md` (it becomes the release notes).
3. `git tag vX.Y.Z && git push origin vX.Y.Z` (a pre-release: `vX.Y.Z-rc.N`).

The app checks `releases/latest` (or the highest release, pre-releases included, when that setting is on).
Windows, macOS and the AppImage update themselves; `.deb`/`.rpm` installs open the release page. Updates are signed:
the public key is in `tauri.conf.json`, the private key and its password are the repo secrets
`TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. Losing the private key means installed copies
can no longer update. A local `tauri build` needs the same two values as environment variables.

## Known limitations

- Single-file PyInstaller `yt-dlp.exe` unpacks itself on every start, which adds about 1 s per call. The onedir
  `yt-dlp_win.zip` is faster, but it is a folder rather than one file.
- Reading a large channel (thousands of videos) with `--flat-playlist` can take a while. It is shown as a spinner.
- Cookies-from-browser for Chromium browsers on Windows may fail while the browser is open (a yt-dlp limitation).
- yt-dlp `--print`/progress output from the same process is assumed to be UTF-8 (`PYTHONUTF8=1` is set).
