// Settings › Appearance: theme cards (built-in, your own, "New theme", "Import theme…") with Edit, Duplicate,
// Export and Remove on each card's menu, the theme builder, and the glass effect.
import { open as openFile, save as saveFile } from "@tauri-apps/plugin-dialog";
import { useState } from "react";
import { toast, toastError } from "../../components/Toasts";
import { Button, IconButton } from "../../components/ui/controls";
import { Confirm } from "../../components/ui/Dialog";
import { Icon } from "../../components/ui/Icon";
import { Menu, MenuDivider, MenuItem, type Point } from "../../components/ui/Menu";
import { openExternal, themeExport, themesFolder } from "../../ipc";
import { BUILT_IN_THEMES, cssColor, DEFAULT_THEME_ID, glassColor, serializeTheme, type Theme } from "../../lib/themes";
import { Row, Section } from "../settings/rows";
import { useSettings } from "../settings/store";
import ss from "../settings/settings.module.css";
import s from "./appearance.module.css";
import { useAppearance } from "./store";
import { ThemeEditor } from "./ThemeEditor";

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

/** Save a theme's JSON file where the user chooses. */
async function exportTheme(t: Theme) {
  try {
    const path = await saveFile({
      title: `Export ${t.name}`,
      defaultPath: `${t.id}.theme.json`,
      filters: [{ name: "Theme", extensions: ["json"] }],
    });
    if (!path) return;
    await themeExport(path, serializeTheme(t));
    toast(`${t.name} exported`);
  } catch (e) {
    toastError(e);
  }
}

export function AppearancePage() {
  const { imported, hasBlur, remove, duplicate } = useAppearance();
  const themeId = useSettings((st) => st.settings.themeId);
  const glass = useSettings((st) => st.settings.glass);
  const set = useSettings((st) => st.set);
  const themes = [...BUILT_IN_THEMES, ...imported];
  const [editing, setEditing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Theme | null>(null);

  const pick = async () => {
    const path = await openFile({ multiple: false, filters: [{ name: "Theme", extensions: ["json"] }] });
    if (typeof path === "string") await importTheme({ path });
  };

  /** Built-in themes can't change: editing one edits a copy. The edited theme is selected so the app shows it. */
  const edit = async (t: Theme, copyName?: string) => {
    try {
      const target = t.builtIn || copyName ? await duplicate(t, copyName) : t;
      set("themeId", target.id);
      setEditing(target.id);
    } catch (e) {
      toastError(e);
    }
  };

  const editingTheme = imported.find((t) => t.id === editing);
  if (editingTheme) return <ThemeEditor key={editingTheme.id} theme={editingTheme} onDone={() => setEditing(null)} />;

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
              onEdit={() => void edit(t)}
              onDuplicate={() =>
                void duplicate(t)
                  .then((c) => toast(`${c.name} created`))
                  .catch(toastError)
              }
              onExport={() => void exportTheme(t)}
              onRemove={t.builtIn ? undefined : () => setRemoving(t)}
            />
          ))}
          <button
            type="button"
            className={s.card}
            onClick={() => void edit(themes.find((t) => t.id === themeId) ?? BUILT_IN_THEMES[0], "My theme")}
          >
            <div className={s.importBox}>
              <Icon name="edit" size={24} />
            </div>
            <div className={s.cardName}>
              <span>New theme</span>
              <small>From the current one</small>
            </div>
          </button>
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
          <Button onClick={async () => void openExternal(await themesFolder()).catch(toastError)}>Open folder</Button>
        </Row>
      </Section>
      {removing && (
        <Confirm
          title={`Remove ${removing.name}?`}
          message="Its file is deleted from AvaTG's themes folder. Export it first to keep a copy."
          action="Remove theme"
          onConfirm={() => void remove(removing.id).catch(toastError)}
          onClose={() => setRemoving(null)}
        />
      )}
    </>
  );
}

/** A card with a small live preview drawn from the theme's own colours. */
function ThemeCard({
  theme,
  selected,
  glass,
  onSelect,
  onEdit,
  onDuplicate,
  onExport,
  onRemove,
}: {
  theme: Theme;
  selected: boolean;
  glass: number;
  onSelect: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  /** only for your own themes */
  onRemove?: () => void;
}) {
  const [menu, setMenu] = useState<{ at: Point; anchor: HTMLElement } | null>(null);
  const run = (f: () => void) => () => {
    setMenu(null);
    f();
  };
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
          <small>{theme.id === DEFAULT_THEME_ID ? "Default" : theme.builtIn ? "Built in" : "Your own"}</small>
        </div>
      </button>
      <IconButton
        className={s.more}
        icon="more"
        label={`${theme.name}: edit, duplicate, export`}
        small
        aria-expanded={!!menu}
        onClick={(e) => {
          if (menu) return setMenu(null);
          const r = e.currentTarget.getBoundingClientRect();
          setMenu({ at: { x: r.left, y: r.bottom + 6 }, anchor: e.currentTarget });
        }}
      />
      {menu && (
        <Menu
          at={menu.at}
          anchor={menu.anchor}
          onClose={() => setMenu(null)}
          label={`${theme.name} actions`}
          width={200}
        >
          <MenuItem onSelect={run(onEdit)}>{theme.builtIn ? "Edit a copy…" : "Edit…"}</MenuItem>
          <MenuItem onSelect={run(onDuplicate)}>Duplicate</MenuItem>
          <MenuItem onSelect={run(onExport)}>Export…</MenuItem>
          {onRemove && (
            <>
              <MenuDivider />
              <MenuItem danger onSelect={run(onRemove)}>
                Remove…
              </MenuItem>
            </>
          )}
        </Menu>
      )}
    </div>
  );
}
