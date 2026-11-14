// Timing for "Took" and "Average speed". One clock per run of yt-dlp: the run's whole length, and the parts of
// it spent receiving data (merging and converting excluded). The store adds each run's totals to the record.

export class RunClock {
  private transferSince: number | null = null;
  private transfer = 0;

  constructor(private readonly startedAt: number) {}

  /** Data is arriving (a progress line). Repeated calls are fine. */
  receiving(now: number) {
    this.transferSince ??= now;
  }

  /** A file finished, or a post-processor started: no data is arriving. */
  idle(now: number) {
    if (this.transferSince === null) return;
    this.transfer += now - this.transferSince;
    this.transferSince = null;
  }

  /** The run ended (finished, paused, failed...). */
  stop(now: number): { activeMs: number; transferMs: number } {
    this.idle(now);
    return { activeMs: Math.max(0, now - this.startedAt), transferMs: this.transfer };
  }
}
