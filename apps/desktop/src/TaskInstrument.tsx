import { useRef } from "react";
import {
  Type,
  ImagePlus,
  Highlighter,
  Layers,
  PenLine,
  CheckSquare,
  Search,
  Download,
  ChevronDown,
  ArrowUpRight,
} from "./icons";
const modes = [
  ["Edit", Type, "Move, resize and change content"],
  ["Insert", ImagePlus, "Add text, images or another PDF"],
  ["Annotate", Highlighter, "Highlight, draw and comment"],
  ["Pages", Layers, "Reorder, rotate and extract"],
  ["Forms", CheckSquare, "Build and fill interactive fields"],
  ["Sign", PenLine, "Your signature, made personal"],
  ["Review", Search, "Compare, recognize and inspect"],
  ["Export", Download, "Save a copy, compress or convert"],
] as const;
/** One task switcher instead of a ribbon; spatial arrow-key navigation when open. */
export function WorkflowBar({
  mode,
  onChange,
  onTools,
}: {
  mode: string;
  onChange: (mode: string) => void;
  onTools: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const active =
    mode === "Draw" ? "Annotate" : mode === "Redact" ? "Review" : mode;
  const current = modes.find((m) => m[0] === active) ?? modes[0];
  return (
    <nav
      ref={ref}
      className="workflow-bar task-spine"
      aria-label="Document workflows"
      onKeyDown={(e) => {
        if (
          [
            "ArrowDown",
            "ArrowUp",
            "ArrowRight",
            "ArrowLeft",
            "Home",
            "End",
          ].includes(e.key)
        ) {
          e.preventDefault();
          const buttons = [
            ...e.currentTarget.querySelectorAll<HTMLButtonElement>(
              "button[aria-keyshortcuts]",
            ),
          ];
          const i = buttons.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          buttons[
            e.key === "Home"
              ? 0
              : e.key === "End"
                ? 7
                : (i + (["ArrowDown", "ArrowRight"].includes(e.key) ? 1 : 7)) %
                  8
          ].focus();
        }
      }}
    >
      <header>
        <span>WORKSPACE</span>
        <kbd>Alt 1–8</kbd>
      </header>
      <button
        className="all-tools-entry"
        aria-label="All tools"
        onClick={onTools}
      >
        <Search size={16} />
        <span>All tools</span>
        <kbd>Search</kbd>
      </button>
      <span className="task-track" aria-hidden="true" />
      {modes.map(([name, Icon, hint], index) => (
        <button
          key={name}
          aria-label={name}
          aria-keyshortcuts={`Alt+${index + 1}`}
          title={`${hint} · Alt+${index + 1}`}
          aria-pressed={active === name}
          onClick={() => onChange(name)}
        >
          <Icon size={17} />
          <span>{name}</span>
          <small>{String(index + 1).padStart(2, "0")}</small>
        </button>
      ))}
      <footer>{current[2]}</footer>
    </nav>
  );
}
