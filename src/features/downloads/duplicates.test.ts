import { describe, expect, it } from "vitest";
import { findDuplicates, nextSuffix, planDuplicates, videoKey } from "./duplicates";
import type { DownloadRecord } from "./types";

const rec = (p: Partial<DownloadRecord>) =>
  ({
    id: "r",
    url: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
    formatLabel: "MP4 · 1080p",
    dir: "/v",
    status: "done",
    filepath: "/v/Zoo.mp4",
    ...p,
  }) as DownloadRecord;

describe("videoKey", () => {
  it("treats every form of a YouTube link as the same video", () => {
    const k = "yt:jNQXAC9IVRw";
    expect(videoKey("https://youtu.be/jNQXAC9IVRw?t=3")).toBe(k);
    expect(videoKey("https://m.youtube.com/watch?v=jNQXAC9IVRw&list=PL1")).toBe(k);
    expect(videoKey("https://www.youtube.com/shorts/jNQXAC9IVRw")).toBe(k);
    expect(videoKey("https://vimeo.com/1#t=4")).toBe("https://vimeo.com/1");
  });
});

describe("findDuplicates", () => {
  const all = () => true;
  const video = { url: "https://youtu.be/jNQXAC9IVRw" };
  it("matches the same video, format and folder", () => {
    expect(findDuplicates([video], "MP4 · 1080p", "/v/", [rec({})], all)).toHaveLength(1);
    expect(findDuplicates([video], "MP3 · Best", "/v", [rec({})], all)).toHaveLength(0);
    expect(findDuplicates([video], "MP4 · 1080p", "/other", [rec({})], all)).toHaveLength(0);
  });
  it("ignores cancelled downloads and finished files that are gone", () => {
    expect(findDuplicates([video], "MP4 · 1080p", "/v", [rec({ status: "cancelled" })], all)).toHaveLength(0);
    expect(findDuplicates([video], "MP4 · 1080p", "/v", [rec({})], () => false)).toHaveLength(0);
    const queued = findDuplicates([video], "MP4 · 1080p", "/v", [rec({ status: "queued" })], () => false);
    expect(queued[0].done).toBe(false);
  });
});

describe("planDuplicates", () => {
  const videos = [{ url: "a" }, { url: "b" }];
  const dups = [{ index: 1, existing: [rec({ id: "old" })], done: true }];
  it("skips, renames or replaces only the duplicates", () => {
    expect(planDuplicates(videos, dups, "skip").videos).toEqual([{ url: "a" }]);
    expect(planDuplicates(videos, dups, "rename").videos[1]).toEqual({ url: "b", nameSuffix: " (2)" });
    const r = planDuplicates(videos, dups, "replace");
    expect(r.videos).toHaveLength(2);
    expect(r.replaced.map((x) => x.id)).toEqual(["old"]);
  });
  it("counts up past existing copies", () => {
    expect(nextSuffix([rec({}), rec({ nameSuffix: " (2)" })])).toBe(" (3)");
  });
});
