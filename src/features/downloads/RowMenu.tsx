// The right-click menu of one or more downloads.
import { Menu, MenuDivider, MenuItem, type Point } from "../../components/ui/Menu";
import { copyLinks, openOnSite, playFile, showInFolder } from "./fileActions";
import { useDownloads } from "./store";
import type { DownloadRecord, DownloadStatus } from "./types";

/** A confirmation the page shows before acting. */
export type Ask = { kind: "cancel" | "remove" | "delete"; items: DownloadRecord[] } | null;

export function RowMenu({
  at,
  items,
  onClose,
  onAsk,
  onDownloadAgain,
}: {
  at: Point;
  items: DownloadRecord[];
  onClose: () => void;
  onAsk: (a: Ask) => void;
  onDownloadAgain: (d: DownloadRecord) => void;
}) {
  const { pause, resume } = useDownloads.getState();
  const one = items.length === 1 ? items[0] : null;
  const has = (...st: DownloadStatus[]) => items.some((d) => st.includes(d.status));
  const run = (f: () => unknown) => () => {
    f();
    onClose();
  };
  const ids = items.map((d) => d.id);
  return (
    <Menu at={at} onClose={onClose} label="Download actions">
      {one?.status === "done" && <MenuItem onSelect={run(() => playFile(one))}>Play</MenuItem>}
      {has("running", "queued") && <MenuItem onSelect={run(() => pause(ids))}>Pause</MenuItem>}
      {has("paused", "interrupted") && <MenuItem onSelect={run(() => resume(ids))}>Resume</MenuItem>}
      {has("failed", "cancelled") && <MenuItem onSelect={run(() => resume(ids))}>Try again</MenuItem>}
      {one && <MenuItem onSelect={run(() => showInFolder(one))}>Show in folder</MenuItem>}
      {one && <MenuItem onSelect={run(() => openOnSite(one))}>Open on YouTube</MenuItem>}
      <MenuItem onSelect={run(() => copyLinks(items))}>
        {items.length === 1 ? "Copy video link" : "Copy links"}
      </MenuItem>
      {one && !["running", "queued"].includes(one.status) && (
        <MenuItem onSelect={run(() => onDownloadAgain(one))}>Download again with other options…</MenuItem>
      )}
      <MenuDivider />
      {has("running", "queued", "paused", "interrupted") && (
        <MenuItem onSelect={run(() => onAsk({ kind: "cancel", items: items.filter((d) => d.status !== "done") }))}>
          Cancel download…
        </MenuItem>
      )}
      <MenuItem hint="Del" onSelect={run(() => onAsk({ kind: "remove", items }))}>
        Remove from list
      </MenuItem>
      {has("done") && (
        <MenuItem
          danger
          onSelect={run(() => onAsk({ kind: "delete", items: items.filter((d) => d.status === "done") }))}
        >
          Delete files…
        </MenuItem>
      )}
    </Menu>
  );
}
