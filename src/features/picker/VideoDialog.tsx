// One video: thumbnail header, format options, folder, Download.
import { useMemo, useState } from "react";
import { Button } from "../../components/ui/controls";
import { Dialog } from "../../components/ui/Dialog";
import { fmtBytes, fmtDuration } from "../../lib/format";
import type { VideoInfo } from "../../lib/youtube";
import { toast } from "../../components/Toasts";
import { formatLabel } from "../../lib/presets";
import type { DuplicateChoice } from "../downloads/duplicates";
import { queueWithChoice, type PickedVideo } from "../downloads/enqueue";
import { useDuplicates } from "../downloads/useDuplicates";
import { useSettings } from "../settings/store";
import { FormatOptions, PresetMenu } from "./FormatOptions";
import { DuplicateNotice } from "./DuplicateNotice";
import { SaveToField } from "./SaveToField";
import { usePicker } from "./store";
import s from "./picker.module.css";

export function VideoDialog({ info }: { info: VideoInfo }) {
  const { settings, set } = useSettings();
  const { close, open } = usePicker();
  const [preset, setPreset] = useState(() => ({
    ...settings.preset,
    // Start with the video's own subtitle languages that match the preferred ones.
    subLangs: settings.subLangs.filter((c) => info.subtitles.some((l) => l.code.startsWith(c))),
  }));
  const [dir, setDir] = useState(settings.outputDir);
  const [choice, setChoice] = useState<DuplicateChoice>("skip");
  const video: PickedVideo[] = useMemo(
    () => [
      { url: info.url, title: info.title, channel: info.channel, duration: info.duration, thumbnail: info.thumbnail },
    ],
    [info],
  );
  const dups = useDuplicates(video, formatLabel(preset), dir);
  const skipping = dups.length > 0 && choice === "skip";
  const playlistUrl = info.playlistUrl;

  const max = preset.maxHeight;
  const height = max ? info.heights.find((h) => h.height <= max) : info.heights[0];
  const size = preset.mode === "audio" ? info.audioSize : height?.size;
  const summary = [
    size ? `About ${fmtBytes(size)}` : "",
    preset.mode === "audio" ? "Audio" : height ? `${height.height}p` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const download = () => {
    set("preset", { ...preset, subLangs: settings.subLangs });
    queueWithChoice(video, preset, { outputDir: dir }, dups, choice);
    if (skipping) toast("Skipped: it's already in your downloads");
    close();
  };

  return (
    <Dialog
      title={info.title}
      width={600}
      onClose={close}
      onConfirm={download}
      head={
        <div className={s.videoHead}>
          <div
            className={s.bigThumb}
            style={{ backgroundImage: info.thumbnail ? `url("${info.thumbnail}")` : undefined }}
          >
            {info.duration != null && <span className={s.duration}>{fmtDuration(info.duration)}</span>}
          </div>
          <div className={s.videoTitle}>
            <h2 title={info.title}>{info.title}</h2>
            {info.channel && <span>{info.channel}</span>}
            <small>
              {info.heights[0] ? `Up to ${info.heights[0].height}p` : "Audio only"}
              {info.subtitles.length ? ` · ${info.subtitles.filter((l) => !l.auto).length} subtitle languages` : ""}
            </small>
          </div>
        </div>
      }
      headExtra={<PresetMenu preset={preset} onChange={setPreset} />}
      footer={
        <>
          <span>{summary}</span>
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" onClick={download}>
            {skipping ? "Skip" : "Download"}
          </Button>
        </>
      }
    >
      {playlistUrl && (
        <div className={s.banner}>
          <span>This video is part of a playlist.</span>
          <Button small variant="text" onClick={() => open([playlistUrl])}>
            Open the playlist
          </Button>
        </div>
      )}
      <FormatOptions preset={preset} onChange={setPreset} heights={info.heights} subtitles={info.subtitles} />
      <SaveToField dir={dir} onChange={setDir} needBytes={size} />
      <DuplicateNotice dups={dups} total={1} choice={choice} onChoice={setChoice} />
    </Dialog>
  );
}
