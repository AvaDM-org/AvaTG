// The download queue: records, admission ("downloads at a time"), pause/resume/cancel and Pause all.
// Each status change is saved to SQLite; progress ticks only update memory.
import { create } from "zustand";
import {
  deleteDownloads,
  deleteFiles,
  deletePartials,
  loadDownloads,
  onDownloadEvent,
  renameDescription,
  runDownload,
  saveDownloads,
  stopDownload,
  type DownloadEvent,
} from "../../ipc";
import { getSettings } from "../settings/store";
import type { DownloadRecord, LiveProgress } from "./types";

/** What happens when a stopped yt-dlp process ends. */
type StopReason = "paused" | "cancelled" | "removed";

interface DownloadsStore {
  items: DownloadRecord[];
  live: Record<string, LiveProgress>;
  /** Pause all: nothing new starts until Resume all */
  held: boolean;
  loaded: boolean;
  load: () => Promise<void>;
  add: (records: DownloadRecord[]) => void;
  pause: (ids: string[]) => void;
  resume: (ids: string[]) => void;
  cancel: (ids: string[]) => void;
  remove: (ids: string[], withFiles: boolean) => void;
  pauseAll: () => void;
  resumeAll: () => void;
  /** Start waiting downloads if there is room (after "downloads at a time" changes). */
  admit: () => void;
}

const stopping = new Map<string, StopReason>();
const EMPTY_LIVE: LiveProgress = { speed: null, eta: null, phase: null, part: 0 };

export const useDownloads = create<DownloadsStore>((set, get) => {
  const find = (id: string) => get().items.find((d) => d.id === id);

  const patch = (id: string, p: Partial<DownloadRecord>, persist = true) => {
    let changed: DownloadRecord | undefined;
    set((st) => ({
      items: st.items.map((d) => (d.id === id ? (changed = { ...d, ...p }) : d)),
    }));
    if (persist && changed) void saveDownloads([changed]);
  };

  const setLive = (id: string, p: Partial<LiveProgress> | null) =>
    set((st) => {
      const { [id]: prev, ...rest } = st.live;
      return {
        live: p === null ? rest : { ...rest, [id]: { ...EMPTY_LIVE, ...(prev as LiveProgress | undefined), ...p } },
      };
    });

  /** Start queued downloads while there is a free slot. */
  const pump = () => {
    const { items, held } = get();
    if (held) return;
    let free = getSettings().concurrency - items.filter((d) => d.status === "running").length;
    for (const d of items) {
      if (free <= 0) break;
      if (d.status !== "queued") continue;
      free--;
      void start(d.id);
    }
  };

  const start = async (id: string) => {
    const d = find(id);
    if (!d) return;
    patch(id, { status: "running", error: null });
    setLive(id, { part: 0, phase: "Starting", speed: null, eta: null });
    try {
      const file = await runDownload(id, d.url, d.args, getSettings().cookiesBrowser);
      if (file && d.saveDescription) await renameDescription(file).catch(() => {});
      patch(id, { status: "done", percent: 100, filepath: file ?? d.filepath, autoRetries: 0 });
    } catch (e) {
      const reason = stopping.get(id);
      stopping.delete(id);
      const msg = String(e);
      if (reason === "paused") patch(id, { status: "paused" });
      else if (reason === "cancelled") {
        patch(id, { status: "cancelled", percent: null });
        await deletePartials(d.dir, d.videoId).catch(() => 0);
      } else if (reason === "removed") {
        /* already gone from the list */
      } else {
        const cur = find(id);
        const retries = cur?.autoRetries ?? 0;
        if (retries < getSettings().autoResume && !isPermanent(msg)) {
          patch(id, { status: "queued", autoRetries: retries + 1, error: msg });
        } else {
          patch(id, { status: "failed", error: msg });
        }
      }
    }
    setLive(id, null);
    pump();
  };

  const stop = (ids: string[], reason: StopReason) => {
    for (const id of ids) {
      if (find(id)?.status !== "running") continue;
      stopping.set(id, reason);
      void stopDownload(id);
    }
  };

  return {
    items: [],
    live: {},
    held: false,
    loaded: false,

    load: async () => {
      const resume = getSettings().resumeOnLaunch;
      // Whatever was running or waiting when TubeGrab closed is "interrupted", or simply queued again.
      const items = (await loadDownloads<DownloadRecord>()).map((d) =>
        d.status === "running" || d.status === "queued"
          ? { ...d, status: resume ? ("queued" as const) : ("interrupted" as const) }
          : d,
      );
      set({ items, loaded: true });
      void saveDownloads(items);
      onDownloadEvent(handleEvent);
      pump();
    },

    add: (records) => {
      set((st) => ({ items: [...st.items, ...records] }));
      void saveDownloads(records);
      pump();
    },

    pause: (ids) => {
      stop(ids, "paused");
      for (const id of ids) if (find(id)?.status === "queued") patch(id, { status: "paused" });
    },

    resume: (ids) => {
      for (const id of ids) {
        const s = find(id)?.status;
        if (s === "paused" || s === "interrupted" || s === "failed" || s === "cancelled") {
          patch(id, { status: "queued", error: null, autoRetries: 0 });
        }
      }
      pump();
    },

    cancel: (ids) => {
      stop(ids, "cancelled");
      for (const id of ids) {
        const d = find(id);
        if (d && d.status !== "running" && d.status !== "done") {
          patch(id, { status: "cancelled", percent: null });
          void deletePartials(d.dir, d.videoId).catch(() => 0);
        }
      }
    },

    remove: (ids, withFiles) => {
      const gone = get().items.filter((d) => ids.includes(d.id));
      stop(ids, "removed");
      set((st) => ({ items: st.items.filter((d) => !ids.includes(d.id)) }));
      void deleteDownloads(ids);
      if (withFiles) {
        void deleteFiles(gone.flatMap((d) => (d.filepath ? [d.filepath] : [])));
        for (const d of gone) void deletePartials(d.dir, d.videoId).catch(() => 0);
      }
      pump();
    },

    pauseAll: () => {
      set({ held: true });
      stop(
        get()
          .items.filter((d) => d.status === "running")
          .map((d) => d.id),
        "paused",
      );
    },

    admit: () => pump(),

    resumeAll: () => {
      set({ held: false });
      get().resume(
        get()
          .items.filter((d) => d.status === "paused" || d.status === "interrupted")
          .map((d) => d.id),
      );
    },
  };

  function handleEvent(ev: DownloadEvent) {
    const d = find(ev.id);
    if (!d) return;
    const live: LiveProgress = get().live[ev.id] ?? EMPTY_LIVE;
    if (ev.kind === "progress") {
      if (ev.status === "finished") {
        setLive(ev.id, { part: live.part + 1, speed: null, eta: null });
        return;
      }
      const percent = ev.total ? Math.min(100, ((ev.downloaded ?? 0) / ev.total) * 100) : null;
      const phase = d.audioOnly ? "Audio" : live.part === 0 ? "Video" : "Audio";
      setLive(ev.id, { phase, speed: ev.speed ?? null, eta: ev.eta ?? null });
      patch(ev.id, { percent, sizeBytes: live.part === 0 ? (ev.total ?? d.sizeBytes) : d.sizeBytes }, false);
    } else if (ev.kind === "postprocess" && ev.status === "started") {
      setLive(ev.id, { phase: postprocessName(ev.postprocessor ?? "", d.formatLabel), speed: null, eta: null });
    } else if (ev.kind === "file" && ev.filepath) {
      patch(ev.id, { filepath: ev.filepath }, false);
    }
  }
});

/** Errors a retry will not fix. */
function isPermanent(msg: string): boolean {
  return /private video|video unavailable|members[- ]only|sign in to confirm|not available in your country|copyright/i.test(
    msg,
  );
}

const POSTPROCESSORS: Record<string, string> = {
  Merger: "Merging",
  FFmpegVideoRemuxer: "Remuxing",
  FFmpegVideoConvertor: "Converting",
  FFmpegMetadata: "Writing metadata",
  EmbedThumbnail: "Adding thumbnail",
  FFmpegEmbedSubtitle: "Adding subtitles",
  FFmpegSubtitlesConvertor: "Converting subtitles",
  SponsorBlock: "Finding sponsors",
  ModifyChapters: "Cutting sponsors",
  MoveFiles: "Finishing",
};

function postprocessName(pp: string, formatLabel: string): string {
  if (pp === "FFmpegExtractAudio") return `Converting to ${formatLabel.split(" ")[0]}`;
  return POSTPROCESSORS[pp] ?? "Processing";
}
