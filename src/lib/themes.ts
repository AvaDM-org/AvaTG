// Themes in AvaDM's format: one JSON file of colour tokens, no code. Colours are #AARRGGBB (alpha first) so AvaDM
// themes work as they are. A missing or broken token falls back to Dark glass for that token.
import cherryDark from "../themes/cherry-dark.theme.json";
import darkGlass from "../themes/dark-glass.theme.json";

/** Theme token → CSS variable (styles/tokens.css). */
export const TOKENS = {
  Glass: "--glass",
  Edge: "--edge",
  Fg: "--fg",
  Fg2: "--fg2",
  Fg3: "--fg3",
  Hair: "--hair",
  Line: "--line",
  LineStrong: "--line-strong",
  Field: "--field",
  Surface: "--surface",
  Sel: "--sel",
  Hover: "--hover",
  Bar: "--bar",
  Panel: "--panel",
  Track: "--track",
  Accent: "--accent",
  OnAccent: "--on-accent",
  Ok: "--ok",
  Warn: "--warn",
  Bad: "--bad",
  Menu: "--menu",
  Scrim: "--scrim",
} as const;

export type TokenName = keyof typeof TOKENS;

export interface Rgba {
  r: number;
  g: number;
  b: number;
  /** 0..1 */
  a: number;
}

export interface Theme {
  id: string;
  name: string;
  builtIn: boolean;
  colors: Record<TokenName, Rgba>;
  /** the window colour with glass at 0% */
  solidGlass: Rgba;
  /** e.g. secondary text too faint to read */
  warnings: string[];
}

/** "#AARRGGBB" or "#RRGGBB" → colour; null when it is not one. */
export function parseColor(text: unknown): Rgba | null {
  if (typeof text !== "string") return null;
  const m = /^#([0-9a-f]{6}|[0-9a-f]{8})$/i.exec(text.trim());
  if (!m) return null;
  const hex = m[1].length === 6 ? `FF${m[1]}` : m[1];
  const n = (i: number) => parseInt(hex.slice(i, i + 2), 16);
  return { a: n(0) / 255, r: n(2), g: n(4), b: n(6) };
}

export const cssColor = ({ r, g, b, a }: Rgba) => `rgb(${r} ${g} ${b} / ${Math.round(a * 1000) / 1000})`;

/** Read a theme file. Throws a short, readable error when it is not a theme at all. */
export function parseTheme(json: unknown, builtIn = false): Theme {
  const t = json as {
    id?: unknown;
    name?: unknown;
    colors?: Record<string, unknown>;
    solidFallback?: Record<string, unknown>;
  };
  if (!t || typeof t !== "object" || typeof t.colors !== "object" || t.colors === null) {
    throw new Error('This file is not a theme: it has no "colors"');
  }
  const name = typeof t.name === "string" && t.name.trim() ? t.name.trim() : "Untitled theme";
  const id = typeof t.id === "string" && /^[a-z0-9-]{1,64}$/.test(t.id) ? t.id : slug(name);
  const fallback = builtIn ? null : BUILT_IN_FALLBACK;
  const colors = {} as Record<TokenName, Rgba>;
  for (const token of Object.keys(TOKENS) as TokenName[]) {
    const c = parseColor(t.colors[token]) ?? fallback?.colors[token];
    if (!c) throw new Error(`Built-in theme ${id} lacks ${token}`);
    colors[token] = c;
  }
  const solidGlass = parseColor(t.solidFallback?.Glass) ?? { ...colors.Glass, a: 1 };
  return { id, name, builtIn, colors, solidGlass, warnings: contrastWarnings(colors, solidGlass) };
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64) || "theme";

// --- contrast (AvaDM: Fg2 and Fg3 must stay at 4.5:1 on the window) ---

const over = (top: Rgba, bottom: Rgba): Rgba => ({
  r: top.r * top.a + bottom.r * (1 - top.a),
  g: top.g * top.a + bottom.g * (1 - top.a),
  b: top.b * top.a + bottom.b * (1 - top.a),
  a: 1,
});

function luminance({ r, g, b }: Rgba): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrast(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function contrastWarnings(c: Record<TokenName, Rgba>, solidGlass: Rgba): string[] {
  const bg = { ...solidGlass, a: 1 };
  return (["Fg2", "Fg3"] as const)
    .map((t) => [t, contrast(over(c[t], bg), bg)] as const)
    .filter(([, ratio]) => ratio < 4.5)
    .map(
      ([t, ratio]) =>
        `${t === "Fg2" ? "Secondary" : "Helper"} text is hard to read (${ratio.toFixed(1)}:1, needs 4.5:1)`,
    );
}

// --- applying ---

/**
 * The window colour for a glass setting: a blend from the solid colour (0%) to the theme's Glass (100%).
 * Without blur behind the window it stays at least 88% opaque so text stays readable.
 */
export function glassColor(theme: Theme, glassPercent: number, hasBlur: boolean): Rgba {
  const f = Math.min(1, Math.max(0, glassPercent / 100));
  const s = theme.solidGlass;
  const g = theme.colors.Glass;
  const mix = (x: number, y: number) => x + (y - x) * f;
  const a = mix(s.a, g.a);
  return { r: mix(s.r, g.r), g: mix(s.g, g.g), b: mix(s.b, g.b), a: hasBlur ? a : Math.max(a, 0.88) };
}

/** Set every token as a CSS variable on the page. */
export function applyTheme(theme: Theme, glassPercent: number, hasBlur: boolean, root = document.documentElement) {
  for (const [token, cssVar] of Object.entries(TOKENS) as [TokenName, string][]) {
    root.style.setProperty(
      cssVar,
      cssColor(token === "Glass" ? glassColor(theme, glassPercent, hasBlur) : theme.colors[token]),
    );
  }
}

// --- built-in themes (last: parsing them uses everything above) ---

/** Dark glass: the fallback for any token an imported theme leaves out (as in AvaDM). */
const BUILT_IN_FALLBACK: Theme = parseTheme(darkGlass, true);

export const BUILT_IN_THEMES: Theme[] = [parseTheme(cherryDark, true), BUILT_IN_FALLBACK];
export const DEFAULT_THEME_ID = "cherry-dark";
