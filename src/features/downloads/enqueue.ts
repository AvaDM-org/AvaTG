// Turns what the user picked (videos, playlists) into download recipes and queues them.
import { formatLabel, safeName, type Preset } from "../../lib/presets";
import { playlistEntries, type Entry } from "../../lib/youtube";
import { getSettings } from "../settings/store";
import { useDownloads } from "./store";
import type { DownloadRecord } from "./types";

export interface PickedVideo {
  url: string;
  title: string;
  channel: string | null;
  duration: number | null;
  thumbnail: string | null;
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
  /** 1-based playlist positions, used as a "001 - " file name prefix */
  positions?: number[];
}

/** Queue videos with one preset. Returns how many were queued. */
export function queueVideos(
  videos: PickedVideo[],
  preset: Preset,
  { outputDir, folder = null, positions }: QueueOptions = {},
) {
  const settings = getSettings();
  const base = outputDir || settings.outputDir;
  const dir = folder ? `${base}/${safeName(folder)}` : base;
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
    index: positions?.[i] ?? null,
    dir,
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
      queueVideos(videos.map(fromEntry), preset, {
        outputDir,
        folder: playlistFolder ? info.title : null,
        positions: numberFiles ? videos.map((_, i) => i + 1) : undefined,
      });
    } catch (e) {
      errors.push(`${pl.title}: ${e}`);
    }
    onProgress?.(++done);
  }
  if (errors.length) throw new Error(errors.join("\n"));
}
