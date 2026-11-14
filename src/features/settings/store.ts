// App settings. Saved to SQLite one key at a time; every change applies immediately (no Save button).
import { downloadDir } from "@tauri-apps/api/path";
import { create } from "zustand";
import { loadSettings, saveSetting, setCloseToTray, setProxy, systemProxy } from "../../ipc";
import { DEFAULT_PRESET, type DownloadOptions, type Preset, type SubtitleMode } from "../../lib/presets";

export interface Settings {
  // General
  resumeOnLaunch: boolean;
  closeToTray: boolean;
  doubleClick: "play" | "folder";
  /** 0 = solid window, 100 = full glass */
  glass: number;
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
  // Tools
  checkToolUpdates: boolean;
  /** the last choices made in a picker, used as the starting point next time */
  preset: Preset;
}

export const DEFAULTS: Settings = {
  resumeOnLaunch: true,
  closeToTray: true,
  doubleClick: "play",
  glass: 80,
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
  checkToolUpdates: true,
  preset: DEFAULT_PRESET,
};

interface SettingsStore {
  settings: Settings;
  loaded: boolean;
  load: () => Promise<void>;
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}

/**
 * How see-through the window may get at 100% glass. Linux webviews get no blur behind the window, so the
 * background must stay readable without it (AvaDM DESIGN.md: glass is never required for readability).
 */
const MAX_TRANSPARENCY = navigator.userAgent.includes("Linux") ? 0.12 : 0.4;

/** Window background alpha: from solid (1.0) at 0% to the most see-through allowed at 100%. */
const applyGlass = (glass: number) =>
  document.documentElement.style.setProperty("--glass-alpha", String(1 - MAX_TRANSPARENCY * (glass / 100)));

/** Tell Rust which proxy yt-dlp and tool downloads use. */
export async function applyProxy(s: Pick<Settings, "proxyMode" | "proxyUrl">) {
  if (s.proxyMode === "none") return setProxy("");
  if (s.proxyMode === "custom") return setProxy(s.proxyUrl.trim() || null);
  return setProxy(await systemProxy().catch(() => null));
}

function applySideEffects<K extends keyof Settings>(key: K, value: Settings[K], all: Settings) {
  if (key === "glass") applyGlass(value as number);
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
    applyGlass(settings.glass);
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
