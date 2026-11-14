// The inline "already downloaded" warning in the video dialog and the playlist page, with one answer for all.
import { Segmented } from "../../components/ui/controls";
import { Icon } from "../../components/ui/Icon";
import type { Duplicate, DuplicateChoice } from "../downloads/duplicates";
import s from "./picker.module.css";

const CHOICES: { value: DuplicateChoice; label: string }[] = [
  { value: "skip", label: "Skip" },
  { value: "rename", label: "Rename" },
  { value: "replace", label: "Replace" },
];

const HELP: Record<DuplicateChoice, string> = {
  skip: "Leave what you already have.",
  rename: "Download another copy, named with (2) at the end.",
  replace: "Delete the old file and download it again.",
};

export function DuplicateNotice({
  dups,
  total,
  choice,
  onChoice,
}: {
  dups: Duplicate[];
  /** how many videos are being added */
  total: number;
  choice: DuplicateChoice;
  onChoice: (c: DuplicateChoice) => void;
}) {
  if (!dups.length) return null;
  const done = dups.filter((d) => d.done).length;
  const what =
    total === 1
      ? done
        ? "You already downloaded this video in this format to this folder."
        : "This video is already in your downloads with this format and folder."
      : `${dups.length} of the ${total} videos are already in your downloads with this format and folder.`;
  return (
    <div className={s.duplicate} role="alert">
      <div className={s.duplicateText}>
        <Icon name="alert" size={16} />
        <span>
          {what} <small>{HELP[choice]}</small>
        </span>
      </div>
      <Segmented label="Already downloaded" options={CHOICES} value={choice} onChange={onChoice} />
    </div>
  );
}
