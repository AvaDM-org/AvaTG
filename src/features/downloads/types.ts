// A download "recipe" as stored in SQLite (db.rs keeps it as a JSON document).
// Re-running `args` against `url` resumes the download from yt-dlp's own .part files.

export type DownloadStatus = "queued" | "running" | "paused" | "interrupted" | "done" | "failed" | "cancelled";

export interface DownloadRecord {
  id: string;
  createdAt: number;
  url: string;
  /** YouTube video id; our file names end in "[id]", which finds the partial files on cancel */
  videoId: string;
  title: string;
  channel: string | null;
  duration: number | null;
  thumbnail: string | null;
  audioOnly: boolean;
  /** Format column text, e.g. "MP4 · 1080p" */
  formatLabel: string;
  args: string[];
  /** folder the file lands in (download folder plus any playlist folder) */
  dir: string;
  saveDescription: boolean;
  status: DownloadStatus;
  percent: number | null;
  sizeBytes: number | null;
  filepath: string | null;
  error: string | null;
  /** automatic resumes used after failures; reset by a manual resume */
  autoRetries: number;
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
