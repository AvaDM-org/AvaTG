// The theme builder's colour list: every token grouped, with a plain name and where it shows up.
import type { TokenName } from "../../lib/themes";

/** "Solid" is the theme's solidFallback.Glass: the window when the glass effect is at 0%. */
export type EditableToken = TokenName | "Solid";

export const TOKEN_GROUPS: { title: string; tokens: { token: EditableToken; name: string; where: string }[] }[] = [
  {
    title: "Window",
    tokens: [
      { token: "Glass", name: "Window", where: "Behind everything, with the glass effect" },
      { token: "Solid", name: "Solid window", where: "The window when glass is at 0% (always opaque)" },
      { token: "Edge", name: "Window edge", where: "The thin line around the window" },
      { token: "Bar", name: "Bars", where: "Top bar and status bar" },
      { token: "Panel", name: "Panels", where: "Detail panel and the settings menu" },
    ],
  },
  {
    title: "Text",
    tokens: [
      { token: "Fg", name: "Text", where: "Names, titles and values" },
      { token: "Fg2", name: "Secondary text", where: "Formats, folders and descriptions" },
      { token: "Fg3", name: "Helper text", where: "Column headings, hints and dashes" },
    ],
  },
  {
    title: "Lines",
    tokens: [
      { token: "Hair", name: "Dividers", where: "Lines under and over the bars" },
      { token: "Line", name: "Borders", where: "Buttons, fields and chips" },
      { token: "LineStrong", name: "Strong borders", where: "Checkbox outlines" },
    ],
  },
  {
    title: "Controls",
    tokens: [
      { token: "Field", name: "Fields", where: "Text fields, choice groups, steppers and the log" },
      { token: "Surface", name: "Buttons", where: "Buttons, thumbnails and cards" },
      { token: "Track", name: "Progress track", where: "The empty part of progress bars, and switches when off" },
      { token: "Hover", name: "Hovered rows", where: "A row under the pointer" },
      { token: "Sel", name: "Selected rows", where: "Selected rows and chosen options" },
    ],
  },
  {
    title: "Accent and status",
    tokens: [
      { token: "Accent", name: "Accent", where: "Main buttons, progress and selection marks" },
      { token: "OnAccent", name: "Text on accent", where: "Text on the main buttons" },
      { token: "Ok", name: "Completed", where: "Finished downloads" },
      { token: "Warn", name: "Paused and warnings", where: "Paused and interrupted downloads" },
      { token: "Bad", name: "Failed and delete", where: "Errors and destructive buttons" },
    ],
  },
  {
    title: "Overlays",
    tokens: [
      { token: "Menu", name: "Menus", where: "Menus, toasts and dialogs" },
      { token: "Scrim", name: "Dialog backdrop", where: "Dims the window behind a dialog" },
    ],
  },
];
