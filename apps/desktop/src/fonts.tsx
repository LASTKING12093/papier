import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search } from "./icons";
export const fontLibrary = [
  ["Noto Sans", "Sans", "Noto Sans"],
  ["Manrope", "Sans", "Manrope"],
  ["Helvetica", "Sans", "Arial"],
  ["Helvetica-Bold", "Sans", "Arial"],
  ["Helvetica-Oblique", "Sans", "Arial"],
  ["Helvetica-BoldOblique", "Sans", "Arial"],
  ["Noto Serif", "Serif", "Noto Serif"],
  ["Noto Serif Italic", "Serif", "Noto Serif Italic"],
  ["Times-Roman", "Serif", "Times New Roman"],
  ["Times-Bold", "Serif", "Times New Roman"],
  ["Times-Italic", "Serif", "Times New Roman"],
  ["Times-BoldItalic", "Serif", "Times New Roman"],
  ["Roboto Mono", "Mono", "Roboto Mono"],
  ["Courier", "Mono", "Courier New"],
  ["Courier-Bold", "Mono", "Courier New"],
  ["Courier-Oblique", "Mono", "Courier New"],
  ["Courier-BoldOblique", "Mono", "Courier New"],
  ["Cormorant Garamond", "Display", "Cormorant Garamond"],
  ["Caveat", "Script", "Caveat"],
] as const;
export const fontNames = [
  "Keep original font",
  ...fontLibrary.map((f) => f[0]),
];
export function FontPicker({
  value,
  onChange,
  label,
  original = true,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  original?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [sample, setSample] = useState(""),
    [category, setCategory] = useState("All"),
    [index, setIndex] = useState(0);
  const [recent, setRecent] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("papier-recent-fonts") ?? "[]");
    } catch {
      return [];
    }
  });
  const anchor = useRef<HTMLButtonElement>(null),
    popup = useRef<HTMLDivElement>(null),
    search = useRef<HTMLInputElement>(null);
  const id = useId();
  const rows = [
    ...(original
      ? [["Keep original font", "Original", "inherit"] as const]
      : []),
    ...fontLibrary,
  ].filter(
    (f) =>
      (category === "All" ||
        category === f[1] ||
        (category === "Recent" && recent.includes(f[0]))) &&
      f[0].toLowerCase().includes(query.toLowerCase()),
  );
  const rect = anchor.current?.getBoundingClientRect();
  function choose(v: string) {
    if (v !== "Keep original font") {
      const next = [v, ...recent.filter((f) => f !== v)].slice(0, 6);
      setRecent(next);
      localStorage.setItem("papier-recent-fonts", JSON.stringify(next));
    }
    onChange(v);
    setOpen(false);
    anchor.current?.focus();
  }
  useEffect(() => {
    if (!open) return;
    popup.current?.showPopover();
    search.current?.focus();
    const close = (e: PointerEvent) => {
      if (
        !popup.current?.contains(e.target as Node) &&
        !anchor.current?.contains(e.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  useEffect(() => {
    popup.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [index]);
  const node = (
    <div
      ref={popup}
      popover="manual"
      className="font-menu"
      style={{
        position: "fixed",
        left: Math.max(8, Math.min(rect?.left ?? 0, innerWidth - 322)),
        top: Math.max(8, Math.min((rect?.bottom ?? 0) + 5, innerHeight - 475)),
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") {
          e.preventDefault();
          setOpen(false);
          anchor.current?.focus();
        }
        if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
          e.preventDefault();
          setIndex((i) =>
            e.key === "Home"
              ? 0
              : e.key === "End"
                ? rows.length - 1
                : Math.max(
                    0,
                    Math.min(
                      rows.length - 1,
                      i + (e.key === "ArrowDown" ? 1 : -1),
                    ),
                  ),
          );
        }
        if (e.key === "Enter" && rows[index]) {
          e.preventDefault();
          choose(rows[index][0]);
        }
      }}
    >
      <label className="font-search">
        <Search size={14} />
        <input
          ref={search}
          placeholder="Search fonts…"
          aria-label="Search fonts"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
        />
      </label>
      <div className="font-categories">
        {["All", "Recent", "Sans", "Serif", "Mono", "Display", "Script"].map(
          (c) => (
            <button
              key={c}
              aria-pressed={category === c}
              onClick={() => {
                setCategory(c);
                setIndex(0);
              }}
            >
              {c}
            </button>
          ),
        )}
      </div>
      <label className="font-sample">
        <span>Preview</span>
        <input
          aria-label="Font preview text"
          placeholder="Type a sample…"
          value={sample}
          onChange={(e) => setSample(e.target.value)}
        />
      </label>
      <div role="listbox" id={id} aria-label={label}>
        {rows.map((f, i) => (
          <button
            role="option"
            aria-label={f[0]}
            aria-selected={index === i}
            key={f[0]}
            onMouseMove={() => setIndex(i)}
            onClick={() => choose(f[0])}
          >
            <span
              style={{
                fontFamily: f[2],
                fontStyle: /Italic|Oblique/.test(f[0]) ? "italic" : undefined,
                fontWeight: /Bold/.test(f[0]) ? 700 : 400,
              }}
            >
              {sample && f[1] !== "Original" ? sample : f[0]}
              {sample && f[1] !== "Original" && <small>{f[0]}</small>}
            </span>
            <small>{f[1]}</small>
          </button>
        ))}
        {!rows.length && <p>No fonts match this search.</p>}
      </div>
      <footer>Bundled fonts work offline and embed in your PDF.</footer>
    </div>
  );
  return (
    <>
      <button
        ref={anchor}
        className="select-trigger font-trigger"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onKeyDown={(e) => {
          if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
            setQuery("");
            setCategory("All");
            setIndex(e.key === "End" ? fontLibrary.length : 0);
          }
        }}
        onClick={() => {
          setOpen(!open);
          setQuery("");
          setCategory("All");
          setIndex(0);
        }}
      >
        <span>{value}</span>
        <ChevronDown size={12} />
      </button>
      {open &&
        (anchor.current?.closest("dialog")
          ? node
          : createPortal(node, document.body))}
    </>
  );
}
