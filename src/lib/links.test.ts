import { describe, expect, it } from "vitest";
import { extractLinks, extractLinksFromHtml, parseLinkList } from "./links";

describe("extractLinks", () => {
  it("finds links in free text, drops trailing punctuation and duplicates", () => {
    const text =
      "watch https://youtu.be/abc123, then https://www.youtube.com/watch?v=x&list=PL1. Again: https://youtu.be/abc123";
    expect(extractLinks(text)).toEqual(["https://youtu.be/abc123", "https://www.youtube.com/watch?v=x&list=PL1"]);
  });

  it("returns nothing for text without links", () => {
    expect(extractLinks("no links here")).toEqual([]);
  });
});

describe("extractLinksFromHtml", () => {
  it("reads hrefs, decoding &amp;", () => {
    const html = '<a href="https://www.youtube.com/watch?v=a&amp;t=1">A</a><a href="https://youtu.be/b">B</a>';
    expect(extractLinksFromHtml(html)).toEqual(["https://www.youtube.com/watch?v=a&t=1", "https://youtu.be/b"]);
  });
});

describe("parseLinkList", () => {
  it("reads one link per line, skipping comments, blanks and duplicates", () => {
    const text =
      "# my list\nhttps://youtu.be/a\n\n  # https://youtu.be/skipped\nhttps://youtu.be/b\r\nhttps://youtu.be/a\n";
    expect(parseLinkList(text)).toEqual(["https://youtu.be/a", "https://youtu.be/b"]);
  });
  it("reads Windows .url shortcuts and saved pages", () => {
    expect(parseLinkList("[InternetShortcut]\nURL=https://www.youtube.com/watch?v=x")).toEqual([
      "https://www.youtube.com/watch?v=x",
    ]);
    expect(parseLinkList('<p><a href="https://youtu.be/c">c</a></p>')).toEqual(["https://youtu.be/c"]);
  });
});
