// What yt-dlp printed for each download in this session, for the detail panel's Log tab, and warnings as toasts.
// Kept apart from the downloads store so new lines don't redraw the list. Not saved: a restart starts empty.
import { create } from "zustand";
import { useToasts } from "../../components/Toasts";
import type { LogLevel } from "../../ipc";

export interface LogLine {
  at: number;
  level: LogLevel;
  text: string;
}

/** Lines kept per download; the oldest go first. */
const MAX_LINES = 500;

interface LogStore {
  lines: Record<string, LogLine[]>;
  add: (id: string, line: LogLine) => void;
  forget: (ids: string[]) => void;
}

export const useDownloadLogs = create<LogStore>((set) => ({
  lines: {},
  add: (id, line) =>
    set((st) => {
      const prev = st.lines[id] ?? [];
      const next = prev.length >= MAX_LINES ? [...prev.slice(prev.length - MAX_LINES + 1), line] : [...prev, line];
      return { lines: { ...st.lines, [id]: next } };
    }),
  forget: (ids) =>
    set((st) => ({ lines: Object.fromEntries(Object.entries(st.lines).filter(([id]) => !ids.includes(id))) })),
}));

/** A warning without its prefix and the video id, so the same warning for many videos reads as one. */
export function warningKey(text: string): string {
  return text
    .replace(/^WARNING:\s*/, "")
    .replace(/^\[[^\]]+\]\s*[\w-]{6,}:\s*/, "")
    .trim();
}

const shown = new Set<string>();

/** A yt-dlp warning as a toast, once per distinct warning in a session (a playlist would repeat it per video). */
export function toastWarning(title: string, text: string) {
  const key = warningKey(text);
  if (!key || shown.has(key)) return;
  shown.add(key);
  useToasts.getState().show(`“${title}”: ${text.replace(/^WARNING:\s*/, "")}`);
}
