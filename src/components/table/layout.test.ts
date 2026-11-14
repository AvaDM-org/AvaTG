import { describe, expect, it } from "vitest";
import {
  gridTemplate,
  moveColumn,
  nextSort,
  resizeColumn,
  resolveColumns,
  sortRows,
  stepColumn,
  toggleColumn,
  visibleRange,
  type ColumnSpec,
} from "./layout";

type Row = { name: string; size: number };
const defs: ColumnSpec<Row>[] = [
  {
    id: "name",
    label: "Name",
    width: 300,
    minWidth: 220,
    hideable: false,
    grow: true,
    compare: (a, b) => a.name.localeCompare(b.name),
  },
  { id: "size", label: "Size", width: 80, compare: (a, b) => a.size - b.size, descFirst: true },
  { id: "status", label: "Status", width: 200 },
  { id: "folder", label: "Folder", width: 160, visible: false },
];
const ids = (l: Parameters<typeof resolveColumns>[1]) => resolveColumns(defs, l).map((c) => c.id);

describe("column layout", () => {
  it("uses the defaults without a saved layout", () => {
    expect(ids(null)).toEqual(["name", "size", "status"]);
    expect(resolveColumns(defs, null)[0].px).toBe(300);
  });

  it("moves, hides and shows columns", () => {
    let l = moveColumn(defs, null, "status", "name");
    expect(ids(l)).toEqual(["status", "name", "size"]);
    l = toggleColumn(defs, l, "folder");
    expect(ids(l)).toEqual(["status", "name", "size", "folder"]);
    l = toggleColumn(defs, l, "size");
    expect(ids(l)).toEqual(["status", "name", "folder"]);
    // A hidden column comes back in its old place.
    expect(ids(toggleColumn(defs, l, "size"))).toEqual(["status", "name", "size", "folder"]);
    // Name can't be hidden.
    expect(ids(toggleColumn(defs, l, "name"))).toContain("name");
  });

  it("moves one step left or right among visible columns", () => {
    expect(ids(stepColumn(defs, null, "size", 1))).toEqual(["name", "status", "size"]);
    expect(ids(stepColumn(defs, null, "size", -1))).toEqual(["size", "name", "status"]);
    expect(ids(stepColumn(defs, null, "name", -1))).toEqual(["name", "size", "status"]);
  });

  it("moves a column to the end", () => {
    expect(ids(moveColumn(defs, null, "name", null))).toEqual(["size", "status", "name"]);
  });

  it("keeps widths above the minimum", () => {
    const l = resizeColumn(defs, null, "name", 100);
    expect(resolveColumns(defs, l)[0].px).toBe(220);
    expect(resolveColumns(defs, resizeColumn(defs, null, "size", 133.6))[1].px).toBe(134);
  });

  it("stops growing a column once it was resized", () => {
    expect(resolveColumns(defs, null)[0].grow).toBe(true);
    expect(resolveColumns(defs, resizeColumn(defs, null, "name", 400))[0].grow).toBe(false);
  });

  it("places columns that are new since the layout was saved", () => {
    const saved = { order: ["status", "name"], hidden: [], widths: {} };
    // "size" followed "name" in defs; "folder" is hidden by default.
    expect(ids(saved)).toEqual(["status", "name", "size"]);
  });

  it("ignores columns that no longer exist", () => {
    expect(ids({ order: ["gone", "size", "name", "status"], hidden: ["gone"], widths: { gone: 5 } })).toEqual([
      "size",
      "name",
      "status",
    ]);
  });

  it("builds a grid template", () => {
    expect(gridTemplate(resolveColumns(defs, null), 40, 100)).toBe("40px minmax(300px, 1fr) 80px 200px 100px");
  });
});

describe("sorting", () => {
  const rows: Row[] = [
    { name: "b", size: 2 },
    { name: "a", size: 2 },
    { name: "c", size: 1 },
  ];
  it("sorts both ways and keeps ties in order", () => {
    expect(sortRows(rows, defs, { column: "name", desc: false }).map((r) => r.name)).toEqual(["a", "b", "c"]);
    expect(sortRows(rows, defs, { column: "size", desc: true }).map((r) => r.name)).toEqual(["b", "a", "c"]);
    expect(sortRows(rows, defs, { column: "status", desc: false })).toBe(rows);
  });
  it("reverses on the same header, starts fresh on another", () => {
    expect(nextSort({ column: "name", desc: false }, defs[0])).toEqual({ column: "name", desc: true });
    expect(nextSort({ column: "name", desc: false }, defs[1])).toEqual({ column: "size", desc: true });
  });
});

describe("visibleRange", () => {
  it("covers the viewport plus overscan, clamped to the list", () => {
    expect(visibleRange(0, 520, 52, 1000, 5)).toEqual({ start: 0, end: 15 });
    expect(visibleRange(5200, 520, 52, 1000, 5)).toEqual({ start: 95, end: 115 });
    expect(visibleRange(51900, 520, 52, 1000, 5)).toEqual({ start: 993, end: 1000 });
    expect(visibleRange(0, 520, 52, 3, 5)).toEqual({ start: 0, end: 3 });
  });
});
