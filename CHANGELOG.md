# Changelog

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
