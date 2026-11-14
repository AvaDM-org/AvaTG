// "Already downloaded": a video being added that is already in the list with the same format and folder.
// The user picks one answer for all of them: Skip (default), Rename (a " (2)" suffix) or Replace (the old file
// and its row go, the video is downloaded again). Pure, so it is tested without the UI.
import type { DownloadRecord } from "./types";

export type DuplicateChoice = "skip" | "rename" | "replace";

export interface Duplicate {
  /** index in the list being added */
  index: number;
  /** the matching downloads already in the list */
  existing: DownloadRecord[];
  /** true when at least one of them is a finished file still on disk */
  done: boolean;
}

/** The same video whatever the link looks like: YouTube ids for YouTube links, else the link without its #. */
export function videoKey(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^(www\.|m\.|music\.)/, "");
    if (host === "youtu.be") return `yt:${u.pathname.slice(1, 12)}`;
    if (host === "youtube.com") {
      const v = u.searchParams.get("v") ?? u.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]{11})/)?.[1];
      if (v) return `yt:${v}`;
    }
    u.hash = "";
    return u.toString();
  } catch {
    return url.trim();
  }
}

const sameDir = (a: string, b: string) => a.replace(/[\\/]+$/, "") === b.replace(/[\\/]+$/, "");

/**
 * Videos in `videos` that are already in `records` with the same format label and folder. Cancelled downloads
 * don't count; finished ones only while their file exists (`exists`).
 */
export function findDuplicates(
  videos: { url: string }[],
  formatLabel: string,
  dir: string,
  records: DownloadRecord[],
  exists: (path: string) => boolean,
): Duplicate[] {
  const byKey = new Map<string, DownloadRecord[]>();
  for (const r of records) {
    if (r.status === "cancelled" || r.formatLabel !== formatLabel || !sameDir(r.dir, dir)) continue;
    if (r.status === "done" && !(r.filepath && exists(r.filepath))) continue;
    const k = videoKey(r.url);
    byKey.set(k, [...(byKey.get(k) ?? []), r]);
  }
  return videos.flatMap((v, index) => {
    const existing = byKey.get(videoKey(v.url));
    return existing ? [{ index, existing, done: existing.some((r) => r.status === "done") }] : [];
  });
}

/** The next free " (n)" suffix, n ≥ 2, among the existing copies. */
export function nextSuffix(existing: DownloadRecord[]): string {
  const used = existing.map((r) => Number(r.nameSuffix?.match(/\((\d+)\)/)?.[1] ?? 1));
  return ` (${Math.max(1, ...used) + 1})`;
}

/** What to queue and what to take off the list for the user's answer. */
export function planDuplicates<V extends { url: string; nameSuffix?: string }>(
  videos: V[],
  dups: Duplicate[],
  choice: DuplicateChoice,
): { videos: V[]; replaced: DownloadRecord[] } {
  const dupAt = new Map(dups.map((d) => [d.index, d]));
  const out: V[] = [];
  videos.forEach((v, i) => {
    const dup = dupAt.get(i);
    if (!dup) out.push(v);
    else if (choice === "rename") out.push({ ...v, nameSuffix: nextSuffix(dup.existing) });
    else if (choice === "replace") out.push(v);
  });
  return { videos: out, replaced: choice === "replace" ? dups.flatMap((d) => d.existing) : [] };
}
