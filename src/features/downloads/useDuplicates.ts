// Which of the videos about to be added are already in the list (same format and folder). Finished downloads
// count only while their file is still on disk, which is asked once per change of format or folder.
import { useEffect, useMemo, useState } from "react";
import { fileSizes } from "../../ipc";
import { findDuplicates, type Duplicate } from "./duplicates";
import { useDownloads } from "./store";

export function useDuplicates(videos: { url: string }[], formatLabel: string, dir: string): Duplicate[] {
  const items = useDownloads((st) => st.items);
  const paths = useMemo(
    () =>
      items
        .filter((r) => r.status === "done" && r.filepath && r.formatLabel === formatLabel)
        .map((r) => r.filepath as string),
    [items, formatLabel],
  );
  const pathsKey = paths.join("\n");
  const [onDisk, setOnDisk] = useState<{ key: string; files: Set<string> } | null>(null);

  useEffect(() => {
    let live = true;
    const list = pathsKey ? pathsKey.split("\n") : [];
    fileSizes(list).then(
      (sizes) => live && setOnDisk({ key: pathsKey, files: new Set(list.filter((_, i) => sizes[i] != null)) }),
      () => live && setOnDisk({ key: pathsKey, files: new Set() }),
    );
    return () => {
      live = false;
    };
  }, [pathsKey]);

  return useMemo(() => {
    const files = onDisk?.key === pathsKey ? onDisk.files : new Set<string>();
    return findDuplicates(videos, formatLabel, dir, items, (p) => files.has(p));
  }, [videos, formatLabel, dir, items, onDisk, pathsKey]);
}
