import { describe, expect, it } from "vitest";
import {
  BUILT_IN_THEMES,
  glassColor,
  parseColor,
  parseTheme,
  serializeTheme,
  toHex,
  uniqueThemeId,
  worstContrast,
} from "./themes";

describe("parseColor", () => {
  it("reads #AARRGGBB with alpha first, like AvaDM", () => {
    expect(parseColor("#80FF0000")).toEqual({ a: 128 / 255, r: 255, g: 0, b: 0 });
    expect(parseColor("#EF4765")).toEqual({ a: 1, r: 239, g: 71, b: 101 });
    expect(parseColor("red")).toBeNull();
  });
});

describe("parseTheme", () => {
  it("ships Cherry dark first and Dark glass, both readable", () => {
    expect(BUILT_IN_THEMES.map((t) => t.id)).toEqual(["cherry-dark", "dark-glass"]);
    for (const t of BUILT_IN_THEMES) expect(t.warnings).toEqual([]);
  });

  it("fills missing tokens from Dark glass", () => {
    const t = parseTheme({ name: "Mint", colors: { Accent: "#FF3DDC97" } });
    expect(t.id).toBe("mint");
    expect(t.colors.Accent).toMatchObject({ r: 61, g: 220, b: 151 });
    expect(t.colors.Fg).toEqual(BUILT_IN_THEMES[1].colors.Fg);
  });

  it("warns when secondary text is too faint", () => {
    const t = parseTheme({ id: "faint", name: "Faint", colors: { Fg2: "#22FFFFFF", Fg3: "#22FFFFFF" } });
    expect(t.warnings).toHaveLength(2);
  });

  it("rejects files that are not themes", () => {
    expect(() => parseTheme({ hello: 1 })).toThrow(/not a theme/);
  });
});

describe("contrast", () => {
  it("keeps every built-in theme's text readable on every surface", () => {
    for (const t of BUILT_IN_THEMES) {
      expect(worstContrast(t.colors, t.solidGlass, "Fg").ratio).toBeGreaterThanOrEqual(7);
      expect(worstContrast(t.colors, t.solidGlass, "Fg2").ratio).toBeGreaterThanOrEqual(4.5);
      expect(worstContrast(t.colors, t.solidGlass, "Fg3").ratio).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("names the surface where text is hardest to read", () => {
    const t = parseTheme({ id: "pink", name: "Pink", colors: { Sel: "#FFF7EEF0" } });
    expect(t.warnings[0]).toMatch(/selected rows/);
  });
});

describe("glassColor", () => {
  const cherry = BUILT_IN_THEMES[0];
  it("0% is the solid colour, 100% the theme's glass", () => {
    expect(glassColor(cherry, 0, true).a).toBe(1);
    expect(glassColor(cherry, 100, true).a).toBeCloseTo(cherry.colors.Glass.a);
  });
  it("stays nearly solid without blur", () => {
    expect(glassColor(cherry, 100, false).a).toBe(0.88);
  });
});

describe("writing themes", () => {
  it("writes colours as #AARRGGBB", () => {
    expect(toHex({ a: 128 / 255, r: 255, g: 0, b: 16 })).toBe("#80FF0010");
  });

  it("round-trips a theme through its JSON file", () => {
    const cherry = BUILT_IN_THEMES[0];
    const again = parseTheme(JSON.parse(serializeTheme({ ...cherry, id: "copy", name: "Copy" })));
    expect(again.colors).toEqual(
      Object.fromEntries(Object.entries(cherry.colors).map(([k, c]) => [k, parseColor(toHex(c))])),
    );
    expect(again.variant).toBe("Dark");
    expect(again.solidGlass).toEqual(cherry.solidGlass);
  });

  it("matches the built-in files byte for byte in layout", () => {
    const text = serializeTheme(BUILT_IN_THEMES[0]);
    expect(text).toMatch(/^\{\n {2}"formatVersion": 1,\n {2}"id": "cherry-dark",/);
    expect(text).toContain('"Glass": "#9E1B0D11"');
  });

  it("finds a free id", () => {
    expect(uniqueThemeId("Ocean Blue", [])).toBe("ocean-blue");
    expect(uniqueThemeId("Ocean Blue", ["ocean-blue", "ocean-blue-2"])).toBe("ocean-blue-3");
  });
});
