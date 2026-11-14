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
