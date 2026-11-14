// Reading design tokens from JavaScript, for the few places that need a number (e.g. a virtualized row height).

/** A px-valued CSS custom property on :root, e.g. cssPx("--h-row") → 52. */
export function cssPx(name: string, el: Element = document.documentElement): number {
  return parseFloat(getComputedStyle(el).getPropertyValue(name)) || 0;
}
