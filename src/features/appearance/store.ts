// Themes and glass (Settings › Appearance): the built-in themes plus imported JSON files (themes.rs), whether the OS
// blurs behind the window (blur.rs), and applying the chosen theme to the page.
import { create } from "zustand";
import { onWindowBlur, themeRead, themeRemove, themeSave, themesList, windowBlur } from "../../ipc";
import { applyTheme, BUILT_IN_THEMES, parseTheme, serializeTheme, uniqueThemeId, type Theme } from "../../lib/themes";
import { getSettings, useSettings } from "../settings/store";

interface AppearanceStore {
  imported: Theme[];
  /** whether the OS blurs what is behind the window */
  hasBlur: boolean;
  load: () => Promise<void>;
  /** Import a theme file; returns the new theme (and selects it). Throws a readable error. */
  importFile: (path: string) => Promise<Theme>;
  /** The same, from a file's text (a dropped file: the webview gets no path). */
  importText: (text: string) => Promise<Theme>;
  remove: (id: string) => Promise<void>;
  /** Write an edited theme to its file and show it (the theme builder saves as you edit). */
  save: (theme: Theme) => Promise<void>;
  /** A copy of `theme` under a new name and id, saved and selected. */
  duplicate: (theme: Theme, name?: string) => Promise<Theme>;
}

export const allThemes = () => [...BUILT_IN_THEMES, ...useAppearance.getState().imported];

/** The chosen theme, or the default when it was removed. */
export const currentTheme = () => allThemes().find((t) => t.id === getSettings().themeId) ?? BUILT_IN_THEMES[0];

const apply = () => applyTheme(currentTheme(), getSettings().glass, useAppearance.getState().hasBlur);

export const useAppearance = create<AppearanceStore>((set, get) => ({
  imported: [],
  hasBlur: false,

  load: async () => {
    const texts = await themesList().catch(() => [] as string[]);
    const imported: Theme[] = [];
    for (const text of texts) {
      try {
        const t = parseTheme(JSON.parse(text));
        if (!BUILT_IN_THEMES.some((b) => b.id === t.id)) imported.push(t);
      } catch {
        // A broken file in the themes folder is skipped, not fatal.
      }
    }
    set({ imported });
    apply();
    // Rust applies the blur once the window is on screen and then sends `window-blur`; it may already be done.
    void onWindowBlur((hasBlur) => {
      set({ hasBlur });
      apply();
    });
    if (await windowBlur().catch(() => false)) {
      set({ hasBlur: true });
      apply();
    }
  },

  importFile: async (path) => get().importText(await themeRead(path)),

  importText: async (text) => {
    if (text.length > 64 * 1024) throw new Error("This file is too big to be a theme");
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error("This file is not valid JSON");
    }
    const theme = parseTheme(json);
    if (BUILT_IN_THEMES.some((b) => b.id === theme.id)) {
      throw new Error(`"${theme.name}" uses the id of a built-in theme; change its "id"`);
    }
    await themeSave(theme.id, text);
    set({ imported: [...get().imported.filter((t) => t.id !== theme.id), theme] });
    useSettings.getState().set("themeId", theme.id);
    return theme;
  },

  save: async (theme) => {
    await themeSave(theme.id, serializeTheme(theme));
    const saved = { ...theme, builtIn: false };
    const list = get().imported;
    set({
      imported: list.some((t) => t.id === theme.id)
        ? list.map((t) => (t.id === theme.id ? saved : t))
        : [...list, saved],
    });
    apply();
  },

  duplicate: async (theme, name = `${theme.name} copy`) => {
    const id = uniqueThemeId(
      name,
      allThemes().map((t) => t.id),
    );
    const copy = parseTheme(JSON.parse(serializeTheme({ ...theme, id, name })));
    await get().save(copy);
    useSettings.getState().set("themeId", id);
    return copy;
  },

  remove: async (id) => {
    await themeRemove(id);
    set({ imported: get().imported.filter((t) => t.id !== id) });
    if (getSettings().themeId === id) useSettings.getState().set("themeId", BUILT_IN_THEMES[0].id);
    apply();
  },
}));

// Theme and glass changes apply at once.
useSettings.subscribe((st, prev) => {
  if (st.settings.themeId !== prev.settings.themeId || st.settings.glass !== prev.settings.glass) apply();
});
