// A download "recipe" as stored in SQLite (db.rs keeps it as a JSON document).
// The yt-dlp command is built from it each time the download starts (so it follows the current settings);
// running it again resumes from yt-dlp's own .part files.
import type { Preset } from "../../lib/presets";

export type DownloadStatus = "queued" | "running" | "paused" | "interrupted" | "done" | "failed" | "cancelled";

export interface DownloadRecord {
  id: string;
  createdAt: number;
  url: string;
  title: string;
  channel: string | null;
  duration: number | null;
  thumbnail: string | null;
  audioOnly: boolean;
  /** Format column text, e.g. "MP4 · 1080p" */
  formatLabel: string;
  preset: Preset;
  /** Records saved before 2026-11-15 kept the finished command instead of the preset. */
  args?: string[];
  /** download folder chosen when it was added */
  outputDir: string;
  /** playlist subfolder, if any */
  folder: string | null;
  /** 1-based playlist position used as a "001 - " prefix, if any */
  index: number | null;
  /** folder the file lands in (outputDir plus folder) */
  dir: string;
  saveDescription: boolean;
  status: DownloadStatus;
  percent: number | null;
  sizeBytes: number | null;
  filepath: string | null;
  error: string | null;
  /** automatic resumes used after failures; reset by a manual resume */
  autoRetries: number;
  // History (records from before 2026-11-16 have none): "Took" and "Average speed".
  /** when the last run started, ms */
  startedAt?: number | null;
  /** when it completed, ms */
  finishedAt?: number | null;
  /** time spent running, summed over every run (pauses and waiting don't count), ms */
  activeMs?: number;
  /** the part of activeMs spent receiving data (not merging or converting), ms */
  transferMs?: number;
}

/** Fast-changing state that is shown but never stored. */
export interface LiveProgress {
  speed: number | null;
  eta: number | null;
  /** "Video", "Audio", "Merging", "Converting to MP3"... */
  phase: string | null;
  /** files yt-dlp has finished in this run (video + audio = 2) */
  part: number;
}

export const isActive = (s: DownloadStatus) => s === "queued" || s === "running";
export const isUnfinished = (s: DownloadStatus) => s !== "done" && s !== "cancelled";
