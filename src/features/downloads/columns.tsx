// The downloads list's columns. Name is always shown; the rest can be moved, resized and hidden.
import type { Column } from "../../components/table/DataTable";
import { fmtBytes, fmtDate, fmtDuration, fmtSpeed, fmtTook } from "../../lib/format";
import { NameCell, StatusCell } from "./cells";
import type { DownloadRecord } from "./types";
import { STATUS_RANK, type DownloadRow } from "./view";
import s from "./downloads.module.css";

const dash = <span className={s.muted}>—</span>;
const num = (v: string) => (v ? <span className="tnum">{v}</span> : dash);
const byNumber = (f: (d: DownloadRecord) => number | null | undefined) => (a: DownloadRow, b: DownloadRow) =>
  (f(a.d) ?? -1) - (f(b.d) ?? -1);
const byText = (f: (d: DownloadRecord) => string | null | undefined) => (a: DownloadRow, b: DownloadRow) =>
  (f(a.d) ?? "").localeCompare(f(b.d) ?? "");

/** Average speed of a finished download: its size over the time spent receiving data. */
export const averageSpeed = (d: DownloadRecord) =>
  d.status === "done" && d.sizeBytes && d.transferMs ? d.sizeBytes / (d.transferMs / 1000) : null;

const speedNow = (r: DownloadRow) => (r.d.status === "running" ? (r.live?.speed ?? 0) : -1);

export const DOWNLOAD_COLUMNS: Column<DownloadRow>[] = [
  {
    id: "name",
    label: "Name",
    width: 320,
    minWidth: 220,
    hideable: false,
    grow: true,
    compare: byText((d) => d.title),
    render: (r) => <NameCell d={r.d} />,
  },
  {
    id: "format",
    label: "Format",
    width: 124,
    compare: byText((d) => d.formatLabel),
    render: (r) => <span className={s.format}>{r.d.formatLabel}</span>,
  },
  {
    id: "size",
    label: "Size",
    width: 88,
    descFirst: true,
    compare: byNumber((d) => d.sizeBytes),
    render: (r) => num(fmtBytes(r.d.sizeBytes)),
  },
  {
    id: "status",
    label: "Status",
    width: 220,
    minWidth: 140,
    compare: (a, b) => STATUS_RANK[a.d.status] - STATUS_RANK[b.d.status],
    render: (r) => <StatusCell d={r.d} live={r.live} held={r.held} />,
  },
  {
    id: "speed",
    label: "Speed",
    width: 92,
    descFirst: true,
    compare: (a, b) => speedNow(a) - speedNow(b),
    render: (r) => num(r.d.status === "running" ? fmtSpeed(r.live?.speed) : ""),
  },
  {
    id: "added",
    label: "Added",
    width: 124,
    descFirst: true,
    compare: byNumber((d) => d.createdAt),
    render: (r) => <span className={s.format}>{fmtDate(r.d.createdAt)}</span>,
  },
  {
    id: "channel",
    label: "Channel",
    width: 150,
    visible: false,
    compare: byText((d) => d.channel),
    render: (r) => (r.d.channel ? <span title={r.d.channel}>{r.d.channel}</span> : dash),
  },
  {
    id: "duration",
    label: "Length",
    width: 80,
    visible: false,
    descFirst: true,
    compare: byNumber((d) => d.duration),
    render: (r) => num(fmtDuration(r.d.duration)),
  },
  {
    id: "took",
    label: "Took",
    width: 84,
    visible: false,
    descFirst: true,
    compare: byNumber((d) => (d.status === "done" ? d.activeMs : null)),
    render: (r) => num(r.d.status === "done" && r.d.activeMs ? fmtTook(r.d.activeMs) : ""),
  },
  {
    id: "avgSpeed",
    label: "Avg speed",
    width: 96,
    visible: false,
    descFirst: true,
    compare: byNumber(averageSpeed),
    render: (r) => num(fmtSpeed(averageSpeed(r.d))),
  },
  {
    id: "folder",
    label: "Folder",
    width: 200,
    visible: false,
    compare: byText((d) => d.dir),
    render: (r) => (
      <span className={s.format} title={r.d.dir}>
        {r.d.dir}
      </span>
    ),
  },
];

export const columnLabel = (id: string) => DOWNLOAD_COLUMNS.find((c) => c.id === id)?.label;
