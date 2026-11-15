# Changelog

## [Unreleased]

### Fixed
- Windows: yt-dlp's messages and video titles showed "�" in place of characters like ’ (yt-dlp now writes UTF-8).
- "Sign in to confirm you're not a bot" and similar YouTube errors now say what to do in AvaTG (choose a browser
  for cookies in Settings › Files › Account) instead of showing yt-dlp's command-line advice.
- Windows: "Could not copy Chrome cookie database" now explains that Chrome, Edge and other Chromium browsers lock
  and encrypt their cookies on Windows, and suggests Firefox. Choosing one of them for cookies shows the same warning.
- Narrow windows: the top bar no longer pushed the minimize, maximize and close buttons out of the window. Below
  1120 px the filters show their name or value only and the selection buttons only their icons.
- The Linux AppImage's removal of the bundled system libraries (the crash fix listed under 0.2.1) did not run for
  the 0.2.1 release; it is in this one.

## [0.2.1] - 2026-11-15

### Fixed
- Updates install in place on every install type. `.deb` and `.rpm` installs no longer open the release page: the
  update is downloaded and installed after the system asks for your password, then AvaTG restarts.
- The Linux AppImage no longer asks to download yt-dlp and FFmpeg when they are already installed on the system.
  Programs started from the AppImage (tools, and the apps that open files and links) now run with your normal
  environment.
- The Linux AppImage could crash when quitting on newer distros (seen on Fedora 44). It now uses the system's own
  GLib, Wayland, GStreamer and related libraries instead of older bundled copies.

## [0.2.0] - 2026-11-15

### Downloads list
- Columns can be dragged to reorder, resized from their edge, and shown or hidden from the header's right-click
  menu (with Reset columns). Click a header to sort; click again to reverse.
- New columns: Added, Channel, Length, Took, Avg speed and Folder.
- A Type filter (Video / Audio). Columns, sort and filters are remembered.
- Long lists stay fast: only the rows on screen are drawn.
- Downloads now record how long they took, their average speed and the real file size.
- A detail panel for the selection, with General, Format and Log (yt-dlp's output) tabs, and a summary when
  several downloads are selected. Toggle it with the Details chip.
- yt-dlp warnings appear as notifications, each one once per session.
- A "N interrupted · Resume" chip for downloads that were running when AvaTG closed.

### Adding downloads
- Add link › Import list: links from the clipboard or a text file. Dropping `.txt`, `.list`, `.lst` or `.url`
  files works too.
- Free disk space under Save to, with a warning when the download won't fit.
- Videos already downloaded to the same folder in the same format: Skip, Rename (adds " (2)") or Replace.

### Themes
- A theme builder: edit every colour with a live preview that outlines where it is used. Changes are saved to the
  theme's file as you go.
- Theme cards have Edit, Duplicate, Export and Remove, and there is a New theme card.
- Text contrast is checked on every surface (panels, bars, selected and hovered rows, fields).

### Other
- The Linux AppImage can add itself to the applications menu (Settings › General).
- Login and menu entries point at the current copy of AvaTG again after it moves.
- The database is backed up before a schema upgrade.
- Fixed menu items with a checkmark having their labels pushed to the right.

## [0.1.0] - 2026-11-15

First release of AvaTG: YouTube video, playlist and channel downloads with yt-dlp, an AvaDM-style interface,
tray app, Pause all, proxy support, system or downloaded tools, and self-updates.
