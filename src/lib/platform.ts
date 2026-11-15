// The platform the app runs on, read from the webview (WebView2 on Windows reports "Windows" in its user agent).
export const isWindows = typeof navigator !== "undefined" && /Windows/i.test(navigator.userAgent);

/** Browsers built on Chromium. On Windows yt-dlp cannot read their cookies (locked and app-bound encrypted). */
export const CHROMIUM_BROWSERS = ["chrome", "chromium", "brave", "edge", "vivaldi", "opera"];
