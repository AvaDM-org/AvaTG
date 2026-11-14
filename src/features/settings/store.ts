// App settings. Saved to SQLite one key at a time; every change applies immediately (no Save button).
import { downloadDir } from "@tauri-apps/api/path";
import { create } from "zustand";
import { loadSettings, saveSetting, setCloseToTray } from "../../ipc";
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

/** Window background alpha: from the solid fallback (1.0) to the theme's glass (0.6). */
const applyGlass = (glass: number) =>
  document.documentElement.style.setProperty("--glass-alpha", String(1 - 0.4 * (glass / 100)));

function applySideEffects<K extends keyof Settings>(key: K, value: Settings[K]) {
  if (key === "glass") applyGlass(value as number);
  if (key === "closeToTray") void setCloseToTray(value as boolean);
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
  },

  set: (key, value) => {
    set({ settings: { ...get().settings, [key]: value } });
    applySideEffects(key, value);
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
