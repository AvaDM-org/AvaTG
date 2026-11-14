// The home screen: every download in one table, with search, status filter, sort, multi-select and bulk actions.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DragSpace, StatusBar, StatusChip, TopBar } from "../../components/layout";
import { WindowControls } from "../../components/WindowControls";
import { Button, Checkbox, IconButton, TextField } from "../../components/ui/controls";
import { Confirm } from "../../components/ui/Dialog";
import { Icon } from "../../components/ui/Icon";
import { Dropdown, Menu, MenuDivider, MenuItem, MenuTitle, type Point } from "../../components/ui/Menu";
import { fmtSpeed, plural } from "../../lib/format";
import { usePicker } from "../picker/store";
import { useSettings } from "../settings/store";
import { DownloadRow } from "./DownloadRow";
import { copyLinks, openOnSite, playFile, showInFolder } from "./fileActions";
import { useDownloads } from "./store";
import type { DownloadRecord, DownloadStatus } from "./types";
import s from "./downloads.module.css";

type StatusFilter = "all" | "running" | "paused" | "queued" | "failed" | "done" | "cancelled";
type SortKey = "newest" | "name" | "size" | "status";

const FILTERS: { value: StatusFilter; label: string; match: DownloadStatus[] }[] = [
  { value: "all", label: "All", match: [] },
  { value: "running", label: "Running", match: ["running"] },
  { value: "paused", label: "Paused", match: ["paused", "interrupted"] },
  { value: "queued", label: "Queued", match: ["queued"] },
  { value: "failed", label: "Failed", match: ["failed"] },
  { value: "done", label: "Completed", match: ["done"] },
  { value: "cancelled", label: "Cancelled", match: ["cancelled"] },
];
const SORTS: { value: SortKey; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "name", label: "Name" },
  { value: "size", label: "Size" },
  { value: "status", label: "Status" },
];
const STATUS_RANK: Record<DownloadStatus, number> = {
  running: 0,
  paused: 1,
  interrupted: 2,
  queued: 3,
  failed: 4,
  done: 5,
  cancelled: 6,
};

const filterOf = (v: StatusFilter) => FILTERS.find((f) => f.value === v) ?? FILTERS[0];
const sortLabel = (v: SortKey) => SORTS.find((o) => o.value === v)?.label ?? "";

type Ask = { kind: "cancel" | "remove" | "delete"; items: DownloadRecord[] } | null;

export function DownloadsPage({
  onOpenSettings,
  onAddFromClipboard,
}: {
  onOpenSettings: () => void;
  onAddFromClipboard: () => void;
}) {
  const { items, live, held, pause, resume, cancel, remove } = useDownloads();
  const doubleClick = useSettings((st) => st.settings.doubleClick);
  const askLink = usePicker((st) => st.ask);
  const openPicker = usePicker((st) => st.open);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<{ at: Point; items: DownloadRecord[] } | null>(null);
  const [ask, setAsk] = useState<Ask>(null);
  const anchor = useRef<string | null>(null);
  const searchBox = useRef<HTMLDivElement>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = filterOf(filter).match;
    const list = items.filter(
      (d) =>
        (!match.length || match.includes(d.status)) &&
        (!q || d.title.toLowerCase().includes(q) || d.channel?.toLowerCase().includes(q) || d.url.includes(q)),
    );
    const by: Record<SortKey, (a: DownloadRecord, b: DownloadRecord) => number> = {
      newest: (a, b) => b.createdAt - a.createdAt,
      name: (a, b) => a.title.localeCompare(b.title),
      size: (a, b) => (b.sizeBytes ?? 0) - (a.sizeBytes ?? 0),
      status: (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || b.createdAt - a.createdAt,
    };
    return list.sort(by[sort]);
  }, [items, query, filter, sort]);

  const selectedItems = visible.filter((d) => selected.has(d.id));

  const onSelect = useCallback(
    (id: string, e: React.MouseEvent, viaCheckbox: boolean) => {
      const ids = visible.map((d) => d.id);
      if (e.shiftKey && anchor.current && ids.includes(anchor.current)) {
        const [a, b] = [ids.indexOf(anchor.current), ids.indexOf(id)].sort((x, y) => x - y);
        setSelected(new Set(ids.slice(a, b + 1)));
        return;
      }
      anchor.current = id;
      setSelected((sel) => {
        if (viaCheckbox || e.ctrlKey || e.metaKey) {
          const next = new Set(sel);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        }
        return new Set([id]);
      });
    },
    [visible],
  );

  const openRow = (d: DownloadRecord) => {
    if (d.status !== "done") return;
    if (doubleClick === "play") void playFile(d);
    else void showInFolder(d);
  };

  // Keyboard: Ctrl+K search, Ctrl+A select all, Esc clears the selection, Delete removes it.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest("input, textarea, [role=dialog], [role=menu]");
      if (e.ctrlKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchBox.current?.querySelector("input")?.focus();
      } else if (typing) {
        return;
      } else if (e.ctrlKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSelected(new Set(visible.map((d) => d.id)));
      } else if (e.key === "Escape") {
        setSelected(new Set());
      } else if (e.key === "Delete" && selectedItems.length) {
        setAsk({ kind: "remove", items: selectedItems });
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [visible, selectedItems]);

  const counts = useMemo(() => {
    const c = Object.fromEntries(FILTERS.map((f) => [f.value, 0])) as Record<StatusFilter, number>;
    for (const d of items) {
      c.all++;
      const f = FILTERS.find((x) => x.match.includes(d.status));
      if (f) c[f.value]++;
    }
    return c;
  }, [items]);

  const allVisibleSelected = visible.length > 0 && selectedItems.length === visible.length;
  const ids = (list: DownloadRecord[]) => list.map((d) => d.id);

  return (
    <>
      <TopBar>
        {selectedItems.length > 0 ? (
          <>
            <Checkbox
              label="Select all"
              checked={allVisibleSelected}
              indeterminate={!allVisibleSelected}
              onChange={() => setSelected(allVisibleSelected ? new Set() : new Set(ids(visible)))}
            />
            <span className={s.selCount}>{selectedItems.length} selected</span>
            <div className={s.vdivider} />
            <Button
              icon="play"
              disabled={!selectedItems.some((d) => ["paused", "interrupted", "failed", "cancelled"].includes(d.status))}
              onClick={() => resume(ids(selectedItems))}
            >
              Resume
            </Button>
            <Button
              icon="pause"
              disabled={!selectedItems.some((d) => d.status === "running" || d.status === "queued")}
              onClick={() => pause(ids(selectedItems))}
            >
              Pause
            </Button>
            <Button icon="folder" onClick={() => void showInFolder(selectedItems[0])}>
              Show in folder
            </Button>
            <Button variant="danger" icon="trash" onClick={() => setAsk({ kind: "remove", items: selectedItems })}>
              Remove
            </Button>
            <DragSpace />
            <Button variant="text" onClick={() => setSelected(new Set())} title="Esc">
              Clear selection
            </Button>
          </>
        ) : (
          <>
            <div ref={searchBox} className={s.search}>
              <TextField
                label="Search downloads"
                placeholder="Search downloads"
                value={query}
                onChange={setQuery}
                leading={<Icon name="search" size={15} />}
                trailing={<span className={s.kbd}>Ctrl K</span>}
              />
            </div>
            <div className={s.vdivider} />
            <Dropdown
              label="Filter by status"
              width={232}
              trigger={({ open, toggle }) => (
                <button type="button" className={s.trigger} aria-expanded={open} onClick={toggle}>
                  <span>Status</span>
                  <b>{filterOf(filter).label}</b>
                  <Icon name="chevronDown" size={14} />
                </button>
              )}
            >
              {(close) => (
                <>
                  <MenuTitle>FILTER BY STATUS</MenuTitle>
                  {FILTERS.filter((f) => f.value !== "cancelled" || counts.cancelled > 0).map((f) => (
                    <MenuItem
                      key={f.value}
                      checked={filter === f.value}
                      hint={counts[f.value]}
                      onSelect={() => {
                        setFilter(f.value);
                        close();
                      }}
                    >
                      {f.label}
                    </MenuItem>
                  ))}
                </>
              )}
            </Dropdown>
            <Dropdown
              label="Sort"
              width={200}
              trigger={({ open, toggle }) => (
                <button type="button" className={s.trigger} aria-expanded={open} onClick={toggle}>
                  <Icon name="sort" size={15} />
                  <span>Sort</span>
                  <b>{sortLabel(sort)}</b>
                  <Icon name="chevronDown" size={14} />
                </button>
              )}
            >
              {(close) =>
                SORTS.map((o) => (
                  <MenuItem
                    key={o.value}
                    checked={sort === o.value}
                    onSelect={() => {
                      setSort(o.value);
                      close();
                    }}
                  >
                    {o.label}
                  </MenuItem>
                ))
              }
            </Dropdown>
            <DragSpace />
          </>
        )}
        <IconButton icon="clipboard" label="Add link from clipboard (Ctrl+V)" onClick={onAddFromClipboard} />
        <Button variant="primary" icon="plus" onClick={askLink}>
          Add link
        </Button>
        <IconButton icon="settings" label="Settings" onClick={onOpenSettings} />
        <WindowControls />
      </TopBar>

      <div className={s.header}>
        <div className={s.cCheck} />
        <div className={s.cName}>
          <button
            type="button"
            data-active={sort === "name" || undefined}
            onClick={() => setSort(sort === "name" ? "newest" : "name")}
            title="Sort by name"
          >
            NAME
          </button>
        </div>
        <div className={s.cFormat}>FORMAT</div>
        <div className={s.cSize}>
          <button
            type="button"
            data-active={sort === "size" || undefined}
            onClick={() => setSort(sort === "size" ? "newest" : "size")}
            title="Sort by size"
          >
            SIZE
          </button>
        </div>
        <div className={s.cStatus}>
          <button
            type="button"
            data-active={sort === "status" || undefined}
            onClick={() => setSort(sort === "status" ? "newest" : "status")}
            title="Sort by status"
          >
            STATUS
          </button>
        </div>
        <div className={s.cSpeed}>SPEED</div>
        <div className={s.cActions} />
      </div>

      <div className={s.list} onClick={(e) => e.target === e.currentTarget && setSelected(new Set())}>
        {visible.map((d) => (
          <DownloadRow
            key={d.id}
            d={d}
            live={live[d.id]}
            held={held}
            selected={selected.has(d.id)}
            onSelect={(e, viaCheckbox) => onSelect(d.id, e, viaCheckbox)}
            onOpen={() => openRow(d)}
            onMenu={(e) => {
              e.preventDefault();
              const target = selected.has(d.id) ? selectedItems : [d];
              if (!selected.has(d.id)) setSelected(new Set([d.id]));
              setMenu({ at: { x: e.clientX, y: e.clientY }, items: target });
            }}
            onAskCancel={() => setAsk({ kind: "cancel", items: [d] })}
            onAskRemove={() => setAsk({ kind: "remove", items: [d] })}
          />
        ))}
        {items.length === 0 && (
          <div className={s.empty}>
            <b>No downloads yet</b>
            <span>Copy a YouTube link and press Ctrl+V here, drop a link on this window, or use Add link.</span>
          </div>
        )}
        {items.length > 0 && visible.length === 0 && (
          <div className={s.empty}>Nothing matches the search or filter.</div>
        )}
      </div>

      <DownloadsStatusBar
        selectedCount={selectedItems.length}
        visibleCount={visible.length}
        filtered={filter !== "all" || !!query}
      />

      {menu && (
        <RowMenu
          at={menu.at}
          items={menu.items}
          onClose={() => setMenu(null)}
          onAsk={setAsk}
          onDownloadAgain={(d) => void openPicker([d.url])}
        />
      )}

      {ask?.kind === "cancel" && (
        <Confirm
          title="Cancel download?"
          message="The part downloaded so far is deleted, so it can only start again from the beginning."
          action="Cancel download"
          onConfirm={() => cancel(ids(ask.items))}
          onClose={() => setAsk(null)}
        />
      )}
      {ask?.kind === "remove" && (
        <Confirm
          title={
            ask.items.length === 1 ? "Remove from the list?" : `Remove ${ask.items.length} downloads from the list?`
          }
          message={
            <>
              {ask.items.length === 1 ? `“${ask.items[0].title}”` : plural(ask.items.length, "download")} will be taken
              off the list.
              {ask.items.some((d) => d.status === "running") ? " Running downloads stop." : ""} The files stay on your
              computer.
            </>
          }
          action="Remove"
          onConfirm={() => remove(ids(ask.items), false)}
          onClose={() => setAsk(null)}
        />
      )}
      {ask?.kind === "delete" && (
        <Confirm
          title={ask.items.length === 1 ? "Delete the file from disk?" : `Delete ${ask.items.length} files from disk?`}
          message="The files are deleted and the downloads are removed from the list. This can't be undone."
          action="Delete files"
          onConfirm={() => remove(ids(ask.items), true)}
          onClose={() => setAsk(null)}
        />
      )}
    </>
  );
}

function RowMenu({
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

/** Total speed, Pause all / Resume all, downloads at a time, counts. Also shown on the playlist page. */
export function DownloadsStatusBar({
  selectedCount = 0,
  visibleCount,
  filtered,
}: {
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
      <span>
        {selectedCount ? `${selectedCount} of ${visibleCount} selected` : filtered ? `${visibleCount} shown · ` : ""}
        {selectedCount ? "" : parts.join(" · ")}
      </span>
    </StatusBar>
  );
}
