// First run: use the tools already on the system when their versions are good, download only what is missing
// into AvaTG's own folder (no installer, no admin rights).
import logo from "../../assets/avatg-logo.png";
import { DragSpace, TopBar } from "../../components/layout";
import { WindowControls } from "../../components/WindowControls";
import { Button } from "../../components/ui/controls";
import { Row, Section } from "../settings/rows";
import s from "../settings/settings.module.css";
import { useTools } from "./store";
import { InstallCard, ProjectLink, useInstaller } from "./ToolsPanel";

export function SetupScreen({ onReady }: { onReady: () => void }) {
  const { infos, resolved } = useTools();
  const { progress, busy, error, install } = useInstaller();
  const missing = infos.filter((t) => !resolved[t.id]?.check.ok).map((t) => t.id);
  const busyTool = infos.find((t) => t.id === busy);

  return (
    <>
      <TopBar>
        <img src={logo} alt="" width={28} height={28} />
        <b style={{ fontSize: 16 }}>AvaTG</b>
        <DragSpace />
        <WindowControls />
      </TopBar>
      <div className={s.content} style={{ paddingTop: 32, maxWidth: 760, margin: "0 auto", width: "100%" }}>
        <h1>One-time setup</h1>
        <p className={s.intro} style={{ margin: 0 }}>
          AvaTG uses three free programs: yt-dlp (the downloader), Deno (runs YouTube's player code for yt-dlp) and
          FFmpeg (joins video and audio, converts formats). Copies already on your system are used when their versions
          are good; the rest are downloaded once from their official releases into AvaTG's own folder. If YouTube is
          blocked where you are, set a proxy in Settings › Downloads first.
        </p>
        {busyTool && <InstallCard tool={busyTool} progress={progress} />}
        <Section heading="TOOLS">
          {infos.map((t) => {
            const r = resolved[t.id];
            return (
              <Row
                key={t.id}
                title={t.name}
                desc={
                  r?.check.ok
                    ? `${r.from === "system" ? "Found on your system" : "Installed"} · ${r.version}`
                    : r?.path
                      ? `${r.version ?? "?"} · ${r.check.note} · will download a newer copy`
                      : "Will be downloaded"
                }
                descTone={r?.check.ok ? "ok" : undefined}
              >
                <ProjectLink id={t.id} name={t.name} />
              </Row>
            );
          })}
        </Section>
        {error && <p className={s.bad}>{error}</p>}
        <div>
          <Button
            variant="primary"
            icon="download"
            disabled={!!busy || !missing.length}
            onClick={async () => (await install(missing)) && onReady()}
          >
            {busy ? "Downloading…" : `Download ${missing.length === 1 ? "the missing tool" : "missing tools"}`}
          </Button>
        </div>
      </div>
    </>
  );
}
