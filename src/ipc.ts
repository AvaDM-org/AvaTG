// Typed wrappers for every Rust command and event (src-tauri/src). Keep in sync with the #[tauri::command]s.
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export type ToolId = "ytdlp" | "deno" | "ffmpeg";

export interface ToolInfo {
  id: ToolId;
  name: string;
  installed: boolean;
  version: string | null;
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
  kind: "progress" | "postprocess" | "file";
  status?: string;
  downloaded?: number;
  total?: number;
  speed?: number;
  eta?: number;
  postprocessor?: string;
  filepath?: string;
}

export type TrayAction = "pauseAll" | "paste";

// tools.rs
export const toolsStatus = () => invoke<ToolInfo[]>("tools_status");
export const installTool = (id: ToolId) => invoke<ToolInfo>("install_tool", { id });
export const latestVersions = () => invoke<LatestVersions>("latest_versions");
export const toolsDir = () => invoke<string>("open_bin_dir");

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
export const deletePartials = (dir: string, videoId: string) => invoke<number>("delete_partials", { dir, videoId });
export const deleteFiles = (paths: string[]) => invoke<void>("delete_files", { paths });
export const renameDescription = (videoPath: string) => invoke<void>("rename_description", { videoPath });

// proxy.rs
/** null: let yt-dlp use proxy environment variables; "": connect directly; else a proxy URL. */
export const setProxy = (url: string | null) => invoke<void>("set_proxy", { url });
export const systemProxy = () => invoke<string | null>("system_proxy");

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
