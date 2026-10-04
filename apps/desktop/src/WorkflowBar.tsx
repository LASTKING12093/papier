import { useLayoutEffect, useRef } from "react";
import {
  Type,
  ImagePlus,
  Highlighter,
  Layers,
  PenLine,
  CheckSquare,
  Search,
  Download,
} from "./icons";
const modes = [
  ["Edit", Type, "Select, move and change content"],
  ["Insert", ImagePlus, "Text, images and PDF pages"],
  ["Annotate", Highlighter, "Highlight, draw and comment"],
  ["Pages", Layers, "Reorder, rotate and extract"],
  ["Forms", CheckSquare, "Create and fill fields"],
  ["Sign", PenLine, "Signature Studio and certificates"],
  ["Review", Search, "Compare, recognize and inspect"],
  ["Export", Download, "Save, compress and export"],
] as const;
export function WorkflowBar({
  mode,
  onChange,
}: {
  mode: string;
  onChange: (mode: string) => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const active =
    mode === "Draw" ? "Annotate" : mode === "Redact" ? "Review" : mode;
  useLayoutEffect(() => {
    const bar = ref.current!,
      button = bar.querySelector<HTMLElement>('[aria-pressed="true"]')!;
    const update = () => {
      bar.style.setProperty("--indicator-x", `${button.offsetLeft}px`);
      bar.style.setProperty("--indicator-w", `${button.offsetWidth}px`);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(bar);
    return () => observer.disconnect();
  }, [active]);
  return (
    <nav ref={ref} className="workflow-bar" aria-label="Document workflows">
      <span className="workflow-indicator" aria-hidden="true" />
      {modes.map(([name, Icon, hint]) => (
        <button
          key={name}
          aria-pressed={active === name}
          title={hint}
          onClick={() => onChange(name)}
        >
          <Icon size={14} />
          <span>{name}</span>
        </button>
      ))}
    </nav>
  );
}
