// Settings › Appearance: theme cards (built-in, imported, "Import theme…") and the glass effect, like AvaDM.
import { open as openFile } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { toast, toastError } from "../../components/Toasts";
import { Button, IconButton } from "../../components/ui/controls";
import { Icon } from "../../components/ui/Icon";
import { themesFolder } from "../../ipc";
import { BUILT_IN_THEMES, cssColor, DEFAULT_THEME_ID, glassColor, type Theme } from "../../lib/themes";
import { Row, Section } from "../settings/rows";
import { useSettings } from "../settings/store";
import ss from "../settings/settings.module.css";
import s from "./appearance.module.css";
import { useAppearance } from "./store";

/** Import from a picked file path or a dropped file's text, with a notice either way. */
export async function importTheme(source: { path: string } | { text: string }) {
  try {
    const store = useAppearance.getState();
    const theme = await ("path" in source ? store.importFile(source.path) : store.importText(source.text));
    toast(theme.warnings.length ? `${theme.name} imported. ${theme.warnings.join(". ")}` : `${theme.name} imported`);
  } catch (e) {
    toastError(e);
  }
}

export function AppearancePage() {
  const { imported, hasBlur, remove } = useAppearance();
  const themeId = useSettings((st) => st.settings.themeId);
  const glass = useSettings((st) => st.settings.glass);
  const set = useSettings((st) => st.set);
  const themes = [...BUILT_IN_THEMES, ...imported];

  const pick = async () => {
    const path = await openFile({ multiple: false, filters: [{ name: "Theme", extensions: ["json"] }] });
    if (typeof path === "string") await importTheme({ path });
  };

  return (
    <>
      <section className={ss.section}>
        <h2>THEME</h2>
        <div className={s.cards}>
          {themes.map((t) => (
            <ThemeCard
              key={t.id}
              theme={t}
              selected={t.id === themeId}
              glass={glass}
              onSelect={() => set("themeId", t.id)}
              onRemove={t.builtIn ? undefined : () => void remove(t.id).catch(toastError)}
            />
          ))}
          <button type="button" className={s.card} onClick={() => void pick()}>
            <div className={s.importBox}>
              <Icon name="plus" size={26} />
            </div>
            <div className={s.cardName}>
              <span>Import theme…</span>
              <small>.json</small>
            </div>
          </button>
        </div>
        {themes
          .find((t) => t.id === themeId)
          ?.warnings.map((w) => (
            <p key={w} className={s.warning}>
              {w}
            </p>
          ))}
      </section>
      <Section heading="WINDOW">
        <Row
          title="Glass effect"
          desc={
            hasBlur
              ? "0% is a solid window; higher shows more of the blurred desktop"
              : "The system does not blur behind this window, so it stays nearly solid"
          }
        >
          <input
            className={ss.slider}
            type="range"
            min={0}
            max={100}
            step={5}
            value={glass}
            aria-label="Glass effect"
            onChange={(e) => set("glass", Number(e.target.value))}
          />
          <span className={ss.value}>{glass}%</span>
        </Row>
        <Row
          title="Theme files"
          desc="A theme is one JSON file of colours in AvaDM's format; AvaDM themes work too. Drop one on the window to import it"
        >
          <Button onClick={async () => void openPath(await themesFolder()).catch(toastError)}>Open folder</Button>
        </Row>
      </Section>
    </>
  );
}

/** A card with a small live preview drawn from the theme's own colours. */
function ThemeCard({
  theme,
  selected,
  glass,
  onSelect,
  onRemove,
}: {
  theme: Theme;
  selected: boolean;
  glass: number;
  onSelect: () => void;
  onRemove?: () => void;
}) {
  const c = theme.colors;
  const color = (k: keyof Theme["colors"]) => cssColor(c[k]);
  return (
    <div className={s.cardWrap}>
      <button type="button" className={s.card} aria-pressed={selected} onClick={onSelect}>
        <div
          className={s.preview}
          style={{ background: `linear-gradient(135deg, ${color("Accent")}, ${color("Panel")})` }}
          aria-hidden
        >
          <div
            className={s.previewWindow}
            style={{ background: cssColor(glassColor(theme, glass, true)), borderColor: color("Edge") }}
          >
            <div className={s.previewBar} style={{ background: color("Bar") }}>
              <span style={{ background: color("Fg3") }} />
              <i style={{ background: color("Accent") }} />
            </div>
            <div className={s.previewRow} style={{ background: color("Sel") }}>
              <span style={{ background: color("Accent") }} />
            </div>
            {[0, 1, 2].map((i) => (
              <div key={i} className={s.previewRow} style={{ background: color("Hover") }}>
                <span style={{ background: color("Fg3"), width: `${60 - i * 12}%` }} />
              </div>
            ))}
          </div>
        </div>
        <div className={s.cardName}>
          <span>{theme.name}</span>
          <small>{theme.id === DEFAULT_THEME_ID ? "Default" : theme.builtIn ? "Built in" : "Imported"}</small>
        </div>
      </button>
      {onRemove && <IconButton className={s.remove} icon="x" label={`Remove ${theme.name}`} small onClick={onRemove} />}
    </div>
  );
}
