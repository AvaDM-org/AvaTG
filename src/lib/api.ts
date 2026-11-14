// Thin typed wrappers around the Rust commands in src-tauri/src.
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

export const toolsStatus = () => invoke<ToolInfo[]>("tools_status");
export const installTool = (id: ToolId) => invoke<ToolInfo>("install_tool", { id });
export const latestVersions = () =>
  invoke<{ ytdlp: string | null; deno: string | null }>("latest_versions");
export const binDir = () => invoke<string>("open_bin_dir");

export const ytdlpJson = (url: string, flat: boolean, cookiesBrowser?: string) =>
  invoke<any>("ytdlp_json", { url, flat, cookiesBrowser: cookiesBrowser || null });

export const runDownload = (id: string, url: string, args: string[], cookiesBrowser?: string) =>
  invoke<string | null>("run_download", { id, url, args, cookiesBrowser: cookiesBrowser || null });

export const cancelDownload = (id: string) => invoke<void>("cancel_download", { id });

export const onToolProgress = (cb: (p: ToolProgress) => void): Promise<UnlistenFn> =>
  listen<ToolProgress>("tool-progress", (e) => cb(e.payload));

export const onDownloadEvent = (cb: (p: DownloadEvent) => void): Promise<UnlistenFn> =>
  listen<DownloadEvent>("download-progress", (e) => cb(e.payload));
