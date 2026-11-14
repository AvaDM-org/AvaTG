// Dev-only gallery (`?gallery`): every shared control in each state, on each built-in theme, with a contrast
// report. For checking design changes at a glance. Never in release builds (loaded from main.tsx in dev only).
import { useEffect, useState, type ReactNode } from "react";
import { StatusBar, StatusChip } from "../components/layout";
import { DetailPanel, Stat } from "../components/DetailPanel";
import {
  Button,
  Checkbox,
  Chip,
  IconButton,
  ProgressBar,
  Segmented,
  Stepper,
  Switch,
  TextField,
} from "../components/ui/controls";
import { Icon } from "../components/ui/Icon";
import { applyTheme, BUILT_IN_THEMES, TEXT_SURFACES, worstContrast } from "../lib/themes";
import s from "./gallery.module.css";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={s.section}>
      <h2>{title}</h2>
      <div className={s.row}>{children}</div>
    </section>
  );
}

export function Gallery() {
  const [themeId, setThemeId] = useState(BUILT_IN_THEMES[0].id);
  const theme = BUILT_IN_THEMES.find((t) => t.id === themeId) ?? BUILT_IN_THEMES[0];
  useEffect(() => applyTheme(theme, 100, false), [theme]);
  const [on, setOn] = useState(true);
  const [seg, setSeg] = useState("b");
  const [num, setNum] = useState(4);
  const [text, setText] = useState("Some text");
  const [tab, setTab] = useState<"a" | "b">("a");

  return (
    <div className={s.page}>
      <header className={s.head}>
        <h1>AvaTG gallery</h1>
        <Segmented
          label="Theme"
          options={BUILT_IN_THEMES.map((t) => ({ value: t.id, label: t.name }))}
          value={themeId}
          onChange={setThemeId}
        />
      </header>

      <Section title="Buttons">
        <Button variant="primary" icon="plus">
          Primary
        </Button>
        <Button>Secondary</Button>
        <Button variant="danger" icon="trash">
          Danger
        </Button>
        <Button variant="text">Text</Button>
        <Button disabled>Disabled</Button>
        <Button small icon="folder">
          Small
        </Button>
        <IconButton icon="settings" label="Icon button" />
        <IconButton icon="x" label="Small icon button" small />
        <IconButton icon="x" label="Ghost icon button" small ghost />
      </Section>

      <Section title="Choices">
        <Segmented
          label="Segmented"
          options={[
            { value: "a", label: "One" },
            { value: "b", label: "Two" },
            { value: "c", label: "Three" },
          ]}
          value={seg}
          onChange={setSeg}
        />
        <Switch label="Switch" checked={on} onChange={setOn} />
        <Switch label="Switch off" checked={false} onChange={() => {}} />
        <Checkbox label="Checked" checked onChange={() => {}} />
        <Checkbox label="Mixed" checked indeterminate onChange={() => {}} />
        <Checkbox label="Unchecked" checked={false} onChange={() => {}} />
        <Checkbox label="Disabled" checked={false} disabled />
        <Chip on onClick={() => {}}>
          Chip on
        </Chip>
        <Chip on={false} onClick={() => {}}>
          Chip off
        </Chip>
      </Section>

      <Section title="Fields">
        <Stepper label="Stepper" value={num} onChange={setNum} min={1} max={10} suffix="parts" />
        <TextField
          label="Text"
          value={text}
          onChange={setText}
          width={220}
          leading={<Icon name="search" size={15} />}
        />
        <TextField label="Read only" value="/home/demo/Videos" readOnly width={220} />
      </Section>

      <Section title="Progress">
        <div className={s.bars}>
          <ProgressBar percent={62} />
          <ProgressBar percent={42} paused />
          <ProgressBar percent={100} done />
          <ProgressBar percent={null} />
        </div>
      </Section>

      <Section title="Panel and status bar">
        <div className={s.frame}>
          <DetailPanel
            label="Panel"
            tabs={[
              { id: "a", label: "General" },
              { id: "b", label: "Log" },
            ]}
            tab={tab}
            onTab={setTab}
            onClose={() => {}}
          >
            <div className={s.stats}>
              <Stat label="Size">91.0 MB</Stat>
              <Stat label="Took">1m 42s</Stat>
              <Stat label="Average speed">1.0 MB/s</Stat>
            </div>
          </DetailPanel>
          <StatusBar>
            <span>3.1 MB/s</span>
            <StatusChip>Pause all</StatusChip>
            <StatusChip on>Resume all</StatusChip>
          </StatusBar>
        </div>
      </Section>

      <Section title="Contrast (worst surface, needs 4.5:1)">
        <table className={s.table}>
          <thead>
            <tr>
              <th>Theme</th>
              {(["Fg", "Fg2", "Fg3"] as const).map((t) => (
                <th key={t}>{t}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {BUILT_IN_THEMES.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                {(["Fg", "Fg2", "Fg3"] as const).map((fg) => {
                  const w = worstContrast(t.colors, t.solidGlass, fg);
                  return (
                    <td key={fg} data-bad={w.ratio < 4.5 || undefined}>
                      {w.ratio.toFixed(1)}:1 <small>on {w.surface}</small>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <small className={s.note}>Surfaces checked: {TEXT_SURFACES.join(", ")}.</small>
      </Section>
    </div>
  );
}
