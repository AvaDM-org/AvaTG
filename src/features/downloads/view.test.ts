import { describe, expect, it } from "vitest";
import type { DownloadRecord } from "./types";
import { filterCounts, matches, sortLabel } from "./view";

const rec = (p: Partial<DownloadRecord>) =>
  ({ title: "A video", channel: "Chan", url: "https://y/1", audioOnly: false, status: "done", ...p }) as DownloadRecord;
const all = { query: "", status: "all", type: "all" } as const;

describe("downloads view", () => {
  it("filters by status, type and search together", () => {
    const mp3 = rec({ audioOnly: true, status: "paused", title: "Song" });
    expect(matches(mp3, { ...all, type: "audio" })).toBe(true);
    expect(matches(mp3, { ...all, type: "video" })).toBe(false);
    expect(matches(rec({ status: "interrupted" }), { ...all, status: "paused" })).toBe(true);
    expect(matches(mp3, { ...all, query: "song" })).toBe(true);
    expect(matches(mp3, { ...all, query: "chan" })).toBe(true);
    expect(matches(mp3, { ...all, query: "nope" })).toBe(false);
  });

  it("counts each menu against the other filter", () => {
    const items = [rec({}), rec({ audioOnly: true }), rec({ status: "failed" })];
    const c = filterCounts(items, { ...all, type: "audio" });
    expect(c.status.all).toBe(1);
    expect(c.type).toEqual({ all: 3, video: 2, audio: 1 });
  });

  it("names header sorts that are not in the menu", () => {
    const label = (id: string) => ({ format: "Format" })[id];
    expect(sortLabel({ column: "added", desc: true }, label)).toBe("Newest first");
    expect(sortLabel({ column: "format", desc: true }, label)).toBe("Format ↓");
  });
});
