// A list with file-manager columns: drag a header to move it, drag its right edge to resize it, right-click the
// header row to show or hide columns, click a header to sort (again to reverse). Rows are virtualized: only the
// ones in view are in the DOM, so lists of thousands stay fast. Knows nothing about what the rows are.
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Icon } from "../ui/Icon";
import { Menu, MenuDivider, MenuItem, MenuTitle, type Point } from "../ui/Menu";
import {
  gridTemplate,
  moveColumn,
  nextSort,
  resizeColumn,
  resolveColumns,
  stepColumn,
  toggleColumn,
  visibleRange,
  type ColumnLayout,
  type ColumnSpec,
  type SortState,
} from "./layout";
import s from "./table.module.css";

export interface Column<T> extends ColumnSpec<T> {
  render: (row: T) => ReactNode;
  /** header tooltip */
  title?: string;
  className?: string;
}

/** A fixed column before or after the user's columns (a checkbox, row actions). */
export interface FixedColumn<T> {
  width: number;
  header?: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
}

export interface RowProps {
  selected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

interface Props<T> {
  label: string;
  rows: T[];
  rowKey: (row: T) => string;
  columns: Column<T>[];
  layout: ColumnLayout | null;
  onLayoutChange: (layout: ColumnLayout | null) => void;
  sort: SortState;
  onSortChange: (sort: SortState) => void;
  /** px; must match the row's CSS height */
  rowHeight: number;
  lead?: FixedColumn<T>;
  trail?: FixedColumn<T>;
  rowProps?: (row: T) => RowProps;
  rowClassName?: string;
  /** a click on the empty part of the list */
  onBackgroundClick?: () => void;
  /** shown instead of rows when there are none */
  empty?: ReactNode;
}

const DRAG_THRESHOLD = 4;

export function DataTable<T>(p: Props<T>) {
  const head = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState({ top: 0, height: 0 });
  // While a resize grip is dragged: that column's width, applied live and saved on release.
  const [live, setLive] = useState<{ id: string; px: number } | null>(null);
  const [drag, setDrag] = useState<{ id: string; dx: number; beforeId: string | null; x: number } | null>(null);
  const [menu, setMenu] = useState<{ at: Point; id: string | null } | null>(null);
  const suppressClick = useRef(false);

  const cols = resolveColumns(p.columns, p.layout).map((c) => (live?.id === c.id ? { ...c, px: live.px } : c));
  const template = gridTemplate(cols, p.lead?.width, p.trail?.width);
  const minWidth = cols.reduce((t, c) => t + c.px, (p.lead?.width ?? 0) + (p.trail?.width ?? 0));
  const gridStyle = { "--cols": template, "--min-width": `${minWidth}px` } as CSSProperties;

  useLayoutEffect(() => {
    const el = body.current;
    if (!el) return;
    const measure = () => setScroll({ top: el.scrollTop, height: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { start, end } = visibleRange(scroll.top, scroll.height, p.rowHeight, p.rows.length);
  const onScroll = () => {
    const el = body.current;
    if (!el) return;
    if (head.current) head.current.scrollLeft = el.scrollLeft;
    if (el.scrollTop !== scroll.top) setScroll({ top: el.scrollTop, height: el.clientHeight });
  };

  /** Header cells' horizontal extents, read when a drag starts. */
  const headerRects = () =>
    [...(head.current?.querySelectorAll<HTMLElement>("[data-col]") ?? [])].map((el) => ({
      id: el.dataset.col as string,
      rect: el.getBoundingClientRect(),
    }));

  const startMove = (e: React.PointerEvent, id: string) => {
    if (e.button !== 0) return;
    const x0 = e.clientX;
    const rects = headerRects();
    const headLeft = head.current?.getBoundingClientRect().left ?? 0;
    let moved = false;
    let target: string | null = id;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - x0;
      if (!moved && Math.abs(dx) < DRAG_THRESHOLD) return;
      moved = true;
      // Drop before the first column whose middle is right of the pointer.
      const hit = rects.find((r) => r.id !== id && ev.clientX < r.rect.left + r.rect.width / 2);
      target = hit?.id ?? null;
      const edge = hit ? hit.rect.left : (rects.at(-1)?.rect.right ?? 0);
      setDrag({ id, dx, beforeId: target, x: edge - headLeft + (head.current?.scrollLeft ?? 0) });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDrag(null);
      if (!moved) return;
      suppressClick.current = true;
      if (target !== id) p.onLayoutChange(moveColumn(p.columns, p.layout, id, target));
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const startResize = (e: React.PointerEvent<HTMLElement>, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    // Start from the drawn width: a growing column can be wider than its set width.
    const px = e.currentTarget.parentElement?.getBoundingClientRect().width ?? 0;
    const x0 = e.clientX;
    let width = px;
    const move = (ev: PointerEvent) => {
      width = px + ev.clientX - x0;
      setLive({ id, px: Math.max(p.columns.find((c) => c.id === id)?.minWidth ?? 48, width) });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setLive(null);
      p.onLayoutChange(resizeColumn(p.columns, p.layout, id, width));
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const clickHeader = (c: Column<T>) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (c.compare) p.onSortChange(nextSort(p.sort, c));
  };

  const ids = cols.map((c) => c.id);
  const menuIndex = menu?.id ? ids.indexOf(menu.id) : -1;

  return (
    <div className={s.table} style={gridStyle}>
      <div
        ref={head}
        className={s.head}
        role="row"
        onContextMenu={(e) => {
          e.preventDefault();
          const id = (e.target as HTMLElement).closest<HTMLElement>("[data-col]")?.dataset.col ?? null;
          setMenu({ at: { x: e.clientX, y: e.clientY }, id });
        }}
      >
        <div className={s.headRow}>
          {p.lead && <div className={s.fixed}>{p.lead.header}</div>}
          {cols.map((c) => {
            const sorted = p.sort.column === c.id;
            const dragging = drag?.id === c.id;
            return (
              <div
                key={c.id}
                data-col={c.id}
                role="columnheader"
                aria-sort={sorted ? (p.sort.desc ? "descending" : "ascending") : undefined}
                className={s.headCell}
                data-dragging={dragging || undefined}
                style={dragging ? { transform: `translateX(${drag.dx}px)` } : undefined}
              >
                <button
                  type="button"
                  className={s.headButton}
                  data-active={sorted || undefined}
                  data-sortable={!!c.compare || undefined}
                  title={c.title ?? (c.compare ? `Sort by ${c.label.toLowerCase()}. Drag to move` : "Drag to move")}
                  onPointerDown={(e) => startMove(e, c.id)}
                  onClick={() => clickHeader(c)}
                >
                  <span>{c.label}</span>
                  {sorted && <Icon name={p.sort.desc ? "chevronDown" : "chevronUp"} size={12} strokeWidth={2.2} />}
                </button>
                <span
                  className={s.grip}
                  title="Drag to resize"
                  onPointerDown={(e) => startResize(e, c.id)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            );
          })}
          {p.trail && <div className={s.fixed} />}
          {drag && <div className={s.dropMark} style={{ left: drag.x }} />}
        </div>
      </div>

      <div
        ref={body}
        className={s.body}
        role="rowgroup"
        aria-label={p.label}
        onScroll={onScroll}
        onClick={(e) => e.target === e.currentTarget && p.onBackgroundClick?.()}
      >
        {p.rows.length === 0 ? (
          p.empty
        ) : (
          <div
            className={s.rows}
            style={{ height: p.rows.length * p.rowHeight, paddingTop: start * p.rowHeight }}
            onClick={(e) => e.target === e.currentTarget && p.onBackgroundClick?.()}
          >
            {p.rows.slice(start, end).map((row) => {
              const rp = p.rowProps?.(row) ?? {};
              return (
                <div
                  key={p.rowKey(row)}
                  role="row"
                  aria-selected={rp.selected}
                  className={`${s.row} ${p.rowClassName ?? ""}`}
                  data-selected={rp.selected || undefined}
                  onClick={rp.onClick}
                  onDoubleClick={rp.onDoubleClick}
                  onContextMenu={rp.onContextMenu}
                >
                  {p.lead && <div className={`${s.fixed} ${p.lead.className ?? ""}`}>{p.lead.cell(row)}</div>}
                  {cols.map((c) => (
                    <div key={c.id} role="cell" className={`${s.cell} ${c.className ?? ""}`}>
                      {c.render(row)}
                    </div>
                  ))}
                  {p.trail && <div className={`${s.fixed} ${p.trail.className ?? ""}`}>{p.trail.cell(row)}</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {menu && (
        <Menu at={menu.at} onClose={() => setMenu(null)} label="Columns" width={220}>
          <MenuTitle>COLUMNS</MenuTitle>
          {p.columns.map((c) => (
            <MenuItem
              key={c.id}
              checked={ids.includes(c.id)}
              disabled={c.hideable === false}
              onSelect={() => p.onLayoutChange(toggleColumn(p.columns, p.layout, c.id))}
            >
              {c.label}
            </MenuItem>
          ))}
          <MenuDivider />
          {menu.id && (
            <>
              <MenuItem
                disabled={menuIndex <= 0}
                onSelect={() => {
                  p.onLayoutChange(stepColumn(p.columns, p.layout, menu.id as string, -1));
                  setMenu(null);
                }}
              >
                Move left
              </MenuItem>
              <MenuItem
                disabled={menuIndex < 0 || menuIndex >= ids.length - 1}
                onSelect={() => {
                  p.onLayoutChange(stepColumn(p.columns, p.layout, menu.id as string, 1));
                  setMenu(null);
                }}
              >
                Move right
              </MenuItem>
            </>
          )}
          <MenuItem
            onSelect={() => {
              p.onLayoutChange(null);
              setMenu(null);
            }}
          >
            Reset columns
          </MenuItem>
        </Menu>
      )}
    </div>
  );
}
