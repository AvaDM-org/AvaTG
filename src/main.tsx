import "@fontsource-variable/figtree";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/global.css";

async function main() {
  let root = <App />;
  // Dev only: `?demo` runs the app in a normal browser with mocked Rust commands (src/dev/demo.ts), and
  // `?gallery` shows every control. `import.meta.env.DEV` is false in release builds, so both are dropped.
  if (import.meta.env.DEV) {
    const params = new URLSearchParams(location.search);
    if (params.has("demo")) (await import("./dev/demo")).installDemo();
    if (params.has("gallery")) {
      const { Gallery } = await import("./dev/Gallery");
      root = <Gallery />;
    }
  }
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>{root}</React.StrictMode>,
  );
}

void main();
