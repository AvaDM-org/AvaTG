// Typed wrappers for every Rust command and event (src-tauri/src). Keep in sync with the #[tauri::command]s.
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type { ToolId } from "./lib/toolVersions";
export type { ToolId };

export interface ToolInfo {
  id: ToolId;
  name: string;
  /** AvaTG's own downloaded copy */
  installed: boolean;
  version: string | null;
  appPath: string;
  /** a copy found on the system PATH */
  system: { path: string; version: string | null } | null;
}

export interface ToolProgress {
  id: ToolId;
  stage: "download" | "extract" | "done";
  downloaded: number;
  total: number | null;
}

export interface LatestVersions {
  ytdlp: string | null;
  deno: string | null;
}

/** A line of yt-dlp output, parsed in ytdlp.rs. */
export interface DownloadEvent {
  id: string;
  kind: "progress" | "postprocess" | "file" | "log";
  status?: string;
  downloaded?: number;
  total?: number;
  speed?: number;
  eta?: number;
  postprocessor?: string;
  filepath?: string;
  /** "log": one line of yt-dlp's output and how serious it is */
  message?: string;
  level?: LogLevel;
}

export type LogLevel = "info" | "warning" | "error";

export type TrayAction = "pauseAll" | "paste";

// tools.rs
export const toolsStatus = () => invoke<ToolInfo[]>("tools_status");
export const installTool = (id: ToolId) => invoke<ToolInfo>("install_tool", { id });
export const latestVersions = () => invoke<LatestVersions>("latest_versions");
export const toolsDir = () => invoke<string>("open_bin_dir");
export const toolVersion = (id: ToolId, path: string) => invoke<string | null>("tool_version", { id, path });
/** The executable to run for each tool; tools left out use AvaTG's own copy. */
export const setToolPaths = (paths: Partial<Record<ToolId, string>>) => invoke<void>("set_tool_paths", { paths });

// ytdlp.rs
/** Raw yt-dlp JSON; lib/youtube.ts reads it. */
export const ytdlpJson = (url: string, flat: boolean, cookiesBrowser: string) =>
  invoke<unknown>("ytdlp_json", { url, flat, cookiesBrowser: cookiesBrowser || null });
/** Resolves with the final file path; rejects with an error message, or "cancelled" when stopped. */
export const runDownload = (id: string, url: string, args: string[], cookiesBrowser: string) =>
  invoke<string | null>("run_download", { id, url, args, cookiesBrowser: cookiesBrowser || null });
export const stopDownload = (id: string) => invoke<void>("cancel_download", { id });

// db.rs
export const loadDownloads = <T>() => invoke<T[]>("downloads_list");
export const saveDownloads = <T>(records: T[]) => invoke<void>("downloads_save", { records });
export const deleteDownloads = (ids: string[]) => invoke<void>("downloads_delete", { ids });
export const loadSettings = () => invoke<Record<string, unknown>>("settings_load");
export const saveSetting = (key: string, value: unknown) => invoke<void>("settings_save", { key, value });

// files.rs
/** Deletes a download's working folder of unfinished files (`<download folder>/.avatg-parts/<id>`). */
export const deleteParts = (dir: string) => invoke<void>("delete_parts", { dir });
export const deleteFiles = (paths: string[]) => invoke<void>("delete_files", { paths });
/** Each file's size in bytes, or null when it doesn't exist. */
export const fileSizes = (paths: string[]) => invoke<(number | null)[]>("file_sizes", { paths });
/** Free space in bytes on the disk that holds this folder (or would hold it). */
export const freeSpace = (path: string) => invoke<number>("free_space", { path });
/** The text of a list of links the user picked (at most 2 MB). */
export const readLinkList = (path: string) => invoke<string>("read_link_list", { path });
export const renameDescription = (videoPath: string) => invoke<void>("rename_description", { videoPath });

// desktop.rs
/** The Linux AppImage's own applications-menu entry; `available` is false everywhere else. */
export const menuEntryStatus = () => invoke<{ available: boolean; installed: boolean }>("menu_entry_status");
export const setMenuEntry = (enabled: boolean) => invoke<void>("menu_entry_set", { enabled });

// proxy.rs
/** null: let yt-dlp use proxy environment variables; "": connect directly; else a proxy URL. */
export const setProxy = (url: string | null) => invoke<void>("set_proxy", { url });
export const systemProxy = () => invoke<string | null>("system_proxy");

// blur.rs
/** Whether the OS blurs what is behind the window (KWin, Windows acrylic, macOS vibrancy). */
export const windowBlur = () => invoke<boolean>("window_blur");
/** Sent once the blur has been applied (or refused) after the window first appears. */
export const onWindowBlur = (cb: (granted: boolean) => void): Promise<UnlistenFn> =>
  listen<boolean>("window-blur", (e) => cb(e.payload));

// updater.rs
export interface UpdateInfo {
  version: string;
  current: string;
  notes: string | null;
  prerelease: boolean;
  releasePage: string;
}
/** "auto": AvaTG can update itself; "package": installed by a package manager (.deb/.rpm), open the release page. */
export const installChannel = () => invoke<"auto" | "package">("install_channel");
export const updateCheck = (includePrereleases: boolean) =>
  invoke<UpdateInfo | null>("update_check", { includePrereleases });
/** Downloads, installs and restarts AvaTG. */
export const updateInstall = () => invoke<void>("update_install");
export const onUpdateProgress = (cb: (p: { downloaded: number; total: number | null }) => void): Promise<UnlistenFn> =>
  listen<{ downloaded: number; total: number | null }>("update-progress", (e) => cb(e.payload));

// themes.rs
export const themesList = () => invoke<string[]>("themes_list");
/** Reads a .json file the user picked or dropped (at most 64 KB). */
export const themeRead = (path: string) => invoke<string>("theme_read", { path });
export const themeSave = (id: string, text: string) => invoke<void>("theme_save", { id, text });
export const themeRemove = (id: string) => invoke<void>("theme_remove", { id });
export const themesFolder = () => invoke<string>("themes_folder");
/** Writes a theme's JSON to a path picked with the save dialog. */
export const themeExport = (path: string, text: string) => invoke<void>("theme_export", { path, text });

// tray.rs
export const updateTray = (tooltip: string, allPaused: boolean) => invoke<void>("tray_update", { tooltip, allPaused });
export const setCloseToTray = (enabled: boolean) => invoke<void>("set_close_to_tray", { enabled });

// events
export const onToolProgress = (cb: (p: ToolProgress) => void): Promise<UnlistenFn> =>
  listen<ToolProgress>("tool-progress", (e) => cb(e.payload));
export const onDownloadEvent = (cb: (p: DownloadEvent) => void): Promise<UnlistenFn> =>
  listen<DownloadEvent>("download-progress", (e) => cb(e.payload));
export const onTrayAction = (cb: (a: TrayAction) => void): Promise<UnlistenFn> =>
  listen<TrayAction>("tray-action", (e) => cb(e.payload));
