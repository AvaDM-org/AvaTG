// User settings, persisted in the webview's localStorage.
import { useSyncExternalStore } from "react";
import { DEFAULT_PRESET, type Preset } from "./presets";

export interface Settings {
  outputDir: string;
  concurrency: number;
  /** "" = no cookies; otherwise a browser name for --cookies-from-browser */
  cookiesBrowser: string;
  preset: Preset;
  playlistSubfolder: boolean;
  numberFiles: boolean;
}

const KEY = "tubegrab.settings.v1";

const defaults: Settings = {
  outputDir: "",
  concurrency: 2,
  cookiesBrowser: "",
  preset: DEFAULT_PRESET,
  playlistSubfolder: true,
  numberFiles: true,
};

function load(): Settings {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return { ...defaults, ...s, preset: { ...DEFAULT_PRESET, ...(s.preset ?? {}) } };
  } catch {
    return defaults;
  }
}

let state = load();
const subs = new Set<() => void>();

export function getSettings(): Settings {
  return state;
}

export function updateSettings(patch: Partial<Settings>) {
  state = { ...state, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
  subs.forEach((f) => f());
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => state,
  );
}
