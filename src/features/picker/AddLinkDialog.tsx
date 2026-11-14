// "Add link": a link field (paste button inside), then a reading spinner. Errors from yt-dlp show inline.
// "Import list" reads many links at once, from the clipboard or a file.
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { open as openFile } from "@tauri-apps/plugin-dialog";
import { useState } from "react";
import { Button, IconButton, TextField } from "../../components/ui/controls";
import { Dialog } from "../../components/ui/Dialog";
import { Icon } from "../../components/ui/Icon";
import { Dropdown, MenuItem } from "../../components/ui/Menu";
import { readLinkList } from "../../ipc";
import { extractLinks, LINK_LIST_EXTENSIONS, parseLinkList } from "../../lib/links";
import { usePicker } from "./store";
import s from "./picker.module.css";

export function AddLinkDialog() {
  const { state, open, close } = usePicker();
  const [text, setText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const loading = state.phase === "loading";
  const error = importError ?? (state.phase === "input" ? state.error : null);

  const importList = async (from: "clipboard" | "file") => {
    setImportError(null);
    try {
      let list: string;
      if (from === "clipboard") {
        list = (await readText().catch(() => "")) ?? "";
      } else {
        const path = await openFile({
          title: "Import a list of links",
          filters: [{ name: "Lists of links", extensions: LINK_LIST_EXTENSIONS }],
        });
        if (typeof path !== "string") return;
        list = await readLinkList(path);
      }
      const links = parseLinkList(list);
      if (links.length) void open(links);
      else
        setImportError(from === "clipboard" ? "There are no links on the clipboard." : "No links found in that file.");
    } catch (e) {
      setImportError(String(e));
    }
  };

  const submit = (value = text) => {
    const links = extractLinks(value);
    void open(links.length ? links : value.trim() ? [value.trim()] : []);
  };

  return (
    <Dialog
      title="Add link"
      width={540}
      onClose={close}
      onConfirm={() => submit()}
      headExtra={
        !loading && (
          <Dropdown
            label="Import list"
            width={200}
            trigger={({ toggle }) => (
              <Button small icon="download" onClick={toggle}>
                Import list
              </Button>
            )}
          >
            {(close) => (
              <>
                <MenuItem
                  onSelect={() => {
                    close();
                    void importList("clipboard");
                  }}
                >
                  From clipboard
                </MenuItem>
                <MenuItem
                  onSelect={() => {
                    close();
                    void importList("file");
                  }}
                >
                  From file…
                </MenuItem>
              </>
            )}
          </Dropdown>
        )
      }
      footer={
        <>
          <span>Videos, playlists and channels from YouTube or any site yt-dlp supports</span>
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" disabled={loading || !text.trim()} onClick={() => submit()}>
            Continue
          </Button>
        </>
      }
    >
      {loading ? (
        <div className={s.loading}>
          <div className={s.spinner} />
          <span>{state.message}</span>
        </div>
      ) : (
        <>
          <TextField
            label="Link"
            placeholder="https://www.youtube.com/watch?v=…"
            value={text}
            onChange={(v) => {
              setText(v);
              setImportError(null);
            }}
            autoFocus
            leading={<Icon name="link" size={15} />}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            trailing={
              <IconButton
                icon="clipboard"
                label="Paste from clipboard"
                small
                onClick={async () => {
                  const t = (await readText().catch(() => "")) ?? "";
                  setText(t.trim());
                  if (extractLinks(t).length) submit(t);
                }}
              />
            }
          />
          {error && <div className={s.error}>{error}</div>}
        </>
      )}
    </Dialog>
  );
}
