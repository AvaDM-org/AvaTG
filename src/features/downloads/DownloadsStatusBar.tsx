// The status bar under the downloads list (and the playlist page): total speed, Pause all / Resume all,
// downloads at a time, and counts.
import { StatusBar, StatusChip } from "../../components/layout";
import { Icon } from "../../components/ui/Icon";
import { Dropdown, MenuItem } from "../../components/ui/Menu";
import { fmtSpeed } from "../../lib/format";
import { useSettings } from "../settings/store";
import { useDownloads } from "./store";
import type { DownloadStatus } from "./types";

/** Total speed, Pause all / Resume all, downloads at a time, counts. Also shown on the playlist page. */
export function DownloadsStatusBar({
  details,
  selectedCount = 0,
  visibleCount,
  filtered,
}: {
  /** the detail panel's switch, while something is selected */
  details?: { open: boolean; toggle: () => void };
  selectedCount?: number;
  visibleCount?: number;
  filtered?: boolean;
}) {
  const { items, live, held, pauseAll, resumeAll } = useDownloads();
  const { settings, set } = useSettings();
  const speed = Object.values(live).reduce((t, l) => t + (l.speed ?? 0), 0);
  const n = (st: DownloadStatus) => items.filter((d) => d.status === st).length;
  const running = n("running");
  const waiting = n("queued");
  const resumable = n("paused") + n("interrupted");
  const showResume = held || (running === 0 && resumable > 0);

  const parts = [
    [running, "running"],
    [n("paused"), "paused"],
    [n("interrupted"), "interrupted"],
    [waiting, held ? "held" : "queued"],
    [n("failed"), "failed"],
    [n("done"), "completed"],
  ]
    .filter(([c]) => c)
    .map(([c, w]) => `${c} ${w}`);

  return (
    <StatusBar>
      <span style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--fg2)" }}>
        <Icon name="arrowDown" size={13} strokeWidth={2} />
        {held ? "Paused" : speed ? fmtSpeed(speed) : "0 B/s"}
      </span>
      {showResume ? (
        <StatusChip on onClick={resumeAll} title="Resume every paused download and let the waiting ones start again">
          <Icon name="play" size={11} strokeWidth={2.2} />
          Resume all
        </StatusChip>
      ) : (
        (running > 0 || waiting > 0) && (
          <StatusChip
            onClick={pauseAll}
            title="Pause every running download and hold the waiting ones. Nothing is lost"
          >
            <Icon name="pause" size={11} strokeWidth={2.2} />
            Pause all
          </StatusChip>
        )
      )}
      <Dropdown
        label="Downloads at a time"
        width={200}
        up
        trigger={({ toggle }) => (
          <StatusChip onClick={toggle} title="How many downloads run at the same time">
            {settings.concurrency} at a time
          </StatusChip>
        )}
      >
        {(close) =>
          [1, 2, 3, 4, 5].map((c) => (
            <MenuItem
              key={c}
              checked={settings.concurrency === c}
              onSelect={() => {
                set("concurrency", c);
                close();
              }}
            >
              {c} at a time
            </MenuItem>
          ))
        }
      </Dropdown>
      <div style={{ flex: 1 }} />
      {details && (
        <StatusChip on={details.open} onClick={details.toggle} title="Show or hide the details of the selection">
          Details
        </StatusChip>
      )}
      <span>
        {selectedCount ? `${selectedCount} of ${visibleCount} selected` : filtered ? `${visibleCount} shown · ` : ""}
        {selectedCount ? "" : parts.join(" · ")}
      </span>
    </StatusBar>
  );
}
