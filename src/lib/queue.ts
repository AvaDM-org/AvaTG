// Download queue: holds jobs, runs up to `concurrency` at once, tracks progress events.
import { useSyncExternalStore } from "react";
import { cancelDownload, onDownloadEvent, runDownload } from "./api";
import { getSettings } from "./settings";

export type JobStatus = "queued" | "running" | "done" | "error" | "cancelled";

export interface Job {
  id: string;
  url: string;
  title: string;
  label: string; // preset description
  args: string[];
  status: JobStatus;
  percent: number | null;
  speed: number | null;
  eta: number | null;
  /** how many files yt-dlp has finished downloading (video+audio = 2) */
  part: number;
  phase: string | null;
  filepath: string | null;
  error: string | null;
}

let jobs: Job[] = [];
const subs = new Set<() => void>();
let seq = 0;

function emit() {
  jobs = [...jobs];
  subs.forEach((f) => f());
}

function patch(id: string, p: Partial<Job>) {
  const i = jobs.findIndex((j) => j.id === id);
  if (i < 0) return;
  jobs[i] = { ...jobs[i], ...p };
  emit();
}

export function useJobs(): Job[] {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => jobs,
  );
}

export function enqueue(items: { url: string; title: string; label: string; args: string[] }[]) {
  for (const it of items) {
    jobs.push({
      ...it,
      id: `j${Date.now().toString(36)}${(seq++).toString(36)}`,
      status: "queued",
      percent: null,
      speed: null,
      eta: null,
      part: 0,
      phase: null,
      filepath: null,
      error: null,
    });
  }
  emit();
  pump();
}

function pump() {
  const limit = Math.max(1, getSettings().concurrency);
  let running = jobs.filter((j) => j.status === "running").length;
  for (const j of jobs) {
    if (running >= limit) break;
    if (j.status !== "queued") continue;
    running++;
    start(j);
  }
}

async function start(j: Job) {
  patch(j.id, { status: "running", percent: null, error: null, phase: "Starting…", part: 0 });
  try {
    const file = await runDownload(j.id, j.url, j.args, getSettings().cookiesBrowser);
    patch(j.id, { status: "done", percent: 100, phase: null, speed: null, eta: null, filepath: file });
  } catch (e) {
    const msg = String(e);
    patch(j.id, {
      status: msg === "cancelled" ? "cancelled" : "error",
      error: msg === "cancelled" ? null : msg,
      phase: null,
      speed: null,
      eta: null,
    });
  }
  pump();
}

export function cancel(id: string) {
  const j = jobs.find((x) => x.id === id);
  if (!j) return;
  if (j.status === "queued") patch(id, { status: "cancelled" });
  else if (j.status === "running") cancelDownload(id);
}

export function cancelAll() {
  jobs.filter((j) => j.status === "queued" || j.status === "running").forEach((j) => cancel(j.id));
}

export function retry(id: string) {
  patch(id, { status: "queued", error: null, percent: null });
  pump();
}

export function clearFinished() {
  jobs = jobs.filter((j) => j.status === "queued" || j.status === "running");
  emit();
}

const PP_NAMES: Record<string, string> = {
  Merger: "Merging",
  FFmpegExtractAudio: "Converting audio",
  FFmpegVideoRemuxer: "Remuxing",
  FFmpegVideoConvertor: "Converting",
  FFmpegMetadata: "Writing metadata",
  EmbedThumbnail: "Embedding thumbnail",
  FFmpegEmbedSubtitle: "Embedding subtitles",
  SponsorBlock: "SponsorBlock",
  ModifyChapters: "Removing segments",
  MoveFiles: "Finishing",
};

let listening = false;
export function initQueueEvents() {
  if (listening) return;
  listening = true;
  onDownloadEvent((ev) => {
    const j = jobs.find((x) => x.id === ev.id);
    if (!j) return;
    if (ev.kind === "progress") {
      if (ev.status === "finished") {
        patch(ev.id, { part: j.part + 1, percent: 100, phase: "Downloaded" });
        return;
      }
      const pct = ev.total ? Math.min(100, ((ev.downloaded ?? 0) / ev.total) * 100) : null;
      patch(ev.id, {
        percent: pct,
        speed: ev.speed ?? null,
        eta: ev.eta ?? null,
        phase: j.part > 0 ? `Downloading part ${j.part + 1}` : "Downloading",
      });
    } else if (ev.kind === "postprocess" && ev.status === "started") {
      patch(ev.id, { phase: PP_NAMES[ev.postprocessor ?? ""] ?? ev.postprocessor ?? "Processing", speed: null, eta: null });
    } else if (ev.kind === "file") {
      patch(ev.id, { filepath: ev.filepath ?? null });
    }
  });
}
