// The theme builder (Settings › Appearance › Edit): every colour with a swatch, an opacity slider and its
// #AARRGGBB value, next to a live preview. Changes are written to the theme's JSON file as you go, and since the
// edited theme is the one in use, the whole app shows them too.
import { useEffect, useRef, useState } from "react";
import { toastError } from "../../components/Toasts";
import { Button, Segmented, TextField } from "../../components/ui/controls";
import { parseColor, parseTheme, serializeTheme, toHex, type Rgba, type Theme } from "../../lib/themes";
import { useSettings } from "../settings/store";
import { useAppearance } from "./store";
import { ThemePreview } from "./ThemePreview";
import { TOKEN_GROUPS, type EditableToken } from "./tokenInfo";
import s from "./themeBuilder.module.css";

/** Wait this long after the last change before writing the file. */
const SAVE_DELAY_MS = 300;

/** The theme with its warnings worked out again (the same parsing a file goes through). */
const rebuild = (t: Theme): Theme => parseTheme(JSON.parse(serializeTheme(t)));

export function ThemeEditor({ theme, onDone }: { theme: Theme; onDone: () => void }) {
  const save = useAppearance((st) => st.save);
  const glass = useSettings((st) => st.settings.glass);
  const [draft, setDraft] = useState(theme);
  const [focus, setFocus] = useState<EditableToken | null>(null);
  const [saving, setSaving] = useState(false);
  const pending = useRef<{ timer: number; theme: Theme } | null>(null);

  const flush = () => {
    const p = pending.current;
    if (!p) return;
    window.clearTimeout(p.timer);
    pending.current = null;
    void save(p.theme)
      .catch(toastError)
      .finally(() => setSaving(false));
  };

  // Write what is left when the editor closes.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- flush only reads refs and the store
  useEffect(() => flush, []);

  /** Colours go through the same checks as a file (warnings); the name is kept as typed. */
  const update = (patch: Partial<Theme>) => {
    const next = "name" in patch ? { ...draft, ...patch } : { ...rebuild({ ...draft, ...patch }), name: draft.name };
    setDraft(next);
    setSaving(true);
    if (pending.current) window.clearTimeout(pending.current.timer);
    pending.current = { theme: next, timer: window.setTimeout(flush, SAVE_DELAY_MS) };
  };

  const color = (t: EditableToken) => (t === "Solid" ? draft.solidGlass : draft.colors[t]);
  const setColor = (t: EditableToken, c: Rgba) =>
    update(t === "Solid" ? { solidGlass: { ...c, a: 1 } } : { colors: { ...draft.colors, [t]: c } });

  return (
    <div className={s.editor}>
      <div className={s.editorHead}>
        <Button
          icon="back"
          onClick={() => {
            flush();
            onDone();
          }}
        >
          Themes
        </Button>
        <div className={s.nameField}>
          <TextField label="Theme name" value={draft.name} onChange={(name) => update({ name })} />
        </div>
        <Segmented
          label="Light or dark"
          value={draft.variant}
          onChange={(variant) => update({ variant })}
          options={[
            { value: "Dark", label: "Dark" },
            { value: "Light", label: "Light" },
          ]}
        />
        <span className={s.saved} aria-live="polite">
          {saving ? "Saving…" : `Saved as ${draft.id}.theme.json`}
        </span>
      </div>

      <div className={s.editorBody}>
        <div className={s.tokenList} onMouseLeave={() => setFocus(null)}>
          {TOKEN_GROUPS.map((g) => (
            <section key={g.title} className={s.group}>
              <h3>{g.title.toUpperCase()}</h3>
              {g.tokens.map((t) => (
                <ColorRow
                  key={t.token}
                  name={t.name}
                  where={t.where}
                  value={color(t.token)}
                  opaque={t.token === "Solid"}
                  focused={focus === t.token}
                  onFocus={() => setFocus(t.token)}
                  onChange={(c) => setColor(t.token, c)}
                />
              ))}
            </section>
          ))}
        </div>
        <div className={s.previewColumn}>
          <ThemePreview theme={draft} glass={glass} focus={focus} />
          <p className={s.previewHint}>
            {focus ? "Outlined: where this colour is used." : "Point at a colour on the left to see where it is used."}
          </p>
          {draft.warnings.map((w) => (
            <p key={w} className={s.warning}>
              {w}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

const rgbHex = ({ r, g, b }: Rgba) => `#${toHex({ r, g, b, a: 1 }).slice(3)}`;

function ColorRow({
  name,
  where,
  value,
  opaque,
  focused,
  onFocus,
  onChange,
}: {
  name: string;
  where: string;
  value: Rgba;
  /** no opacity: always solid */
  opaque?: boolean;
  focused: boolean;
  onFocus: () => void;
  onChange: (c: Rgba) => void;
}) {
  const alpha = Math.round(value.a * 100);
  return (
    <div className={s.colorRow} data-focused={focused || undefined} onMouseEnter={onFocus} onFocus={onFocus}>
      <label className={s.swatch} title={`Pick the ${name.toLowerCase()} colour`}>
        <span className={s.swatchChecker}>
          <span style={{ background: `rgb(${value.r} ${value.g} ${value.b} / ${value.a})` }} />
        </span>
        <input
          type="color"
          aria-label={`${name} colour`}
          value={rgbHex(value)}
          onChange={(e) => {
            const c = parseColor(e.target.value);
            if (c) onChange({ ...c, a: value.a });
          }}
        />
      </label>
      <div className={s.colorText}>
        <b>{name}</b>
        <small>{where}</small>
      </div>
      {!opaque && (
        <div className={s.alpha} title="Opacity">
          <input
            type="range"
            min={0}
            max={100}
            value={alpha}
            aria-label={`${name} opacity`}
            onChange={(e) => onChange({ ...value, a: Number(e.target.value) / 100 })}
          />
          <span>{alpha}%</span>
        </div>
      )}
      <HexField value={opaque ? { ...value, a: 1 } : value} onChange={(c) => onChange(opaque ? { ...c, a: 1 } : c)} />
    </div>
  );
}

/** The colour as #AARRGGBB text; a typed value is taken when it is valid (Enter or leaving the field). */
function HexField({ value, onChange }: { value: Rgba; onChange: (c: Rgba) => void }) {
  const hex = toHex(value);
  const [text, setText] = useState(hex);
  const [editing, setEditing] = useState(false);
  const commit = () => {
    setEditing(false);
    const c = parseColor(text);
    if (c && toHex(c) !== hex) onChange(c);
    else setText(hex);
  };
  return (
    <div
      className={s.hex}
      onBlur={commit}
      onFocus={() => {
        setText(hex);
        setEditing(true);
      }}
    >
      <TextField
        label="Colour value"
        value={editing ? text : hex}
        onChange={(v) => setText(v.toUpperCase())}
        onKeyDown={(e) => e.key === "Enter" && commit()}
      />
    </div>
  );
}
