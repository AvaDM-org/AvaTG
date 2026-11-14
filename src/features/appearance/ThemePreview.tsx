// The theme builder's preview: a small AvaTG window drawn with the real controls, coloured by the theme being
// edited (its CSS variables are set on this element only). Pointing at a colour in the list outlines every part
// of the preview that uses it.
import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import { Button, Checkbox, IconButton, ProgressBar, Switch, TextField } from "../../components/ui/controls";
import { Icon } from "../../components/ui/Icon";
import { cssColor, themeVars, type Theme } from "../../lib/themes";
import type { EditableToken } from "./tokenInfo";
import s from "./themeBuilder.module.css";

const Focus = createContext<EditableToken | null>(null);

/** A part of the preview drawn with the tokens in `t`; outlined while one of them is pointed at in the list. */
function P({ t, className, children }: { t: string; className?: string; children?: ReactNode }) {
  const focus = useContext(Focus);
  return (
    <div className={className} data-hl={(focus && t.split(" ").includes(focus)) || undefined}>
      {children}
    </div>
  );
}

export function ThemePreview({ theme, glass, focus }: { theme: Theme; glass: number; focus: EditableToken | null }) {
  const vars = themeVars(theme, glass, true) as CSSProperties;
  const backdrop = `linear-gradient(135deg, ${cssColor(theme.colors.Accent)}, ${cssColor(theme.solidGlass)})`;
  return (
    <Focus.Provider value={focus}>
      <div className={s.previewBackdrop} style={{ background: backdrop }} aria-label="Preview">
        <div className={s.previewWindow} style={vars}>
          <P t="Glass Solid Edge" className={s.pvFrame}>
            <P t="Bar Hair" className={s.pvTop}>
              <P t="Field Line Fg3" className={s.pvSearch}>
                <TextField
                  label="Search"
                  placeholder="Search downloads"
                  value=""
                  leading={<Icon name="search" size={14} />}
                />
              </P>
              <div className={s.pvSpacer} />
              <P t="Accent OnAccent">
                <Button small variant="primary" icon="plus">
                  Add link
                </Button>
              </P>
              <P t="Surface Line Fg">
                <IconButton icon="settings" label="Settings" small />
              </P>
            </P>
            <P t="Fg3" className={s.pvHead}>
              <span>NAME</span>
              <span>STATUS</span>
            </P>
            <P t="Sel" className={`${s.pvRow} ${s.pvSel}`}>
              <P t="Accent OnAccent">
                <Checkbox label="Selected" checked onChange={() => {}} />
              </P>
              <P t="Surface" className={s.pvThumb} />
              <div className={s.pvName}>
                <P t="Fg">
                  <b>A video being downloaded</b>
                </P>
                <P t="Fg3">
                  <small>Channel · 12:04</small>
                </P>
              </div>
              <div className={s.pvStatus}>
                <P t="Accent Track">
                  <ProgressBar percent={64} />
                </P>
                <P t="Accent">
                  <small className={s.pvAccent}>Video · 1m 12s left</small>
                </P>
              </div>
            </P>
            <P t="Hover" className={`${s.pvRow} ${s.pvHover}`}>
              <P t="LineStrong">
                <Checkbox label="Not selected" checked={false} onChange={() => {}} />
              </P>
              <P t="Surface" className={s.pvThumb} />
              <div className={s.pvName}>
                <P t="Fg">
                  <b>A paused video (pointer over it)</b>
                </P>
                <P t="Fg3">
                  <small>Channel · 3:41</small>
                </P>
              </div>
              <div className={s.pvStatus}>
                <P t="Warn Track">
                  <ProgressBar percent={40} paused />
                </P>
                <P t="Warn">
                  <small className={s.pvWarn}>Paused</small>
                </P>
              </div>
            </P>
            <div className={s.pvRow}>
              <P t="LineStrong">
                <Checkbox label="Not selected" checked={false} onChange={() => {}} />
              </P>
              <P t="Surface" className={s.pvThumb} />
              <div className={s.pvName}>
                <P t="Fg">
                  <b>A finished video</b>
                </P>
                <P t="Fg2">
                  <small className={s.pvFg2}>MP4 · 1080p</small>
                </P>
              </div>
              <div className={s.pvStatus}>
                <P t="Ok">
                  <small className={s.pvOk}>
                    <Icon name="check" size={12} strokeWidth={2} /> Completed
                  </small>
                </P>
                <P t="Bad">
                  <small className={s.pvBad}>
                    <Icon name="alert" size={12} /> Failed · Video unavailable
                  </small>
                </P>
              </div>
            </div>
            <P t="Panel Hair" className={s.pvPanel}>
              <div className={s.pvStats}>
                <P t="Fg3">
                  <small>SIZE</small>
                </P>
                <P t="Fg">
                  <b>91.0 MB</b>
                </P>
              </div>
              <P t="Field Fg2" className={s.pvLog}>
                [download] Destination: A finished video.mp4
              </P>
              <P t="Track Accent">
                <Switch label="Switch" checked onChange={() => {}} />
              </P>
            </P>
            <P t="Bar Hair Fg3" className={s.pvStatusBar}>
              <span>3.1 MB/s</span>
              <P t="Line" className={s.pvChip}>
                Pause all
              </P>
              <P t="Sel Accent" className={`${s.pvChip} ${s.pvChipOn}`}>
                1 at a time
              </P>
            </P>
            <P t="Scrim" className={s.pvScrim} />
            <P t="Menu Line Fg Bad" className={s.pvMenu}>
              <div>Show in folder</div>
              <P t="Hover" className={s.pvMenuHover}>
                Copy video link
              </P>
              <div className={s.pvBad}>Delete files…</div>
            </P>
          </P>
        </div>
      </div>
    </Focus.Provider>
  );
}
