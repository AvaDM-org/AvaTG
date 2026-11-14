// What the user is choosing from: one link at a time, read with yt-dlp, shown as a video dialog
// or a playlist/channel page. Several pasted or dropped links become a plain list of videos.
import { create } from "zustand";
import type { Analysis, Entry, PlaylistInfo } from "../../lib/youtube";
import { analyze, classify } from "../../lib/youtube";
import { getSettings } from "../settings/store";

type PickerState =
  | { phase: "idle" }
  | { phase: "input"; error: string | null }
  | { phase: "loading"; url: string; message: string }
  | { phase: "ready"; result: Analysis };

interface PickerStore {
  state: PickerState;
  /** Open the "Add link" dialog with an empty field. */
  ask: () => void;
  /** Read one link, or several (they are shown as a list). */
  open: (links: string[]) => Promise<void>;
  close: () => void;
}

const loadingMessage = (url: string) => {
  const kind = classify(url).kind;
  if (kind === "channel") return "Reading the channel's videos and playlists. Large channels take a while.";
  if (kind === "playlist") return "Reading the playlist…";
  return "Reading video info…";
};

export const usePicker = create<PickerStore>((set, get) => ({
  state: { phase: "idle" },
  ask: () => set({ state: { phase: "input", error: null } }),
  close: () => set({ state: { phase: "idle" } }),

  open: async (links) => {
    if (!links.length) return;
    const url = links[0];
    set({
      state: {
        phase: "loading",
        url,
        message: links.length > 1 ? `Reading ${links.length} links…` : loadingMessage(url),
      },
    });
    try {
      const cookies = getSettings().cookiesBrowser;
      const result = links.length > 1 ? await analyzeMany(links, cookies) : await analyze(url, cookies);
      // The user may have closed the dialog while we were reading.
      if (get().state.phase === "loading") set({ state: { phase: "ready", result } });
    } catch (e) {
      if (get().state.phase === "loading") set({ state: { phase: "input", error: cleanError(String(e)) } });
    }
  },
}));

/** Several links: read each one and show the videos as one list (playlists are expanded). */
async function analyzeMany(links: string[], cookies: string): Promise<PlaylistInfo> {
  const entries: Entry[] = [];
  for (const link of links) {
    try {
      const r = await analyze(link, cookies);
      if (r.type === "video") {
        entries.push({ ...r, kind: "video", count: null });
      } else if (r.type === "playlist") {
        entries.push(...r.entries);
      } else {
        entries.push(...r.videos);
      }
    } catch {
      // An unreadable link is left out; the others still show.
    }
  }
  return { type: "playlist", id: "", title: `${links.length} links`, channel: null, entries };
}

function cleanError(msg: string): string {
  return msg.replace(/^Error:\s*/, "").replace(/^ERROR:\s*(\[[^\]]+\]\s*)?/gm, "");
}
