// The detail panel's content: for one download General / Format / Log tabs, for several a summary.
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { DetailPanel, Stat } from "../../components/DetailPanel";
import { toast, toastError } from "../../components/Toasts";
import { Button, IconButton, ProgressBar } from "../../components/ui/controls";
import { Icon } from "../../components/ui/Icon";
import { fmtBytes, fmtDate, fmtEta, fmtSpeed, fmtTook, plural } from "../../lib/format";
import { describePreset } from "../../lib/presets";
import { useSettings } from "../settings/store";
import { actionsFor } from "./cells";
import { averageSpeed } from "./columns";
import { showInFolder } from "./fileActions";
import { useDownloadLogs, type LogLine } from "./logs";
import type { Ask } from "./RowMenu";
import { useDownloads } from "./store";
import type { DownloadRecord, LiveProgress } from "./types";
import s from "./details.module.css";

type Tab = "general" | "format" | "log";
const TABS: { id: Tab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "format", label: "Format" },
  { id: "log", label: "Log" },
];

const copy = (text: string, what: string) =>
  writeText(text)
    .then(() => toast(`${what} copied`))
    .catch(toastError);

export function DownloadDetails({
  items,
  onAsk,
  onClose,
}: {
  items: DownloadRecord[];
  onAsk: (a: Ask) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("general");
  const one = items.length === 1 ? items[0] : null;
  if (!one) {
    return (
      <DetailPanel
        label={`${plural(items.length, "download")} selected`}
        tabs={[]}
        tab="summary"
        onTab={() => {}}
        onClose={onClose}
      >
        <Summary items={items} onAsk={onAsk} />
      </DetailPanel>
    );
  }
  return (
    <DetailPanel label="Download details" tabs={TABS} tab={tab} onTab={setTab} onClose={onClose}>
      {tab === "general" && <General d={one} onAsk={onAsk} />}
      {tab === "format" && <Format d={one} />}
      {tab === "log" && <Log d={one} />}
    </DetailPanel>
  );
}

function General({ d, onAsk }: { d: DownloadRecord; onAsk: (a: Ask) => void }) {
  const live = useDownloads((st) => st.live[d.id]);
  const path = d.status === "done" && d.filepath ? d.filepath : d.dir;
  const host = hostOf(d.url);
  const actions = actionsFor(d, {
    cancel: () => onAsk({ kind: "cancel", items: [d] }),
    remove: () => onAsk({ kind: "remove", items: [d] }),
  });
  const showBar = d.status === "running" || d.status === "paused" || d.status === "interrupted";

  return (
    <div className={s.general}>
      <div
        className={s.thumb}
        style={{ backgroundImage: d.thumbnail && !d.audioOnly ? `url("${d.thumbnail}")` : undefined }}
      >
        {d.audioOnly && <Icon name="music" size={22} />}
      </div>
      <div className={s.info}>
        <b className={s.title} title={d.title}>
          {d.title}
        </b>
        <div className={s.path}>
          <Icon name="folder" size={13} />
          <span title={path}>{path}</span>
          <IconButton icon="clipboard" label="Copy path" small ghost onClick={() => void copy(path, "Path")} />
          {host && <small>· {host}</small>}
        </div>
        {showBar && (
          <ProgressBar
            percent={d.status === "running" && !isTransferring(live) ? null : d.percent}
            paused={d.status !== "running"}
            height={4}
          />
        )}
        <div className={s.stats}>{stats(d, live)}</div>
      </div>
      <div className={s.actions}>
        {actions.map((a) => (
          <Button key={a.label} small icon={a.icon} variant={a.danger ? "danger" : "secondary"} onClick={a.run}>
            {a.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

const isTransferring = (l: LiveProgress | undefined) => l?.phase === "Video" || l?.phase === "Audio";

function stats(d: DownloadRecord, live: LiveProgress | undefined) {
  const pct = d.percent == null ? "" : `${Math.floor(d.percent)}%`;
  const added = <Stat label="Added">{fmtDate(d.createdAt)}</Stat>;
  switch (d.status) {
    case "running":
      return (
        <>
          <Stat label="Step">{live?.phase ?? "Starting"}</Stat>
          <Stat label="Progress">{isTransferring(live) ? pct || "—" : "—"}</Stat>
          <Stat label="Speed">{fmtSpeed(live?.speed) || "—"}</Stat>
          <Stat label="Time left">{isTransferring(live) && live?.eta != null ? fmtEta(live.eta) : "—"}</Stat>
          <Stat label="Size">{fmtBytes(d.sizeBytes) || "—"}</Stat>
          {added}
        </>
      );
    case "done":
      return (
        <>
          <Stat label="Size">{fmtBytes(d.sizeBytes) || "—"}</Stat>
          <Stat label="Took">{d.activeMs ? fmtTook(d.activeMs) : "—"}</Stat>
          <Stat label="Average speed">{fmtSpeed(averageSpeed(d)) || "—"}</Stat>
          <Stat label="Finished">{fmtDate(d.finishedAt) || "—"}</Stat>
          <Stat label="Format">{d.formatLabel}</Stat>
          {added}
        </>
      );
    case "failed":
      return (
        <>
          <div className={s.error} title={d.error ?? undefined}>
            {d.error ?? "Failed"}
          </div>
          {added}
        </>
      );
    default:
      return (
        <>
          <Stat label="Progress">{pct || "—"}</Stat>
          <Stat label="Size">{fmtBytes(d.sizeBytes) || "—"}</Stat>
          <Stat label="Format">{d.formatLabel}</Stat>
          <Stat label="Time so far">{d.activeMs ? fmtTook(d.activeMs) : "—"}</Stat>
          {added}
        </>
      );
  }
}

function Format({ d }: { d: DownloadRecord }) {
  const { subtitleMode, autoCaptions } = useSettings((st) => st.settings);
  const rows = d.preset ? describePreset(d.preset, { subtitleMode, autoCaptions }) : [["Format", d.formatLabel]];
  return (
    <div className={s.format}>
      {rows.map(([k, v]) => (
        <Stat key={k} label={k}>
          {v}
        </Stat>
      ))}
      <Stat label="Link" wide>
        <span className={s.link}>
          <span title={d.url}>{d.url}</span>
          <IconButton icon="clipboard" label="Copy link" small ghost onClick={() => void copy(d.url, "Link")} />
        </span>
      </Stat>
    </div>
  );
}

const time = (ms: number) => new Date(ms).toTimeString().slice(0, 8);

function Log({ d }: { d: DownloadRecord }) {
  const lines = useDownloadLogs((st) => st.lines[d.id]);
  const box = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  // Follow new lines while scrolled to the bottom.
  useLayoutEffect(() => {
    const el = box.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [lines]);
  useEffect(() => {
    stick.current = true;
  }, [d.id]);

  const text = (l: LogLine) => `${time(l.at)}  ${l.text}`;
  if (!lines?.length) {
    return (
      <div className={s.logEmpty}>
        Nothing yet in this session. yt-dlp's messages appear here while the download runs.
        {d.error && <pre className={s.logError}>{d.error}</pre>}
      </div>
    );
  }
  return (
    <div className={s.logWrap}>
      <div
        ref={box}
        className={s.log}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 4;
        }}
      >
        {lines.map((l, i) => (
          <div key={i} data-level={l.level}>
            <span>{time(l.at)}</span>
            {l.text}
          </div>
        ))}
      </div>
      <IconButton
        icon="clipboard"
        label="Copy log"
        small
        className={s.logCopy}
        onClick={() => void copy(lines.map(text).join("\n"), "Log")}
      />
    </div>
  );
}

function Summary({ items, onAsk }: { items: DownloadRecord[]; onAsk: (a: Ask) => void }) {
  const size = items.reduce((t, d) => t + (d.sizeBytes ?? 0), 0);
  const folders = new Set(items.map((d) => d.dir));
  const counts = new Map<string, number>();
  for (const d of items) counts.set(STATUS_WORD[d.status], (counts.get(STATUS_WORD[d.status]) ?? 0) + 1);
  const added = items.map((d) => d.createdAt).sort((a, b) => a - b);
  const done = items.filter((d) => d.status === "done");
  return (
    <div className={s.general}>
      <div className={s.info}>
        <div className={s.stats}>
          <Stat label="Total size">{fmtBytes(size) || "—"}</Stat>
          <Stat label="Status" wide>
            {[...counts].map(([w, n]) => `${n} ${w}`).join(" · ")}
          </Stat>
          <Stat label="Location" wide>
            <span title={[...folders].join("\n")}>{folders.size === 1 ? items[0].dir : `${folders.size} folders`}</span>
          </Stat>
          <Stat label="Added" wide>
            {fmtDate(added[0])}
            {added.length > 1 && added.at(-1) !== added[0] ? ` – ${fmtDate(added.at(-1))}` : ""}
          </Stat>
        </div>
      </div>
      <div className={s.actions}>
        <Button small icon="folder" onClick={() => void showInFolder(items[0])}>
          Show in folder
        </Button>
        <Button small icon="trash" onClick={() => onAsk({ kind: "remove", items })}>
          Remove from list
        </Button>
        {done.length > 0 && (
          <Button small variant="danger" icon="trash" onClick={() => onAsk({ kind: "delete", items: done })}>
            Delete files…
          </Button>
        )}
      </div>
    </div>
  );
}

const STATUS_WORD: Record<DownloadRecord["status"], string> = {
  running: "running",
  paused: "paused",
  interrupted: "interrupted",
  queued: "queued",
  failed: "failed",
  done: "completed",
  cancelled: "cancelled",
};

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
