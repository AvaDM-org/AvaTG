import "@fontsource-variable/figtree";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/global.css";

async function main() {
  // Dev only: `?demo` runs the app in a normal browser with mocked Rust commands (src/dev/demo.ts).
  // `import.meta.env.DEV` is false in release builds, so this import is dropped from them.
  if (import.meta.env.DEV && new URLSearchParams(location.search).has("demo")) {
    (await import("./dev/demo")).installDemo();
  }
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void main();
