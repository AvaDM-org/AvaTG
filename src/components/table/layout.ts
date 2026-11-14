// Pure logic behind DataTable: which columns show, in what order and how wide; sorting; and which rows are in
// view. Nothing here knows about downloads, so the table can serve any list (AvaDM's included).

/** What the user changed about the columns. Saved as-is by the owner of the table. */
export interface ColumnLayout {
  order: string[];
  hidden: string[];
  widths: Record<string, number>;
}

/** The parts of a column definition that layout and sorting need. */
export interface ColumnSpec<T> {
  id: string;
  label: string;
  /** default width in px */
  width: number;
  /** narrowest the user can drag it, px (default 48) */
  minWidth?: number;
  /** false: always shown (e.g. Name) */
  hideable?: boolean;
  /** shown unless the user turns it on (default true) */
  visible?: boolean;
  /** this column takes the spare width when the table is wider than its columns, until the user resizes it */
  grow?: boolean;
  /** ascending comparison; columns without one can't be sorted */
  compare?: (a: T, b: T) => number;
  /** the first click on the header sorts descending (sizes, dates) */
  descFirst?: boolean;
}

export interface SortState {
  column: string;
  desc: boolean;
}

export const DEFAULT_MIN_WIDTH = 48;

export const emptyLayout = (): ColumnLayout => ({ order: [], hidden: [], widths: {} });

/** Every column in the user's order. Columns missing from a saved layout (added in a later version) go after
 *  the column they follow in `defs`; saved ids that no longer exist are ignored. */
function ordered<C extends ColumnSpec<never>>(defs: C[], l: ColumnLayout): C[] {
  const list = l.order.flatMap((id) => defs.filter((d) => d.id === id));
  defs.forEach((d, i) => {
    if (list.includes(d)) return;
    const prev = i > 0 ? list.indexOf(defs[i - 1]) : -1;
    list.splice(prev + 1, 0, d);
  });
  return list;
}

const isShown = (d: ColumnSpec<never>, l: ColumnLayout) =>
  d.hideable === false || (l.order.includes(d.id) ? !l.hidden.includes(d.id) : d.visible !== false);

const minWidthOf = (d: ColumnSpec<never>) => d.minWidth ?? DEFAULT_MIN_WIDTH;

/** The columns to draw, in order, with their widths in px. */
export function resolveColumns<C extends ColumnSpec<never>>(
  defs: C[],
  layout: ColumnLayout | null,
): (C & { px: number })[] {
  const l = layout ?? emptyLayout();
  return ordered(defs, l)
    .filter((d) => isShown(d, l))
    .map((d) => ({
      ...d,
      px: Math.max(minWidthOf(d), l.widths[d.id] ?? d.width),
      // Once the user has sized the growing column it keeps that width, like a file manager.
      grow: !!d.grow && l.widths[d.id] == null,
    }));
}

/** The complete layout as shown now (every column's place and visibility), ready to be edited and saved. */
function snapshot(defs: ColumnSpec<never>[], layout: ColumnLayout | null): ColumnLayout {
  const l = layout ?? emptyLayout();
  const all = ordered(defs, l);
  return {
    order: all.map((d) => d.id),
    hidden: all.filter((d) => !isShown(d, l)).map((d) => d.id),
    widths: { ...l.widths },
  };
}

/** Move `id` so it sits just before `beforeId` (or last when `beforeId` is null). */
export function moveColumn(
  defs: ColumnSpec<never>[],
  layout: ColumnLayout | null,
  id: string,
  beforeId: string | null,
): ColumnLayout {
  const l = snapshot(defs, layout);
  if (id === beforeId) return l;
  const order = l.order.filter((x) => x !== id);
  const at = beforeId === null ? order.length : order.indexOf(beforeId);
  order.splice(at < 0 ? order.length : at, 0, id);
  return { ...l, order };
}

/** Move a column one place left (-1) or right (+1) among the visible columns. */
export function stepColumn(
  defs: ColumnSpec<never>[],
  layout: ColumnLayout | null,
  id: string,
  dir: -1 | 1,
): ColumnLayout {
  const shown = resolveColumns(defs, layout).map((c) => c.id);
  const i = shown.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= shown.length) return snapshot(defs, layout);
  // Moving right means going before the column after the neighbour.
  return moveColumn(defs, layout, id, dir < 0 ? shown[j] : (shown[j + 1] ?? null));
}

export function resizeColumn(
  defs: ColumnSpec<never>[],
  layout: ColumnLayout | null,
  id: string,
  px: number,
): ColumnLayout {
  const l = snapshot(defs, layout);
  const def = defs.find((d) => d.id === id);
  if (!def) return l;
  return { ...l, widths: { ...l.widths, [id]: Math.round(Math.max(minWidthOf(def), px)) } };
}

export function toggleColumn(defs: ColumnSpec<never>[], layout: ColumnLayout | null, id: string): ColumnLayout {
  const l = snapshot(defs, layout);
  if (defs.find((d) => d.id === id)?.hideable === false) return l;
  const hidden = l.hidden.includes(id) ? l.hidden.filter((x) => x !== id) : [...l.hidden, id];
  return { ...l, hidden };
}

/** CSS grid-template-columns for the columns, with fixed `lead`/`trail` columns around them. */
export function gridTemplate(cols: { px: number; grow?: boolean }[], lead = 0, trail = 0): string {
  const parts = cols.map((c) => (c.grow ? `minmax(${c.px}px, 1fr)` : `${c.px}px`));
  if (lead) parts.unshift(`${lead}px`);
  if (trail) parts.push(`${trail}px`);
  return parts.join(" ");
}

/** The sort a header click asks for: the same column reverses, another column starts in its natural direction. */
export function nextSort(current: SortState, col: ColumnSpec<never>): SortState {
  if (current.column === col.id) return { column: col.id, desc: !current.desc };
  return { column: col.id, desc: !!col.descFirst };
}

/** A sorted copy; ties keep their input order. */
export function sortRows<T>(rows: T[], defs: ColumnSpec<T>[], sort: SortState): T[] {
  const cmp = defs.find((d) => d.id === sort.column)?.compare;
  if (!cmp) return rows;
  const dir = sort.desc ? -1 : 1;
  return rows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => cmp(a.row, b.row) * dir || a.i - b.i)
    .map((x) => x.row);
}

/** Rows to render for a fixed row height: those in view plus `overscan` on each side. */
export function visibleRange(
  scrollTop: number,
  viewport: number,
  rowHeight: number,
  count: number,
  overscan = 6,
): { start: number; end: number } {
  const first = Math.floor(Math.max(0, scrollTop) / rowHeight);
  const last = Math.ceil((Math.max(0, scrollTop) + viewport) / rowHeight);
  return { start: Math.max(0, first - overscan), end: Math.min(count, last + overscan) };
}
