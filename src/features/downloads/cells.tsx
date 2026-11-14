// The downloads list's cells (name, status), and the actions for a download in each state.
import { IconButton, ProgressBar } from "../../components/ui/controls";
import { Icon, type IconName } from "../../components/ui/Icon";
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

export interface DownloadAction {
  icon: IconName;
  label: string;
  run: () => void;
  danger?: boolean;
}

/** What can be done with a download in its state, most useful first. Used by the row and the detail panel. */
export function actionsFor(d: DownloadRecord, ask: { cancel: () => void; remove: () => void }): DownloadAction[] {
  const { pause, resume } = useDownloads.getState();
  const pauseIt = { icon: "pause", label: "Pause", run: () => pause([d.id]) } as const;
  const resumeIt = { icon: "play", label: "Resume", run: () => resume([d.id]) } as const;
  const cancelIt = { icon: "x", label: "Cancel download", run: ask.cancel } as const;
  const folder = { icon: "folder", label: "Show in folder", run: () => void showInFolder(d) } as const;
  const remove = { icon: "trash", label: "Remove from list", run: ask.remove } as const;
  switch (d.status) {
    case "running":
      return [pauseIt, cancelIt, folder];
    case "queued":
      return [pauseIt, cancelIt];
    case "paused":
    case "interrupted":
      return [resumeIt, cancelIt];
    case "failed":
    case "cancelled":
      return [{ icon: "retry", label: "Try again", run: () => resume([d.id]) }, remove];
    case "done":
      return [{ icon: "play", label: "Play", run: () => void playFile(d) }, folder, remove];
  }
}

/** The row's hover buttons. */
export function RowActions({
  d,
  onAskCancel,
  onAskRemove,
}: {
  d: DownloadRecord;
  onAskCancel: () => void;
  onAskRemove: () => void;
}) {
  return actionsFor(d, { cancel: onAskCancel, remove: onAskRemove }).map((a) => (
    <IconButton key={a.label} icon={a.icon} label={a.label} small onClick={a.run} />
  ));
}
