// Pulls download links out of pasted or dropped content (plain text, text/uri-list or HTML).

const URL_RE = /\bhttps?:\/\/[^\s"'<>()]+/gi;

/** Distinct http(s) links in order of appearance, with trailing punctuation removed. */
export function extractLinks(text: string): string[] {
  const seen = new Set<string>();
  for (const m of text.matchAll(URL_RE)) {
    const url = m[0].replace(/[.,;:!?\]}]+$/, "").replace(/&amp;/g, "&");
    seen.add(url);
  }
  return [...seen];
}

/** Links from an HTML fragment: every href first (Firefox gives multi-selected links only as HTML), then bare text. */
export function extractLinksFromHtml(html: string): string[] {
  const hrefs = [...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]);
  return extractLinks([...hrefs, html.replace(/<[^>]*>/g, " ")].join("\n"));
}

/** Read every link from a drag-and-drop or clipboard DataTransfer, trying all formats. */
export function linksFromDataTransfer(dt: DataTransfer): string[] {
  const html = dt.getData("text/html");
  const uriList = dt
    .getData("text/uri-list")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#"))
    .join("\n");
  const plain = dt.getData("text/plain");
  return [...new Set([...(html ? extractLinksFromHtml(html) : []), ...extractLinks(uriList), ...extractLinks(plain)])];
}
