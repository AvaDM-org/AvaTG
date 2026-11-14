// "Add link": a link field (paste button inside), then a reading spinner. Errors from yt-dlp show inline.
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { useState } from "react";
import { Button, IconButton, TextField } from "../../components/ui/controls";
import { Dialog } from "../../components/ui/Dialog";
import { Icon } from "../../components/ui/Icon";
import { extractLinks } from "../../lib/links";
import { usePicker } from "./store";
import s from "./picker.module.css";

export function AddLinkDialog() {
  const { state, open, close } = usePicker();
  const [text, setText] = useState("");
  const loading = state.phase === "loading";
  const error = state.phase === "input" ? state.error : null;

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
            onChange={setText}
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
