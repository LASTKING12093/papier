import { useState } from "react";
import { Dialog, type PaletteAction } from "./components";
import { Search, ArrowUpRight, Plus, Check } from "./icons";
import { toolDescription, toolSearch } from "./tool-catalog";
const buckets: Record<string, string[]> = {
  "Edit & insert": ["Edit", "Create"],
  Pages: ["Pages"],
  "Review & annotate": ["Review", "Annotate", "Advanced"],
  "Forms & signatures": ["Forms", "Sign"],
  "Export & protect": ["Convert", "Optimize", "Protect"],
  Workspace: ["File", "View", "Workspace"],
};
export function ToolLibrary({
  actions,
  hasDocument,
  onClose,
}: {
  actions: PaletteAction[];
  hasDocument: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("All tools");
  const [pins, setPins] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("papier-pinned-tools") ?? "[]",
      );
      return Array.isArray(saved)
        ? saved.filter((p) => typeof p === "string")
        : [];
    } catch {
      return [];
    }
  });
  const available = actions.filter((a) => a.name !== "Browse all tools");
  const rows = available.filter(
    (a) =>
      toolSearch(a.name, a.group, query) &&
      (category === "All tools" ||
        (category === "Pinned" && pins.includes(a.name)) ||
        buckets[category]?.includes(a.group)),
  );
  function pin(name: string) {
    const next = pins.includes(name)
      ? pins.filter((p) => p !== name)
      : [...pins, name];
    setPins(next);
    localStorage.setItem("papier-pinned-tools", JSON.stringify(next));
  }
  return (
    <Dialog title="Tools" wide onClose={onClose}>
      <div className="tool-library">
        <label className="tool-library-search">
          <Search size={17} />
          <input
            autoFocus
            placeholder="What do you want to do?"
            aria-label="Find a function"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span>{available.length} tools</span>
        </label>
        <div className="tool-library-body">
          <nav aria-label="Tool categories">
            {["All tools", "Pinned", ...Object.keys(buckets)].map((c) => (
              <button
                key={c}
                aria-pressed={category === c}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </nav>
          <div className="tool-library-results">
            {rows.map((a) => (
              <div key={a.name} className="tool-library-row">
                <button
                  disabled={a.needs && !hasDocument}
                  onClick={() => {
                    onClose();
                    void a.run();
                  }}
                >
                  <a.icon size={19} />
                  <span>
                    <strong>{a.name}</strong>
                    <small>
                      {a.needs && !hasDocument
                        ? "Open a document to use this tool"
                        : toolDescription(a.name) || a.group}
                    </small>
                  </span>
                  <ArrowUpRight size={14} />
                </button>
                <button
                  aria-label={`${pins.includes(a.name) ? "Unpin" : "Pin"} ${a.name}`}
                  title="Keep in Pinned"
                  aria-pressed={pins.includes(a.name)}
                  onClick={() => pin(a.name)}
                >
                  {pins.includes(a.name) ? (
                    <Check size={14} />
                  ) : (
                    <Plus size={14} />
                  )}
                </button>
              </div>
            ))}
            {!rows.length && (
              <p className="tool-library-empty">
                {category === "Pinned"
                  ? "Pin the tools you use most with +."
                  : "No matching tools. Try a shorter description."}
              </p>
            )}
          </div>
        </div>
      </div>
      <footer>
        <span className="muted">
          Search in English or Portuguese · Ctrl K for quick commands
        </span>
        <button className="secondary" onClick={onClose}>
          Close
        </button>
      </footer>
    </Dialog>
  );
}
