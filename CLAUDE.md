# AvaTG: notes for agents

- Read `PROGRESS.md` (status, next steps, owner decisions, gotchas) and `README.md` (layout, build, releases) first.
  Update `PROGRESS.md` and commit after each item. Branch `main`, pushed to github.com/AvaDM-org/AvaTG (public).
- Features belong to the owner. Ask before inventing new UI rules, and record the decisions in `PROGRESS.md`.
  The design is AvaDM's (`/data/projects/AvaDM/docs/DESIGN.md`); mockups live in the canvas linked in PROGRESS.md.
  Design changes go on the canvas first when the owner asks for that.
- Run `bun run check` before every commit (tsc, eslint, vitest, rustfmt, clippy -D warnings, cargo test).
- Rust (`src-tauri/src`) only runs processes and manages files. Put yt-dlp format and preset logic in
  `src/lib/presets.ts` and metadata parsing in `src/lib/youtube.ts`, not in Rust. Every Rust command has a typed
  wrapper in `src/ipc.ts`; keep them in sync.
- No raw colours, sizes or radii in components: use the variables in `src/styles/tokens.css`. Colours come from the
  active theme (`src/lib/themes.ts`, `src/themes/*.theme.json`, AvaDM's `#AARRGGBB` format).
- Tool download URLs live only in `src-tauri/src/tools.rs`. If you change them, re-check them against the live
  release pages and update the README table with the date.
- yt-dlp needs a JS runtime for YouTube. Deno is passed explicitly with `--js-runtimes deno:<path>`. Do not remove it.
- yt-dlp/FFmpeg-Builds has no macOS builds. macOS and Linux ffmpeg comes from martin-riedl.de.
- Releases: bump the version in `tauri.conf.json`, `Cargo.toml` and `package.json`, add a `CHANGELOG.md` section,
  then tag `vX.Y.Z`. The release is a draft; only the owner publishes. Never commit the updater signing key
  (`~/.tauri/avatg.key*`); it is a repo secret.
- Do not set `WEBKIT_DISABLE_DMABUF_RENDERER` (it broke repainting). On the owner's machine YouTube needs their
  VPN proxy; see PROGRESS.md "How to work".
