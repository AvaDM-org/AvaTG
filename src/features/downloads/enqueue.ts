// Turns what the user picked (videos, playlists) into download recipes and queues them.
import { formatLabel, safeName, type Preset } from "../../lib/presets";
import { playlistEntries, type Entry } from "../../lib/youtube";
import { getSettings } from "../settings/store";
import { planDuplicates, type Duplicate, type DuplicateChoice } from "./duplicates";
import { useDownloads } from "./store";
import type { DownloadRecord } from "./types";

export interface PickedVideo {
  url: string;
  title: string;
  channel: string | null;
  duration: number | null;
  thumbnail: string | null;
  /** " (2)": a second copy of a video already in the folder */
  nameSuffix?: string;
  /** 1-based playlist position, used as a "001 - " file name prefix */
  position?: number | null;
}

export const fromEntry = (e: Entry): PickedVideo => ({
  url: e.url,
  title: e.title,
  channel: e.channel,
  duration: e.duration,
  thumbnail: e.thumbnail,
});

let seq = 0;
const newId = () => `d${Date.now().toString(36)}${(seq++).toString(36)}`;

export interface QueueOptions {
  /** download folder; Settings > Downloads when omitted */
  outputDir?: string;
  /** subfolder, e.g. the playlist's title */
  folder?: string | null;
}

/** The folder files land in: the download folder, or a subfolder of it. */
export function targetDir({ outputDir, folder = null }: QueueOptions = {}): string {
  const base = outputDir || getSettings().outputDir;
  return folder ? `${base}/${safeName(folder)}` : base;
}

/** Queue videos with one preset. Returns how many were queued. */
export function queueVideos(videos: PickedVideo[], preset: Preset, opts: QueueOptions = {}) {
  const base = opts.outputDir || getSettings().outputDir;
  const folder = opts.folder ?? null;
  const dir = targetDir(opts);
  const now = Date.now();
  const records: DownloadRecord[] = videos.map((v, i) => ({
    id: newId(),
    createdAt: now + i,
    url: v.url,
    title: v.title,
    channel: v.channel,
    duration: v.duration,
    thumbnail: v.thumbnail,
    audioOnly: preset.mode === "audio",
    formatLabel: formatLabel(preset),
    preset,
    outputDir: base,
    folder,
    index: v.position ?? null,
    dir,
    nameSuffix: v.nameSuffix ?? null,
    saveDescription: preset.description,
    status: "queued",
    percent: null,
    sizeBytes: null,
    filepath: null,
    error: null,
    autoRetries: 0,
  }));
  useDownloads.getState().add(records);
  return records.length;
}

/**
 * Queue videos after the "already downloaded" question: duplicates are skipped, renamed, or replace the old
 * downloads (their rows go and their files are deleted). Returns how many were queued.
 */
export function queueWithChoice(
  videos: PickedVideo[],
  preset: Preset,
  opts: QueueOptions,
  dups: Duplicate[],
  choice: DuplicateChoice,
) {
  const plan = planDuplicates(videos, dups, choice);
  if (plan.replaced.length) useDownloads.getState().remove(ids(plan.replaced), true);
  return plan.videos.length ? queueVideos(plan.videos, preset, opts) : 0;
}

const ids = (records: DownloadRecord[]) => records.map((r) => r.id);

/** Expand playlists (picked on a channel's Playlists tab) into their videos, one folder per playlist. */
export async function queuePlaylists(
  playlists: Entry[],
  preset: Preset,
  outputDir: string,
  onProgress?: (done: number) => void,
) {
  const { playlistFolder, numberFiles, cookiesBrowser } = getSettings();
  const errors: string[] = [];
  let done = 0;
  for (const pl of playlists) {
    try {
      const info = await playlistEntries(pl.url, cookiesBrowser);
      const videos = info.entries.filter((e) => e.kind === "video");
      queueVideos(
        videos.map((e, i) => ({ ...fromEntry(e), position: numberFiles ? i + 1 : null })),
        preset,
        { outputDir, folder: playlistFolder ? info.title : null },
      );
    } catch (e) {
      errors.push(`${pl.title}: ${e}`);
    }
    onProgress?.(++done);
  }
  if (errors.length) throw new Error(errors.join("\n"));
}
