import { Select } from "./components";

const tasks = {
  Edit: {
    description: "Move objects and change existing content",
    shortcut: "Alt 1",
  },
  Insert: { description: "Add text, images and PDF pages", shortcut: "Alt 2" },
  Annotate: {
    description: "Highlight, draw and leave comments",
    shortcut: "Alt 3",
  },
  Pages: {
    description: "Reorder, crop, split and combine pages",
    shortcut: "Alt 4",
  },
  Forms: {
    description: "Create fields or fill in a document",
    shortcut: "Alt 5",
  },
  Sign: { description: "Create and place your signature", shortcut: "Alt 6" },
  Review: {
    description: "Compare, recognize text and inspect",
    shortcut: "Alt 7",
  },
  Export: { description: "Save, compress and convert", shortcut: "Alt 8" },
  "All tools…": { description: "Browse everything Papier can do" },
};

/** Descriptive task switcher; uses the same keyboard and anchored popup as Select. */
export function TaskMenu({
  value,
  onChange,
  onBrowse,
}: {
  value: string;
  onChange: (value: string) => void;
  onBrowse: () => void;
}) {
  return (
    <span className="workspace-mode">
      <Select
        label="Workspace mode"
        value={value}
        options={Object.keys(tasks)}
        details={tasks}
        onChange={(v) => (v === "All tools…" ? onBrowse() : onChange(v))}
      />
    </span>
  );
}
