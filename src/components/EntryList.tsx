// File-manager style selectable list: checkboxes, shift-click ranges, all/none/invert, filter.
import { useMemo, useRef, useState } from "react";
import { fmtDuration, type Entry } from "../lib/youtube";

interface Props {
  entries: Entry[];
  selected: Set<string>;
  onSelectedChange: (s: Set<string>) => void;
}

export function EntryList({ entries, selected, onSelectedChange }: Props) {
  const [filter, setFilter] = useState("");
  const lastIndex = useRef<number | null>(null);

  const visible = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return f ? entries.filter((e) => e.title.toLowerCase().includes(f)) : entries;
  }, [entries, filter]);

  const position = useMemo(() => new Map(entries.map((e, i) => [e.id, i + 1])), [entries]);

  const visibleSelected =visible.filter((e) => selected.has(e.id)).length;
  const allChecked = visible.length > 0 && visibleSelected === visible.length;
  const someChecked = visibleSelected > 0 && !allChecked;

  const setMany = (ids: string[], on: boolean) => {
    const s = new Set(selected);
    ids.forEach((id) => (on ? s.add(id) : s.delete(id)));
    onSelectedChange(s);
  };

  const onRowClick = (i: number, ev: React.MouseEvent) => {
    const id = visible[i].id;
    if (ev.shiftKey && lastIndex.current != null) {
      const [a, b] = [Math.min(lastIndex.current, i), Math.max(lastIndex.current, i)];
      const target = !selected.has(id);
      setMany(visible.slice(a, b + 1).map((e) => e.id), target);
    } else {
      setMany([id], !selected.has(id));
    }
    lastIndex.current = i;
  };

  const totalSecs = entries.filter((e) => selected.has(e.id)).reduce((t, e) => t + (e.duration ?? 0), 0);

  return (
    <div className="entry-list">
      <div className="list-toolbar">
        <input
          type="checkbox"
          checked={allChecked}
          ref={(el) => {
            if (el) el.indeterminate = someChecked;
          }}
          onChange={() => setMany(visible.map((e) => e.id), !allChecked)}
          title="Select all / none"
        />
        <button onClick={() => setMany(visible.map((e) => e.id), true)}>All</button>
        <button onClick={() => setMany(visible.map((e) => e.id), false)}>None</button>
        <button
          onClick={() => {
            const s = new Set(selected);
            visible.forEach((e) => (s.has(e.id) ? s.delete(e.id) : s.add(e.id)));
            onSelectedChange(s);
          }}
        >
          Invert
        </button>
        <input className="filter" placeholder="Filter by title…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <span className="muted count">
          {selected.size} of {entries.length} selected
          {totalSecs > 0 ? ` · ${fmtDuration(totalSecs)}` : ""}
        </span>
      </div>
      <div className="rows">
        {visible.map((e, i) => (
          <div
            key={e.id}
            className={`row ${selected.has(e.id) ? "selected" : ""}`}
            onClick={(ev) => onRowClick(i, ev)}
          >
            <input type="checkbox" checked={selected.has(e.id)} readOnly tabIndex={-1} />
            <span className="idx muted">{position.get(e.id)}</span>
            {e.thumbnail ? <img src={e.thumbnail} loading="lazy" alt="" /> : <div className="thumb-ph" />}
            <span className="title" title={e.title}>
              {e.title}
            </span>
            <span className="muted meta">
              {e.kind === "playlist" ? (e.count ? `${e.count} videos` : "Playlist") : fmtDuration(e.duration)}
            </span>
          </div>
        ))}
        {visible.length === 0 && <div className="empty muted">Nothing here.</div>}
      </div>
    </div>
  );
}
