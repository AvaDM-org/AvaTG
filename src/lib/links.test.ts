import { describe, expect, it } from "vitest";
import { extractLinks, extractLinksFromHtml } from "./links";

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
