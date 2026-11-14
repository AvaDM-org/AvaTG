// Settings: General, Downloads, Files, Tools, Storage, About. Every change applies at once.
import { getVersion } from "@tauri-apps/api/app";
import { appDataDir } from "@tauri-apps/api/path";
import {
  disable as disableAutostart,
  enable as enableAutostart,
  isEnabled as autostartEnabled,
} from "@tauri-apps/plugin-autostart";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useState } from "react";
import { toast, toastError } from "../../components/Toasts";
import { WindowControls } from "../../components/WindowControls";
import { Button, IconButton, ProgressBar, Segmented, Stepper, Switch, TextField } from "../../components/ui/controls";
import { Icon } from "../../components/ui/Icon";
import { Dropdown, MenuItem } from "../../components/ui/Menu";
import { menuEntryStatus, setMenuEntry, systemProxy, toolsDir } from "../../ipc";
import { fmtBytes } from "../../lib/format";
import logo from "../../assets/avatg-logo.png";
import { AppearancePage } from "../appearance/AppearancePage";
import { ToolsSettings } from "../tools/ToolsPanel";
import { useUpdates } from "../updates/store";
import { chooseFolder } from "./chooseFolder";
import { Row, Section } from "./rows";
import { useSettings, type Settings } from "./store";
import s from "./settings.module.css";

type PageId = "general" | "appearance" | "downloads" | "files" | "tools" | "storage" | "about";

const PAGES: { id: PageId; label: string; desc: string }[] = [
  { id: "general", label: "General", desc: "How AvaTG starts and closes." },
  { id: "appearance", label: "Appearance", desc: "Themes and the glass effect." },
  { id: "downloads", label: "Downloads", desc: "Where files go and how fast they arrive." },
  { id: "files", label: "Files", desc: "What is saved with each video." },
  { id: "tools", label: "Tools", desc: "Free programs AvaTG uses to download and convert." },
  { id: "storage", label: "Storage", desc: "Where AvaTG keeps its own files." },
  { id: "about", label: "About & updates", desc: "" },
];

const BROWSERS = [
  ["", "Don't use cookies"],
  ["firefox", "Firefox"],
  ["chrome", "Chrome"],
  ["chromium", "Chromium"],
  ["brave", "Brave"],
  ["edge", "Edge"],
  ["vivaldi", "Vivaldi"],
  ["opera", "Opera"],
  ["safari", "Safari"],
];

export type SettingsPageId = PageId;

export function SettingsPage({ onBack, initialPage = "general" }: { onBack: () => void; initialPage?: PageId }) {
  const [page, setPage] = useState<PageId>(initialPage);
  const [version, setVersion] = useState("");
  const current = PAGES.find((p) => p.id === page) ?? PAGES[0];
  useEffect(() => void getVersion().then(setVersion), []);

  useEffect(() => {
    const key = (e: KeyboardEvent) =>
      e.key === "Escape" && !(e.target as HTMLElement).closest("[role=menu]") && onBack();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onBack]);

  return (
    <div className={s.page}>
      <nav className={s.nav} aria-label="Settings pages" data-tauri-drag-region>
        <div className={s.navHead}>
          <IconButton icon="back" label="Back to downloads" small onClick={onBack} />
          Settings
        </div>
        {PAGES.map((p) => (
          <button
            key={p.id}
            type="button"
            className={s.navItem}
            aria-current={p.id === page ? "page" : undefined}
            onClick={() => setPage(p.id)}
          >
            {p.label}
          </button>
        ))}
        <div className={s.navFoot}>AvaTG {version}</div>
      </nav>
      <div className={s.main}>
        <div className={s.titlebar} data-tauri-drag-region>
          <WindowControls />
        </div>
        <div className={s.content}>
          <h1>{current.label}</h1>
          {current.desc && <p>{current.desc}</p>}
          {page === "general" && <GeneralPage />}
          {page === "appearance" && <AppearancePage />}
          {page === "downloads" && <DownloadsSettings />}
          {page === "files" && <FilesPage />}
          {page === "tools" && <ToolsSettings />}
          {page === "storage" && <StoragePage />}
          {page === "about" && <AboutPage version={version} />}
        </div>
      </div>
    </div>
  );
}

function useSetting<K extends keyof Settings>(key: K): [Settings[K], (v: Settings[K]) => void] {
  const value = useSettings((st) => st.settings[key]);
  const set = useSettings((st) => st.set);
  return [value, (v) => set(key, v)];
}

function GeneralPage() {
  const [autostart, setAutostart] = useState(false);
  const [resume, setResume] = useSetting("resumeOnLaunch");
  const [toTray, setToTray] = useSetting("closeToTray");
  const [dbl, setDbl] = useSetting("doubleClick");
  // Read live from the OS: the login item is the source of truth, not a stored flag.
  useEffect(() => void autostartEnabled().then(setAutostart, () => {}), []);

  const [menuEntry, setMenuEntryState] = useState<{ available: boolean; installed: boolean } | null>(null);
  useEffect(() => void menuEntryStatus().then(setMenuEntryState, () => {}), []);
  const toggleMenuEntry = async (on: boolean) => {
    try {
      await setMenuEntry(on);
      setMenuEntryState(await menuEntryStatus());
      toast(on ? "AvaTG is in the applications menu" : "Removed from the applications menu");
    } catch (e) {
      toastError(e);
    }
  };

  const toggleAutostart = async (on: boolean) => {
    try {
      await (on ? enableAutostart() : disableAutostart());
      setAutostart(await autostartEnabled());
    } catch (e) {
      toastError(e);
    }
  };

  return (
    <>
      <Section heading="STARTUP">
        <Row title="Launch when I log in" desc="Starts hidden in the tray, ready for downloads">
          <Switch label="Launch when I log in" checked={autostart} onChange={(v) => void toggleAutostart(v)} />
        </Row>
        <Row title="Resume unfinished downloads" desc="Continue downloads that were running when AvaTG closed">
          <Switch label="Resume unfinished downloads" checked={resume} onChange={setResume} />
        </Row>
        {menuEntry?.available && (
          <Row title="Applications menu" desc="Lists this AppImage in your desktop's app launcher">
            <Button onClick={() => void toggleMenuEntry(!menuEntry.installed)}>
              {menuEntry.installed ? "Remove from applications menu" : "Add to applications menu"}
            </Button>
          </Row>
        )}
      </Section>
      <Section heading="WINDOW">
        <Row title="Close the window" desc="Downloads keep running in the tray">
          <Segmented
            label="Close the window"
            value={toTray}
            onChange={setToTray}
            options={[
              { value: true, label: "Minimize to tray" },
              { value: false, label: "Quit AvaTG" },
            ]}
          />
        </Row>
        <Row title="Double-click a finished download">
          <Segmented
            label="Double-click a finished download"
            value={dbl}
            onChange={setDbl}
            options={[
              { value: "play", label: "Play" },
              { value: "folder", label: "Show in folder" },
            ]}
          />
        </Row>
      </Section>
    </>
  );
}

function DownloadsSettings() {
  const [dir, setDir] = useSetting("outputDir");
  const [conc, setConc] = useSetting("concurrency");
  const [frag, setFrag] = useSetting("fragments");
  const [limitOn, setLimitOn] = useSetting("limitOn");
  const [mbps, setMbps] = useSetting("limitMbps");
  const [retries, setRetries] = useSetting("retries");
  const [timeout, setTimeout_] = useSetting("socketTimeout");
  const [autoResume, setAutoResume] = useSetting("autoResume");
  const [mbpsText, setMbpsText] = useState(String(mbps));
  const [proxyMode, setProxyMode] = useSetting("proxyMode");
  const [proxyUrl, setProxyUrl] = useSetting("proxyUrl");
  const [detected, setDetected] = useState<string | null | undefined>(undefined);
  useEffect(() => void systemProxy().then(setDetected, () => setDetected(null)), []);

  return (
    <>
      <Section heading="LOCATION">
        <Row title="Download folder" desc="New downloads go here unless you pick another folder">
          <TextField
            label="Download folder"
            value={dir}
            onChange={setDir}
            width={320}
            trailing={
              <IconButton
                icon="folder"
                label="Choose folder"
                small
                onClick={async () => setDir((await chooseFolder(dir)) ?? dir)}
              />
            }
          />
        </Row>
      </Section>
      <Section heading="SPEED">
        <Row title="Downloads at a time" desc="The rest wait their turn">
          <Stepper label="Downloads at a time" value={conc} min={1} max={10} onChange={setConc} />
        </Row>
        <Row title="Parts per download" desc="Pieces of one video fetched at once. More can be faster">
          <Stepper label="Parts per download" value={frag} min={1} max={16} onChange={setFrag} />
        </Row>
        <Row
          title="Limit each download"
          desc={`Caps every download on its own: 2 at ${mbps} MB/s can use ${mbps * 2} MB/s`}
        >
          <TextField
            label="Megabytes per second"
            value={mbpsText}
            width={110}
            trailing={<span style={{ paddingRight: 8 }}>MB/s</span>}
            onChange={(v) => {
              setMbpsText(v);
              const n = Number(v);
              if (n > 0 && n <= 10000) setMbps(n);
            }}
          />
          <Switch label="Limit each download" checked={limitOn} onChange={setLimitOn} />
        </Row>
      </Section>
      <Section heading="NETWORK">
        <Row
          title="Proxy"
          desc={
            proxyMode === "system"
              ? detected
                ? `Using the system proxy: ${detected}`
                : detected === null
                  ? "No system proxy is set, so AvaTG connects directly"
                  : "Reading the system proxy…"
              : proxyMode === "custom"
                ? "For example http://127.0.0.1:10809 or socks5://127.0.0.1:1080"
                : "Connects directly, even when the system has a proxy"
          }
        >
          <Segmented
            label="Proxy"
            value={proxyMode}
            onChange={setProxyMode}
            options={[
              { value: "system", label: "System" },
              { value: "custom", label: "Custom" },
              { value: "none", label: "None" },
            ]}
          />
        </Row>
        {proxyMode === "custom" && (
          <Row title="Proxy address" desc="Used by yt-dlp and when downloading the tools">
            <TextField
              label="Proxy address"
              placeholder="http://127.0.0.1:10809"
              value={proxyUrl}
              onChange={setProxyUrl}
              width={280}
            />
          </Row>
        )}
      </Section>
      <Section heading="RELIABILITY">
        <Row title="Retry attempts" desc="For dropped connections and server errors">
          <Stepper label="Retry attempts" value={retries} min={0} max={50} onChange={setRetries} />
        </Row>
        <Row title="Give up after no data for" desc="Waits this long for a stalled download before retrying">
          <Stepper label="Seconds without data" value={timeout} min={5} max={300} suffix=" s" onChange={setTimeout_} />
        </Row>
        <Row title="Automatically resume failed downloads" desc="0 turns it off">
          <Stepper label="Automatic resumes" value={autoResume} min={0} max={20} onChange={setAutoResume} />
        </Row>
      </Section>
    </>
  );
}

function FilesPage() {
  const [mode, setMode] = useSetting("subtitleMode");
  const [auto, setAuto] = useSetting("autoCaptions");
  const [langs, setLangs] = useSetting("subLangs");
  const [folder, setFolder] = useSetting("playlistFolder");
  const [numbered, setNumbered] = useSetting("numberFiles");
  const [preset, setPreset] = useSetting("preset");
  const [cookies, setCookies] = useSetting("cookiesBrowser");
  const [langText, setLangText] = useState(langs.join(", "));

  return (
    <>
      <Section heading="SUBTITLES">
        <Row
          title="Save subtitles as"
          desc="Embedded subtitles travel inside the video; separate .srt files work with any player"
        >
          <Segmented
            label="Save subtitles as"
            value={mode}
            onChange={setMode}
            options={[
              { value: "embed", label: "Embedded" },
              { value: "separate", label: "Separate files" },
              { value: "both", label: "Both" },
            ]}
          />
        </Row>
        <Row
          title="Offer auto-generated captions"
          desc="YouTube's machine captions, marked “auto” in the language list"
        >
          <Switch label="Offer auto-generated captions" checked={auto} onChange={setAuto} />
        </Row>
        <Row title="Preferred languages" desc="Language codes, picked first when a video has them (en, de, fa…)">
          <TextField
            label="Preferred languages"
            value={langText}
            width={200}
            onChange={(v) => {
              setLangText(v);
              setLangs(v.split(/[,\s]+/).filter(Boolean));
            }}
          />
        </Row>
      </Section>
      <Section heading="NAMES AND FOLDERS">
        <Row title="Own folder for each playlist" desc="Named after the playlist">
          <Switch label="Own folder for each playlist" checked={folder} onChange={setFolder} />
        </Row>
        <Row title="Number files in playlist order" desc="Adds 001, 002 … in front of the name">
          <Switch label="Number files in playlist order" checked={numbered} onChange={setNumbered} />
        </Row>
        <Row title="Save the description by default" desc="As a .txt file next to the video">
          <Switch
            label="Save the description by default"
            checked={preset.description}
            onChange={(v) => setPreset({ ...preset, description: v })}
          />
        </Row>
      </Section>
      <Section heading="ACCOUNT">
        <Row
          title="Use cookies from"
          desc="For age-restricted and members-only videos. Read from the browser, never stored"
        >
          <Dropdown
            label="Browser"
            width={200}
            trigger={({ toggle }) => (
              <Button onClick={toggle} style={{ minWidth: 200, justifyContent: "space-between" }}>
                <b>{BROWSERS.find(([id]) => id === cookies)?.[1]}</b>
                <Icon name="chevronDown" size={14} />
              </Button>
            )}
          >
            {(close) =>
              BROWSERS.map(([id, name]) => (
                <MenuItem
                  key={id}
                  checked={id === cookies}
                  onSelect={() => {
                    setCookies(id);
                    close();
                  }}
                >
                  {name}
                </MenuItem>
              ))
            }
          </Dropdown>
        </Row>
      </Section>
    </>
  );
}

function StoragePage() {
  const [data, setData] = useState("");
  const [tools, setTools] = useState("");
  useEffect(() => {
    void appDataDir().then(setData);
    void toolsDir().then(setTools);
  }, []);
  const open = (dir: string) => openPath(dir).catch(toastError);
  return (
    <Section heading="FOLDERS">
      <Row title="Download history" desc="The list of downloads and how to resume them (avatg.db)">
        <TextField label="Download history folder" value={data} readOnly width={300} />
        <Button onClick={() => void open(data)}>Open folder</Button>
      </Row>
      <Row title="Tools" desc="yt-dlp, Deno and FFmpeg, plus Deno's cache">
        <TextField label="Tools folder" value={tools} readOnly width={300} />
        <Button onClick={() => void open(tools)}>Open folder</Button>
      </Row>
    </Section>
  );
}

function AboutPage({ version }: { version: string }) {
  const [checkOnLaunch, setCheckOnLaunch] = useSetting("checkUpdates");
  const [pre, setPre] = useSetting("includePrereleases");
  const { status, info, channel, check, error } = useUpdates();
  return (
    <>
      <div className={s.aboutHead}>
        <img src={logo} alt="AvaTG logo" width={64} height={64} />
        <div>
          <b>AvaTG {version}</b>
          <small>Video and audio downloader, built like AvaDM</small>
        </div>
      </div>
      <UpdateCard />
      <Section heading="UPDATES">
        <Row title="Check for updates on launch" desc="Quietly; you are told when a new version is out">
          <Switch label="Check for updates on launch" checked={checkOnLaunch} onChange={setCheckOnLaunch} />
        </Row>
        <Row title="Include pre-release versions" desc="Try new versions before they are final">
          <Switch
            label="Include pre-release versions"
            checked={pre}
            onChange={(v) => {
              setPre(v);
              void check();
            }}
          />
        </Row>
        <Row
          title="Check now"
          desc={
            status === "checking"
              ? "Checking…"
              : status === "upToDate"
                ? `AvaTG ${version} is the newest version`
                : status === "failed" && !info
                  ? (error ?? "The check failed")
                  : channel === "package"
                    ? "Installed with your package manager; updates come from the release page"
                    : `AvaTG ${version}`
          }
          descTone={status === "failed" && !info ? "bad" : status === "upToDate" ? "ok" : undefined}
        >
          <Button disabled={status === "checking" || status === "downloading"} onClick={() => void check()}>
            Check now
          </Button>
        </Row>
      </Section>
      <Section heading="AVATG">
        <Row title="Project page" desc="Source, issues and releases on GitHub">
          <Button onClick={() => void openUrl("https://github.com/AvaDM-org/AvaTG").catch(toastError)}>
            Open GitHub
          </Button>
        </Row>
      </Section>
    </>
  );
}

/** The update card (AvaDM DESIGN.md section 6): only while there is an update to show. */
function UpdateCard() {
  const { status, info, channel, downloaded, total, error, install } = useUpdates();
  if (!info || status === "upToDate" || status === "checking") return null;
  const busy = status === "downloading" || status === "installing";
  const pct = total ? (downloaded / total) * 100 : null;
  const line =
    status === "downloading"
      ? `${fmtBytes(downloaded)}${total ? ` of ${fmtBytes(total)}` : ""}`
      : status === "installing"
        ? "Installing; AvaTG restarts in a moment"
        : status === "failed"
          ? (error ?? "The update failed")
          : `You have ${info.current}${info.prerelease ? " · this is a pre-release" : ""}`;
  return (
    <div className={s.card}>
      <div className={s.cardHead}>
        <div className={s.cardIcon}>
          <Icon name="download" size={20} strokeWidth={2} />
        </div>
        <div className={s.rowText}>
          <b>
            {busy ? "Updating to" : "AvaTG"} {info.version}
            {busy ? "" : " is available"}
          </b>
          <small className={`tnum ${status === "failed" ? s.bad : ""}`}>{line}</small>
        </div>
        {channel === "package" ? (
          <Button variant="primary" onClick={() => void openUrl(info.releasePage).catch(toastError)}>
            Open release page
          </Button>
        ) : (
          <Button variant="primary" disabled={busy} onClick={() => void install()}>
            {status === "failed" ? "Try again" : "Update now"}
          </Button>
        )}
      </div>
      {busy && <ProgressBar percent={status === "installing" ? null : pct} height={8} />}
    </div>
  );
}
