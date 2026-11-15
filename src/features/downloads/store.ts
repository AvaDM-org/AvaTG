// The download queue: records, admission ("downloads at a time"), pause/resume/cancel and Pause all.
// Each status change is saved to SQLite; progress ticks only update memory.
import { create } from "zustand";
import {
  deleteDownloads,
  deleteFiles,
  deleteParts,
  fileSizes,
  loadDownloads,
  onDownloadEvent,
  renameDescription,
  runDownload,
  saveDownloads,
  stopDownload,
  type DownloadEvent,
} from "../../ipc";
import { buildArgs } from "../../lib/presets";
import { explainError } from "../../lib/youtube";
import { downloadOptions, getSettings, useSettings } from "../settings/store";
import { RunClock } from "./history";
import { toastWarning, useDownloadLogs } from "./logs";
import type { DownloadRecord, LiveProgress } from "./types";

/** What happens when a stopped yt-dlp process ends. "requeued": over the downloads-at-a-time limit. */
type StopReason = "paused" | "cancelled" | "removed" | "requeued";

/** The yt-dlp arguments for a download, from its recipe and the current settings. */
const argsFor = (d: DownloadRecord) =>
  d.preset
    ? buildArgs(
        d.preset,
        { outputDir: d.outputDir, subfolder: d.folder, index: d.index, partsDir: partsDirOf(d), suffix: d.nameSuffix },
        downloadOptions(getSettings()),
      )
    : (d.args ?? []);

/** The download's own folder for unfinished files; deleting it is how Cancel cleans up. */
const partsDirOf = (d: DownloadRecord) => `${d.outputDir}/.avatg-parts/${d.id}`;
const cleanUp = (d: DownloadRecord) => void deleteParts(partsDirOf(d)).catch(() => {});

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
/** load() can be called twice (React's StrictMode in dev); it must only run once. */
let loading: Promise<void> | null = null;
const clocks = new Map<string, RunClock>();
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

  /** Stop the run's clock and add its times to the record's history. */
  const runTimes = (id: string): Partial<DownloadRecord> => {
    const clock = clocks.get(id);
    clocks.delete(id);
    const d = find(id);
    if (!clock || !d) return {};
    const t = clock.stop(Date.now());
    return { activeMs: (d.activeMs ?? 0) + t.activeMs, transferMs: (d.transferMs ?? 0) + t.transferMs };
  };

  const start = async (id: string) => {
    const d = find(id);
    if (!d) return;
    const now = Date.now();
    clocks.set(id, new RunClock(now));
    useDownloadLogs.getState().add(id, { at: now, level: "info", text: "Started" });
    patch(id, { status: "running", error: null, startedAt: now });
    setLive(id, { part: 0, phase: "Starting", speed: null, eta: null });
    try {
      const file = await runDownload(id, d.url, argsFor(d), getSettings().cookiesBrowser);
      if (file && d.saveDescription) await renameDescription(file).catch(() => {});
      const filepath = file ?? d.filepath;
      // The finished file's real size (the progress lines only know the video stream's size).
      const [size] = filepath ? await fileSizes([filepath]).catch(() => [null]) : [null];
      patch(id, {
        status: "done",
        percent: 100,
        filepath,
        autoRetries: 0,
        finishedAt: Date.now(),
        sizeBytes: size ?? find(id)?.sizeBytes ?? null,
        ...runTimes(id),
      });
      cleanUp(d);
    } catch (e) {
      const reason = stopping.get(id);
      stopping.delete(id);
      const msg = String(e);
      const times = runTimes(id);
      if (reason === "paused") patch(id, { status: "paused", ...times });
      else if (reason === "requeued") patch(id, { status: "queued", ...times });
      else if (reason === "cancelled") {
        patch(id, { status: "cancelled", percent: null, activeMs: 0, transferMs: 0 });
        cleanUp(d);
      } else if (reason === "removed") {
        cleanUp(d); // again, now that yt-dlp has stopped writing
      } else {
        const cur = find(id);
        const retries = cur?.autoRetries ?? 0;
        if (retries < getSettings().autoResume && !isPermanent(msg)) {
          patch(id, { status: "queued", autoRetries: retries + 1, error: explainError(msg), ...times });
        } else {
          patch(id, { status: "failed", error: explainError(msg), ...times });
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

    load: () => (loading ??= loadOnce()),

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
        if (s === "paused" || s === "interrupted" || s === "failed") {
          patch(id, { status: "queued", error: null, autoRetries: 0 });
        } else if (s === "cancelled") {
          // Its files were deleted: a fresh download, with a fresh history.
          patch(id, { status: "queued", error: null, autoRetries: 0, activeMs: 0, transferMs: 0, finishedAt: null });
        }
      }
      pump();
    },

    cancel: (ids) => {
      stop(ids, "cancelled");
      for (const id of ids) {
        const d = find(id);
        if (d && d.status !== "running" && d.status !== "done") {
          patch(id, { status: "cancelled", percent: null, activeMs: 0, transferMs: 0 });
          cleanUp(d);
        }
      }
    },

    remove: (ids, withFiles) => {
      const gone = get().items.filter((d) => ids.includes(d.id));
      stop(ids, "removed");
      set((st) => ({ items: st.items.filter((d) => !ids.includes(d.id)) }));
      void deleteDownloads(ids);
      useDownloadLogs.getState().forget(ids);
      // Unfinished files are useless once a download is off the list; finished files only go with "Delete files".
      gone.forEach(cleanUp);
      if (withFiles) void deleteFiles(gone.flatMap((d) => (d.filepath ? [d.filepath] : [])));
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

    admit: () => {
      // Over the limit (it was lowered): the newest running downloads go back to the queue, keeping their progress.
      const running = get().items.filter((d) => d.status === "running");
      const extra = running.length - getSettings().concurrency;
      if (extra > 0) {
        stop(
          running
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, extra)
            .map((d) => d.id),
          "requeued",
        );
      }
      pump();
    },

    resumeAll: () => {
      set({ held: false });
      get().resume(
        get()
          .items.filter((d) => d.status === "paused" || d.status === "interrupted")
          .map((d) => d.id),
      );
    },
  };

  async function loadOnce() {
    const resume = getSettings().resumeOnLaunch;
    // Whatever was running or waiting when AvaTG closed is "interrupted", or simply queued again.
    const items = (await loadDownloads<DownloadRecord>()).map((d) =>
      d.status === "running" || d.status === "queued"
        ? { ...d, status: resume ? ("queued" as const) : ("interrupted" as const) }
        : d,
    );
    set({ items, loaded: true });
    void saveDownloads(items);
    void onDownloadEvent(handleEvent);
    pump();
  }

  function handleEvent(ev: DownloadEvent) {
    const d = find(ev.id);
    if (!d) return;
    const live: LiveProgress = get().live[ev.id] ?? EMPTY_LIVE;
    const clock = clocks.get(ev.id);
    if (ev.kind === "log" && ev.message) {
      useDownloadLogs.getState().add(ev.id, { at: Date.now(), level: ev.level ?? "info", text: ev.message });
      if (ev.level === "warning") toastWarning(d.title, ev.message);
      return;
    }
    if (ev.kind === "progress") {
      if (ev.status === "finished") {
        clock?.idle(Date.now());
        setLive(ev.id, { part: live.part + 1, speed: null, eta: null });
        return;
      }
      clock?.receiving(Date.now());
      const percent = ev.total ? Math.min(100, ((ev.downloaded ?? 0) / ev.total) * 100) : null;
      const phase = d.audioOnly ? "Audio" : live.part === 0 ? "Video" : "Audio";
      setLive(ev.id, { phase, speed: ev.speed ?? null, eta: ev.eta ?? null });
      patch(ev.id, { percent, sizeBytes: live.part === 0 ? (ev.total ?? d.sizeBytes) : d.sizeBytes }, false);
    } else if (ev.kind === "postprocess" && ev.status === "started") {
      clock?.idle(Date.now());
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

// yt-dlp's post-processor keys as reported in progress lines (checked against yt-dlp 2026.10.26).
const POSTPROCESSORS: Record<string, string> = {
  Merger: "Merging",
  VideoRemuxer: "Remuxing",
  VideoConvertor: "Converting",
  Metadata: "Writing metadata",
  EmbedThumbnail: "Adding thumbnail",
  EmbedSubtitle: "Adding subtitles",
  SubtitlesConvertor: "Converting subtitles",
  FixupM4a: "Fixing the file",
  SponsorBlock: "Finding sponsors",
  ModifyChapters: "Cutting sponsors",
  MoveFiles: "Finishing",
};

function postprocessName(pp: string, formatLabel: string): string {
  if (pp === "ExtractAudio") return `Converting to ${formatLabel.split(" ")[0]}`;
  return POSTPROCESSORS[pp] ?? "Processing";
}

// "Downloads at a time" applies at once, wherever it is changed.
useSettings.subscribe((st, prev) => {
  if (st.settings.concurrency !== prev.settings.concurrency) useDownloads.getState().admit();
});
