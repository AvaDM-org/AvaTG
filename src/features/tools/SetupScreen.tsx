// First run: TubeGrab downloads its tools once into its own folder (no installer, no admin rights).
import { DragSpace, TopBar } from "../../components/layout";
import { WindowControls } from "../../components/WindowControls";
import { Button } from "../../components/ui/controls";
import { Row, Section } from "../settings/rows";
import s from "../settings/settings.module.css";
import { InstallCard, useTools } from "./ToolsPanel";

export function SetupScreen({ onReady }: { onReady: () => void }) {
  const { tools, progress, busy, error, install } = useTools();
  const missing = tools.filter((t) => !t.installed).map((t) => t.id);
  const busyTool = tools.find((t) => t.id === busy);

  return (
    <>
      <TopBar>
        <b style={{ fontSize: 16 }}>TubeGrab</b>
        <DragSpace />
        <WindowControls />
      </TopBar>
      <div className={s.content} style={{ paddingTop: 32, maxWidth: 760, margin: "0 auto", width: "100%" }}>
        <h1>One-time setup</h1>
        <p className={s.intro} style={{ margin: 0 }}>
          TubeGrab uses three free programs: yt-dlp (the downloader), Deno (runs YouTube's player code for yt-dlp) and
          FFmpeg (joins video and audio, converts formats). They are downloaded once from their official releases, about
          150 to 250 MB, into TubeGrab's own folder. Settings › Tools updates them later.
        </p>
        {busyTool && <InstallCard tool={busyTool} progress={progress} />}
        <Section heading="TOOLS">
          {tools.map((t) => (
            <Row
              key={t.id}
              title={t.name}
              desc={t.installed ? `${t.version} · Installed` : "Not installed yet"}
              descTone={t.installed ? "ok" : undefined}
            />
          ))}
        </Section>
        {error && <p className={s.bad}>{error}</p>}
        <div>
          <Button
            variant="primary"
            icon="download"
            disabled={!!busy || !missing.length}
            onClick={async () => (await install(missing)) && onReady()}
          >
            {busy ? "Downloading…" : "Download tools"}
          </Button>
        </div>
      </div>
    </>
  );
}
