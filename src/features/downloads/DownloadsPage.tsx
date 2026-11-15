// The home screen: every download in one table, with search, status and type filters, sort, multi-select and
// bulk actions. The columns, sort and filters are saved in the settings (`downloadsView`).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DragSpace, TopBar } from "../../components/layout";
import { DataTable } from "../../components/table/DataTable";
import { sortRows } from "../../components/table/layout";
import { WindowControls } from "../../components/WindowControls";
import { Button, Checkbox, IconButton, TextField } from "../../components/ui/controls";
import { Confirm } from "../../components/ui/Dialog";
import { Icon } from "../../components/ui/Icon";
import { Dropdown, MenuItem, MenuTitle, type Point } from "../../components/ui/Menu";
import { cssPx } from "../../lib/css";
import { plural } from "../../lib/format";
import { usePicker } from "../picker/store";
import { useSettings, type DownloadsView } from "../settings/store";
import { RowActions } from "./cells";
import { columnLabel, DOWNLOAD_COLUMNS } from "./columns";
import { DownloadDetails } from "./DownloadDetails";
import { DownloadsStatusBar } from "./DownloadsStatusBar";
import { playFile, showInFolder } from "./fileActions";
import { RowMenu, type Ask } from "./RowMenu";
import { useDownloads } from "./store";
import type { DownloadRecord } from "./types";
import { filterCounts, matches, SORT_CHOICES, sortLabel, STATUS_FILTERS, TYPE_FILTERS, type DownloadRow } from "./view";
import s from "./downloads.module.css";

export function DownloadsPage({
  onOpenSettings,
  onAddFromClipboard,
}: {
  onOpenSettings: () => void;
  onAddFromClipboard: () => void;
}) {
  const { items, live, held, pause, resume, cancel, remove } = useDownloads();
  const doubleClick = useSettings((st) => st.settings.doubleClick);
  const view = useSettings((st) => st.settings.downloadsView);
  const detailPanel = useSettings((st) => st.settings.detailPanel);
  const setSetting = useSettings((st) => st.set);
  const setView = useCallback(
    (patch: Partial<DownloadsView>) => setSetting("downloadsView", { ...view, ...patch }),
    [setSetting, view],
  );
  const askLink = usePicker((st) => st.ask);
  const openPicker = usePicker((st) => st.open);

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<{ at: Point; items: DownloadRecord[] } | null>(null);
  const [ask, setAsk] = useState<Ask>(null);
  const anchor = useRef<string | null>(null);
  const searchBox = useRef<HTMLDivElement>(null);
  const rowHeight = useMemo(() => cssPx("--h-row"), []);

  const filter = useMemo(() => ({ query, status: view.status, type: view.type }), [query, view.status, view.type]);
  const rows = useMemo(() => {
    const list: DownloadRow[] = items.filter((d) => matches(d, filter)).map((d) => ({ d, live: live[d.id], held }));
    return sortRows(list, DOWNLOAD_COLUMNS, view.sort);
  }, [items, live, held, filter, view.sort]);
  const visible = useMemo(() => rows.map((r) => r.d), [rows]);
  const counts = useMemo(() => filterCounts(items, filter), [items, filter]);

  const selectedItems = visible.filter((d) => selected.has(d.id));
  const ids = (list: DownloadRecord[]) => list.map((d) => d.id);

  const onSelect = (id: string, e: React.MouseEvent, viaCheckbox: boolean) => {
    const order = ids(visible);
    if (e.shiftKey && anchor.current && order.includes(anchor.current)) {
      const [a, b] = [order.indexOf(anchor.current), order.indexOf(id)].sort((x, y) => x - y);
      setSelected(new Set(order.slice(a, b + 1)));
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
  };

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

  const allVisibleSelected = visible.length > 0 && selectedItems.length === visible.length;
  const statusLabel = STATUS_FILTERS.find((f) => f.value === view.status)?.label ?? "All";
  const typeLabel = TYPE_FILTERS.find((f) => f.value === view.type)?.label ?? "All";

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
              title="Resume"
              disabled={!selectedItems.some((d) => ["paused", "interrupted", "failed", "cancelled"].includes(d.status))}
              onClick={() => resume(ids(selectedItems))}
            >
              <span className={s.label}>Resume</span>
            </Button>
            <Button
              icon="pause"
              title="Pause"
              disabled={!selectedItems.some((d) => d.status === "running" || d.status === "queued")}
              onClick={() => pause(ids(selectedItems))}
            >
              <span className={s.label}>Pause</span>
            </Button>
            <Button icon="folder" title="Show in folder" onClick={() => void showInFolder(selectedItems[0])}>
              <span className={s.label}>Show in folder</span>
            </Button>
            <Button
              variant="danger"
              icon="trash"
              title="Remove"
              onClick={() => setAsk({ kind: "remove", items: selectedItems })}
            >
              <span className={s.label}>Remove</span>
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
                <button
                  type="button"
                  className={s.trigger}
                  data-all={view.status === "all" || undefined}
                  aria-expanded={open}
                  onClick={toggle}
                >
                  <span>Status</span>
                  <b>{statusLabel}</b>
                  <Icon name="chevronDown" size={14} />
                </button>
              )}
            >
              {(close) => (
                <>
                  <MenuTitle>FILTER BY STATUS</MenuTitle>
                  {STATUS_FILTERS.filter((f) => f.value !== "cancelled" || counts.status.cancelled > 0).map((f) => (
                    <MenuItem
                      key={f.value}
                      checked={view.status === f.value}
                      hint={counts.status[f.value]}
                      onSelect={() => {
                        setView({ status: f.value });
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
              label="Filter by type"
              width={200}
              trigger={({ open, toggle }) => (
                <button
                  type="button"
                  className={s.trigger}
                  data-all={view.type === "all" || undefined}
                  aria-expanded={open}
                  onClick={toggle}
                >
                  <span>Type</span>
                  <b>{typeLabel}</b>
                  <Icon name="chevronDown" size={14} />
                </button>
              )}
            >
              {(close) => (
                <>
                  <MenuTitle>FILTER BY TYPE</MenuTitle>
                  {TYPE_FILTERS.map((f) => (
                    <MenuItem
                      key={f.value}
                      checked={view.type === f.value}
                      hint={counts.type[f.value]}
                      onSelect={() => {
                        setView({ type: f.value });
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
                  <b>{sortLabel(view.sort, columnLabel)}</b>
                  <Icon name="chevronDown" size={14} />
                </button>
              )}
            >
              {(close) =>
                SORT_CHOICES.map((o) => (
                  <MenuItem
                    key={o.label}
                    checked={view.sort.column === o.sort.column && view.sort.desc === o.sort.desc}
                    onSelect={() => {
                      setView({ sort: o.sort });
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

      <DataTable
        label="Downloads"
        rows={rows}
        rowKey={(r) => r.d.id}
        columns={DOWNLOAD_COLUMNS}
        layout={view.columns}
        onLayoutChange={(columns) => setView({ columns })}
        sort={view.sort}
        onSortChange={(sort) => setView({ sort })}
        rowHeight={rowHeight}
        rowClassName={s.row}
        lead={{
          width: 40,
          cell: (r) => (
            <Checkbox
              label={`Select ${r.d.title}`}
              checked={selected.has(r.d.id)}
              onChange={(_, e) => onSelect(r.d.id, e, true)}
            />
          ),
        }}
        trail={{
          width: 100,
          className: s.actions,
          cell: (r) => (
            <div className={s.actionsInner} onClick={(e) => e.stopPropagation()}>
              <RowActions
                d={r.d}
                onAskCancel={() => setAsk({ kind: "cancel", items: [r.d] })}
                onAskRemove={() => setAsk({ kind: "remove", items: [r.d] })}
              />
            </div>
          ),
        }}
        rowProps={(r) => ({
          selected: selected.has(r.d.id),
          onClick: (e) => onSelect(r.d.id, e, false),
          onDoubleClick: () => openRow(r.d),
          onContextMenu: (e) => {
            e.preventDefault();
            const target = selected.has(r.d.id) ? selectedItems : [r.d];
            if (!selected.has(r.d.id)) setSelected(new Set([r.d.id]));
            setMenu({ at: { x: e.clientX, y: e.clientY }, items: target });
          },
        })}
        onBackgroundClick={() => setSelected(new Set())}
        empty={
          items.length === 0 ? (
            <div className={s.empty}>
              <b>No downloads yet</b>
              <span>Copy a YouTube link and press Ctrl+V here, drop a link on this window, or use Add link.</span>
            </div>
          ) : (
            <div className={s.empty}>Nothing matches the search or filters.</div>
          )
        }
      />

      {detailPanel && selectedItems.length > 0 && (
        <DownloadDetails items={selectedItems} onAsk={setAsk} onClose={() => setSetting("detailPanel", false)} />
      )}

      <DownloadsStatusBar
        details={
          selectedItems.length > 0
            ? { open: detailPanel, toggle: () => setSetting("detailPanel", !detailPanel) }
            : undefined
        }
        selectedCount={selectedItems.length}
        visibleCount={visible.length}
        filtered={view.status !== "all" || view.type !== "all" || !!query}
      />

      {menu && (
        <RowMenu
          at={menu.at}
          items={menu.items}
          onClose={() => setMenu(null)}
          onAsk={setAsk}
          onDownloadAgain={(d) => void openPicker([d.url])}
          onShowDetails={detailPanel ? undefined : () => setSetting("detailPanel", true)}
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
