// Display formatting: sizes with one decimal, speeds like "2.8 MB/s", times like "1m 12s", 24-hour dates.

export function fmtBytes(b: number | null | undefined): string {
  if (b == null || !Number.isFinite(b)) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (b >= 1024 && i < units.length - 1) {
    b /= 1024;
    i++;
  }
  return `${b.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export const fmtSpeed = (bps: number | null | undefined) => (bps ? `${fmtBytes(bps)}/s` : "");

/** Video length as a clock: "4:05", "1:02:11". */
export function fmtDuration(s: number | null | undefined): string {
  if (s == null) return "";
  s = Math.round(s);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** Time left, short: "45s", "1m 12s", "2h 5m". */
export function fmtEta(s: number | null | undefined): string {
  if (s == null || !Number.isFinite(s)) return "";
  s = Math.max(0, Math.round(s));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

/** Total length, long: "19h 32m", "42m". */
export function fmtTotalLength(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

export const plural = (n: number, word: string) => `${n.toLocaleString("en-US")} ${word}${n === 1 ? "" : "s"}`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A date for lists, 24-hour: "Today, 22:59", "Yesterday, 08:10", "Sep 24, 14:50", "Sep 24, 2025". */
export function fmtDate(ms: number | null | undefined, now = Date.now()): string {
  if (ms == null) return "";
  const d = new Date(ms);
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((day(new Date(now)) - day(d)) / 86_400_000);
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Yesterday, ${time}`;
  const date = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  return d.getFullYear() === new Date(now).getFullYear() ? `${date}, ${time}` : `${date}, ${d.getFullYear()}`;
}

/** A duration of work, short: "4s", "1m 12s", "2h 5m". Like fmtEta, from milliseconds. */
export const fmtTook = (ms: number | null | undefined) => (ms == null ? "" : fmtEta(Math.max(1, ms / 1000)));
