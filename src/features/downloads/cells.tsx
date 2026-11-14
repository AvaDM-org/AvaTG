// The downloads list's cells: name, status and the row's hover actions.
import { IconButton, ProgressBar } from "../../components/ui/controls";
import { Icon } from "../../components/ui/Icon";
import { fmtDuration, fmtEta } from "../../lib/format";
import { playFile, showInFolder } from "./fileActions";
import { useDownloads } from "./store";
import type { DownloadRecord, LiveProgress } from "./types";
import s from "./downloads.module.css";

/** Thumbnail (a note for audio), title, and channel · length underneath. */
export function NameCell({ d }: { d: DownloadRecord }) {
  return (
    <div className={s.nameCell}>
      <div
        className={s.thumb}
        style={{ backgroundImage: d.thumbnail && !d.audioOnly ? `url("${d.thumbnail}")` : undefined }}
      >
        {d.audioOnly && <Icon name="music" size={14} />}
      </div>
      <div className={s.nameText}>
        <b title={d.title}>{d.title}</b>
        <small title={d.dir}>{[d.channel, fmtDuration(d.duration)].filter(Boolean).join(" · ")}</small>
      </div>
    </div>
  );
}

export function StatusCell({ d, live, held }: { d: DownloadRecord; live: LiveProgress | undefined; held: boolean }) {
  const pct = d.percent == null ? null : Math.floor(d.percent);
  switch (d.status) {
    case "running": {
      const transferring = live?.phase === "Video" || live?.phase === "Audio";
      return (
        <div className={s.status}>
          <div className={s.barLine}>
            <ProgressBar percent={transferring ? d.percent : null} />
            <b>{transferring && pct != null ? `${pct}%` : ""}</b>
          </div>
          <div className={s.statusLine}>
            <b className={s.accent}>{live?.phase ?? "Starting"}</b>
            {transferring && live?.eta != null && <span>· {fmtEta(live.eta)} left</span>}
          </div>
        </div>
      );
    }
    case "paused":
      return (
        <div className={s.status}>
          <div className={s.barLine}>
            <ProgressBar percent={d.percent ?? 0} paused />
            <b>{pct != null ? `${pct}%` : ""}</b>
          </div>
          <div className={s.statusLine}>
            <b className={s.warn}>Paused</b>
          </div>
        </div>
      );
    case "queued":
      return (
        <div className={s.statusLine}>
          <b>Queued</b>
          <span>
            ·{" "}
            {held ? "Held until you resume" : d.autoRetries ? `Retrying (${d.autoRetries})` : "Waiting for a free slot"}
          </span>
        </div>
      );
    case "interrupted":
      return (
        <div className={s.statusLine}>
          <span className={s.warn} style={{ display: "contents" }}>
            <Icon name="alert" size={14} />
          </span>
          <b className={s.warn}>Interrupted</b>
          <span>· Stopped when AvaTG closed</span>
        </div>
      );
    case "failed":
      return (
        <div className={s.statusLine} title={d.error ?? undefined}>
          <span className={s.bad} style={{ display: "contents" }}>
            <Icon name="alert" size={14} />
          </span>
          <b className={s.bad}>Failed</b>
          <span>{d.error?.split("\n")[0]}</span>
        </div>
      );
    case "cancelled":
      return (
        <div className={s.statusLine}>
          <b className={s.muted}>Cancelled</b>
          <span>· Partial files deleted</span>
        </div>
      );
    case "done":
      return (
        <div className={s.statusLine}>
          <span className={s.ok} style={{ display: "contents" }}>
            <Icon name="check" size={14} strokeWidth={2} />
          </span>
          <b className={s.ok}>Completed</b>
        </div>
      );
  }
}

export function RowActions({
  d,
  onAskCancel,
  onAskRemove,
}: {
  d: DownloadRecord;
  onAskCancel: () => void;
  onAskRemove: () => void;
}) {
  const { pause, resume } = useDownloads.getState();
  const btn = (icon: Parameters<typeof IconButton>[0]["icon"], label: string, onClick: () => void) => (
    <IconButton key={label} icon={icon} label={label} small onClick={onClick} />
  );
  switch (d.status) {
    case "running":
      return [
        btn("pause", "Pause", () => pause([d.id])),
        btn("x", "Cancel download", onAskCancel),
        btn("folder", "Show in folder", () => showInFolder(d)),
      ];
    case "queued":
      return [btn("pause", "Pause", () => pause([d.id])), btn("x", "Cancel download", onAskCancel)];
    case "paused":
    case "interrupted":
      return [btn("play", "Resume", () => resume([d.id])), btn("x", "Cancel download", onAskCancel)];
    case "failed":
    case "cancelled":
      return [btn("retry", "Try again", () => resume([d.id])), btn("trash", "Remove from list", onAskRemove)];
    case "done":
      return [
        btn("play", "Play", () => playFile(d)),
        btn("folder", "Show in folder", () => showInFolder(d)),
        btn("trash", "Remove from list", onAskRemove),
      ];
  }
}
