// App settings. Saved to SQLite one key at a time; every change applies immediately (no Save button).
import { downloadDir } from "@tauri-apps/api/path";
import { create } from "zustand";
import { loadSettings, saveSetting, setCloseToTray, setProxy, systemProxy } from "../../ipc";
import { DEFAULT_THEME_ID } from "../../lib/themes";
import { DEFAULT_PRESET, type DownloadOptions, type Preset, type SubtitleMode } from "../../lib/presets";
import type { ToolChoice, ToolId } from "../../lib/toolVersions";

export interface Settings {
  // General
  resumeOnLaunch: boolean;
  closeToTray: boolean;
  doubleClick: "play" | "folder";
  /** 0 = solid window, 100 = full glass */
  glass: number;
  /** a built-in or imported theme (Settings › Appearance) */
  themeId: string;
  // Downloads
  outputDir: string;
  concurrency: number;
  fragments: number;
  limitOn: boolean;
  limitMbps: number;
  retries: number;
  socketTimeout: number;
  autoResume: number;
  /** "system": the desktop's proxy setting; "custom": `proxyUrl`; "none": connect directly */
  proxyMode: "system" | "custom" | "none";
  proxyUrl: string;
  // Files
  subtitleMode: SubtitleMode;
  autoCaptions: boolean;
  subLangs: string[];
  playlistFolder: boolean;
  numberFiles: boolean;
  /** "" = no cookies, else a browser for --cookies-from-browser */
  cookiesBrowser: string;
  // About & updates
  checkUpdates: boolean;
  includePrereleases: boolean;
  // Tools
  checkToolUpdates: boolean;
  /** where each tool comes from: automatic (system if good, else AvaTG's), AvaTG's copy, or a custom file */
  toolSources: Record<ToolId, ToolChoice>;
  /** the last choices made in a picker, used as the starting point next time */
  preset: Preset;
}

export const DEFAULTS: Settings = {
  resumeOnLaunch: true,
  closeToTray: true,
  doubleClick: "play",
  glass: 80,
  themeId: DEFAULT_THEME_ID,
  outputDir: "",
  concurrency: 1,
  fragments: 4,
  limitOn: false,
  limitMbps: 5,
  retries: 10,
  socketTimeout: 20,
  autoResume: 3,
  proxyMode: "system",
  proxyUrl: "",
  subtitleMode: "embed",
  autoCaptions: true,
  subLangs: ["en"],
  playlistFolder: true,
  numberFiles: true,
  cookiesBrowser: "",
  checkUpdates: true,
  includePrereleases: false,
  checkToolUpdates: true,
  toolSources: {
    ytdlp: { source: "auto", customPath: "" },
    deno: { source: "auto", customPath: "" },
    ffmpeg: { source: "auto", customPath: "" },
  },
  preset: DEFAULT_PRESET,
};

interface SettingsStore {
  settings: Settings;
  loaded: boolean;
  load: () => Promise<void>;
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}

/** Tell Rust which proxy yt-dlp and tool downloads use. */
export async function applyProxy(s: Pick<Settings, "proxyMode" | "proxyUrl">) {
  if (s.proxyMode === "none") return setProxy("");
  if (s.proxyMode === "custom") return setProxy(s.proxyUrl.trim() || null);
  return setProxy(await systemProxy().catch(() => null));
}

function applySideEffects<K extends keyof Settings>(key: K, value: Settings[K], all: Settings) {
  if (key === "closeToTray") void setCloseToTray(value as boolean);
  if (key === "proxyMode" || key === "proxyUrl") void applyProxy(all);
}

export const useSettings = create<SettingsStore>((set, get) => ({
  settings: DEFAULTS,
  loaded: false,

  load: async () => {
    const stored = (await loadSettings()) as Partial<Settings>;
    const settings: Settings = { ...DEFAULTS, ...stored, preset: { ...DEFAULT_PRESET, ...stored.preset } };
    if (!settings.outputDir) {
      settings.outputDir = await downloadDir().catch(() => "");
    }
    set({ settings, loaded: true });
    void setCloseToTray(settings.closeToTray);
    await applyProxy(settings);
  },

  set: (key, value) => {
    const settings = { ...get().settings, [key]: value };
    set({ settings });
    applySideEffects(key, value, settings);
    void saveSetting(key, value);
  },
}));

export const getSettings = () => useSettings.getState().settings;

export function downloadOptions(s: Settings): DownloadOptions {
  return {
    subtitleMode: s.subtitleMode,
    autoCaptions: s.autoCaptions,
    fragments: s.fragments,
    limitMbps: s.limitOn ? s.limitMbps : null,
    retries: s.retries,
    socketTimeout: s.socketTimeout,
  };
}
