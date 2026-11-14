import { open } from "@tauri-apps/plugin-dialog";

/** The OS folder picker. Resolves with the chosen folder, or null when cancelled. */
export async function chooseFolder(current: string): Promise<string | null> {
  const picked = await open({ directory: true, defaultPath: current || undefined });
  return typeof picked === "string" ? picked : null;
}
