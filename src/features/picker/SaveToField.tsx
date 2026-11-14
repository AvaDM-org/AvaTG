// "Save to": the download folder with a folder button inside, and the free space on that disk as the hint.
// When the download's size is known and the disk is too full for it, the hint turns into a warning.
import { useEffect, useState } from "react";
import { Field, IconButton, TextField } from "../../components/ui/controls";
import { freeSpace } from "../../ipc";
import { fmtBytes } from "../../lib/format";
import { chooseFolder } from "../settings/chooseFolder";
import s from "./picker.module.css";

export function SaveToField({
  dir,
  onChange,
  needBytes,
}: {
  dir: string;
  onChange: (dir: string) => void;
  /** the estimated size of what will be downloaded, if known */
  needBytes?: number | null;
}) {
  const free = useFreeSpace(dir);
  const short = free != null && needBytes != null && needBytes > free;
  return (
    <Field
      label="Save to"
      hint={
        free == null ? undefined : short ? (
          <span className={s.spaceWarn}>
            Only {fmtBytes(free)} free, needs about {fmtBytes(needBytes)}
          </span>
        ) : (
          `${fmtBytes(free)} free`
        )
      }
    >
      <TextField
        label="Save to"
        value={dir}
        onChange={onChange}
        trailing={
          <IconButton
            icon="folder"
            label="Choose folder"
            small
            onClick={async () => onChange((await chooseFolder(dir)) ?? dir)}
          />
        }
      />
    </Field>
  );
}

/** Free bytes on the disk of `dir`, asked again shortly after the folder changes; null while unknown. */
function useFreeSpace(dir: string): number | null {
  const [free, setFree] = useState<{ dir: string; bytes: number } | null>(null);
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      freeSpace(dir).then(
        (bytes) => live && setFree({ dir, bytes }),
        () => live && setFree(null),
      );
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [dir]);
  return free?.dir === dir && dir.trim() ? free.bytes : null;
}
