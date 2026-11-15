import { describe, expect, it } from "vitest";
import { explainError } from "./youtube";

describe("explainError", () => {
  it("points the bot check at the cookies setting", () => {
    // as yt-dlp.exe printed it on Windows before --encoding utf-8 (the apostrophe was lost)
    const raw =
      "2_VXktb_2ag: Sign in to confirm you�re not a bot. This helps protect our community. Use --cookies-from-browser or --cookies for the authentication. See https://github.com/yt-dlp/yt-dlp/wiki/FAQ";
    const out = explainError(raw);
    expect(out).toMatch(/^YouTube wants to confirm you're not a bot/);
    expect(out).toContain("Settings › Files › Account");
    expect(out).not.toContain("--cookies");
  });

  it("explains Chromium cookies on Windows", () => {
    for (const raw of [
      "Could not copy Chrome cookie database. See  https://github.com/yt-dlp/yt-dlp/issues/7271  for more info",
      "WARNING: failed to decrypt with DPAPI",
    ])
      expect(explainError(raw)).toMatch(/^AvaTG could not read the browser's cookies.*Firefox/);
  });

  it("explains age-restricted and members-only videos", () => {
    expect(explainError("abc: Sign in to confirm your age. Use --cookies for the authentication.")).toMatch(
      /^This video is age-restricted/,
    );
    expect(explainError("Join this channel to get access to members-only content")).toMatch(/members only/);
  });

  it("keeps other errors, without yt-dlp's cookie advice", () => {
    expect(explainError("Video unavailable")).toBe("Video unavailable");
    expect(explainError("Private video. Use --cookies-from-browser or --cookies for the authentication.")).toBe(
      "Private video.",
    );
    expect(explainError("one\nSign in to confirm you're not a bot")).toMatch(/^one\nYouTube wants/);
  });
});
