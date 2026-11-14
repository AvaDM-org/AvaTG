// The downloads list's filters and sort choices. Pure, so they are tested without the UI.
import type { SortState } from "../../components/table/layout";
import type { DownloadRecord, DownloadStatus, LiveProgress } from "./types";

/** One list row: the stored record plus what is only known while it runs. */
export interface DownloadRow {
  d: DownloadRecord;
  live: LiveProgress | undefined;
  /** Pause all is on: waiting downloads are held */
  held: boolean;
}

export type StatusFilter = "all" | "running" | "paused" | "queued" | "failed" | "done" | "cancelled";
export type TypeFilter = "all" | "video" | "audio";

export const STATUS_FILTERS: { value: StatusFilter; label: string; match: DownloadStatus[] }[] = [
  { value: "all", label: "All", match: [] },
  { value: "running", label: "Running", match: ["running"] },
  { value: "paused", label: "Paused", match: ["paused", "interrupted"] },
  { value: "queued", label: "Queued", match: ["queued"] },
  { value: "failed", label: "Failed", match: ["failed"] },
  { value: "done", label: "Completed", match: ["done"] },
  { value: "cancelled", label: "Cancelled", match: ["cancelled"] },
];

export const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "video", label: "Video" },
  { value: "audio", label: "Audio" },
];

const typeOf = (d: DownloadRecord): Exclude<TypeFilter, "all"> => (d.audioOnly ? "audio" : "video");

export interface ListFilter {
  query: string;
  status: StatusFilter;
  type: TypeFilter;
}

export function matches(d: DownloadRecord, f: ListFilter): boolean {
  const statuses = STATUS_FILTERS.find((x) => x.value === f.status)?.match ?? [];
  if (statuses.length && !statuses.includes(d.status)) return false;
  if (f.type !== "all" && typeOf(d) !== f.type) return false;
  const q = f.query.trim().toLowerCase();
  return !q || d.title.toLowerCase().includes(q) || !!d.channel?.toLowerCase().includes(q) || d.url.includes(q);
}

/** Live counts for the filter menus. Each menu counts what the other filter (and the search) leaves. */
export function filterCounts(items: DownloadRecord[], f: ListFilter) {
  const status = Object.fromEntries(STATUS_FILTERS.map((x) => [x.value, 0])) as Record<StatusFilter, number>;
  const type = Object.fromEntries(TYPE_FILTERS.map((x) => [x.value, 0])) as Record<TypeFilter, number>;
  for (const d of items) {
    if (matches(d, { ...f, status: "all" })) {
      status.all++;
      const hit = STATUS_FILTERS.find((x) => x.match.includes(d.status));
      if (hit) status[hit.value]++;
    }
    if (matches(d, { ...f, type: "all" })) {
      type.all++;
      type[typeOf(d)]++;
    }
  }
  return { status, type };
}

/** The Sort menu: named shortcuts for header sorts. */
export const SORT_CHOICES: { label: string; sort: SortState }[] = [
  { label: "Newest first", sort: { column: "added", desc: true } },
  { label: "Oldest first", sort: { column: "added", desc: false } },
  { label: "Name", sort: { column: "name", desc: false } },
  { label: "Largest first", sort: { column: "size", desc: true } },
  { label: "Status", sort: { column: "status", desc: false } },
  { label: "Fastest first", sort: { column: "speed", desc: true } },
];

export const DEFAULT_SORT: SortState = SORT_CHOICES[0].sort;

/** The Sort menu's label for any sort, including one picked by clicking a header. */
export function sortLabel(sort: SortState, columnLabel: (id: string) => string | undefined): string {
  const hit = SORT_CHOICES.find((c) => c.sort.column === sort.column && c.sort.desc === sort.desc);
  return hit?.label ?? `${columnLabel(sort.column) ?? sort.column} ${sort.desc ? "↓" : "↑"}`;
}

/** Status order for sorting: what needs attention first. */
export const STATUS_RANK: Record<DownloadStatus, number> = {
  running: 0,
  paused: 1,
  interrupted: 2,
  queued: 3,
  failed: 4,
  done: 5,
  cancelled: 6,
};
