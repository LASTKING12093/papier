import { useEffect, useRef, useState, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { toolSearch } from "./tool-catalog";
import type { Rect } from "../../../packages/editor-state/types";
import {
  X,
  ChevronDown,
  LoaderCircle,
  Search,
  Check,
  ArrowUpRight,
} from "./icons";
export function IconButton({
  label,
  children,
  onClick,
  active = false,
  disabled = false,
  caption,
}: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  caption?: string;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`icon-button ${active ? "active" : ""} ${caption ? "labeled-tool" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
      {caption && <span>{caption}</span>}
    </button>
  );
}
export function Dialog({
  title,
  children,
  onClose,
  wide = false,
  dismissible = true,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  dismissible?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closing = useRef(false);
  function dismiss() {
    if (!dismissible || closing.current) return;
    closing.current = true;
    if (
      document.documentElement.dataset.motion === "reduced" ||
      !ref.current
    ) {
      onClose();
      return;
    }
    ref.current
      .animate(
        [
          { opacity: 1, transform: "none" },
          { opacity: 0, transform: "translateY(14px) scale(.985)" },
        ],
        { duration: 180, easing: "cubic-bezier(.4,0,1,1)", fill: "forwards" },
      )
      .finished.then(onClose)
      .catch(() => {});
  }
  useEffect(() => {
    ref.current?.showModal();
    const el = ref.current;
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? "wide" : ""}
      onCancel={(e) => {
        e.preventDefault();
        dismiss();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <header>
        <h2>{title}</h2>
        <IconButton
          label="Close dialog"
          onClick={dismiss}
          disabled={!dismissible}
        >
          <X size={18} />
        </IconButton>
      </header>
      {children}
    </dialog>
  );
}
export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const id = useId();
  return (
    <section className="inspector-section">
      <button
        className="section-toggle"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        {title}
        <ChevronDown size={11} />
      </button>
      <div
        id={id}
        className={`section-collapse ${open ? "" : "closed"}`}
        inert={!open}
      >
        <div>
          <div className="section-body">{children}</div>
        </div>
      </div>
    </section>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Select({
  value,
  onChange,
  options,
  label,
  details,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  label: string;
  details?: Record<string, { description: string; shortcut?: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const [position, setPosition] = useState({ left: 0, top: 0, width: 160 });
  function show() {
    const r = trigger.current!.getBoundingClientRect();
    const width = details ? 310 : Math.max(r.width, 160);
    const height = Math.min(
      details ? 440 : 240,
      options.length * (details ? 48 : 28) + 8,
      innerHeight - 16,
    );
    setPosition({
      left: Math.max(8, Math.min(r.left, innerWidth - width - 8)),
      top:
        r.bottom + height > innerHeight
          ? Math.max(8, r.top - height - 4)
          : r.bottom + 4,
      width,
    });
    setIndex(Math.max(0, options.indexOf(value)));
    setOpen(true);
  }
  useEffect(() => {
    if (!open) return;
    const dismiss = (e: PointerEvent) => {
      if (
        !menu.current?.contains(e.target as Node) &&
        !trigger.current?.contains(e.target as Node)
      )
        setOpen(false);
    };
    window.addEventListener("pointerdown", dismiss);
    const resize = () => setOpen(false);
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("resize", resize);
    };
  }, [open]);
  useEffect(() => {
    if (open)
      document
        .getElementById(`${id}-${index}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [index, open]);
  function choose(v: string) {
    onChange(v);
    setOpen(false);
    trigger.current?.focus();
  }
  return (
    <span className="select-wrap">
      <button
        ref={trigger}
        type="button"
        className="select-trigger"
        aria-label={label}
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-activedescendant={open ? `${id}-${index}` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(e) => {
          if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
            e.preventDefault();
            if (!open) show();
            else
              setIndex((i) =>
                e.key === "Home"
                  ? 0
                  : e.key === "End"
                    ? options.length - 1
                    : Math.max(
                        0,
                        Math.min(
                          options.length - 1,
                          i + (e.key === "ArrowDown" ? 1 : -1),
                        ),
                      ),
              );
          }
          if (e.key === "Enter" && open) {
            e.preventDefault();
            choose(options[index]);
          }
          if (e.key === "Escape" && open) {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
          }
          if (e.key === "Tab") setOpen(false);
        }}
      >
        <span>{value}</span>
        <ChevronDown size={11} />
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            className={`select-menu ${details ? "described-menu" : ""}`}
            style={position}
            id={id}
            role="listbox"
            aria-label={label}
          >
            {options.map((v, i) => (
              <button
                type="button"
                role="option"
                aria-label={v}
                aria-describedby={
                  details?.[v] ? `${id}-${i}-description` : undefined
                }
                id={`${id}-${i}`}
                aria-selected={v === value}
                className={i === index ? "chosen" : ""}
                key={v}
                onMouseMove={() => setIndex(i)}
                onClick={() => choose(v)}
              >
                <span>
                  {v}
                  {details?.[v] && (
                    <small id={`${id}-${i}-description`}>
                      {details[v].description}
                    </small>
                  )}
                </span>
                {details?.[v]?.shortcut && <kbd>{details[v].shortcut}</kbd>}
                {v === value && <Check size={12} />}
              </button>
            ))}
          </div>,
          trigger.current?.closest("dialog") ?? document.body,
        )}
    </span>
  );
}
export function Spinner() {
  return <LoaderCircle size={18} className="spin" aria-label="Working" />;
}

export function GeometryFields({
  bounds,
  onApply,
  proportional = false,
}: {
  bounds: Rect;
  proportional?: boolean;
  onApply: (bounds: Rect, degrees: number) => void;
}) {
  const [values, setValues] = useState({ ...bounds, degrees: 0 });
  useEffect(() => setValues({ ...bounds, degrees: 0 }), [bounds]);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (
          Object.values(values).some((v) => !Number.isFinite(v)) ||
          values.width <= 0 ||
          values.height <= 0
        )
          return;
        onApply(values, values.degrees);
      }}
    >
      <div className="property-grid">
        {(["x", "y", "width", "height"] as const).map((key) => (
          <label className="read-property" key={key}>
            <span>
              {key === "width"
                ? "W"
                : key === "height"
                  ? "H"
                  : key.toUpperCase()}
            </span>
            <input
              aria-label={`Object ${key}`}
              type="number"
              step=".1"
              required
              min={key === "width" || key === "height" ? 0.1 : undefined}
              value={Number(values[key].toFixed(1))}
              onChange={(e) =>
                setValues((v) => {
                  const next = { ...v, [key]: Number(e.target.value) };
                  if (proportional && key === "width")
                    next.height = (next.width * bounds.height) / bounds.width;
                  if (proportional && key === "height")
                    next.width = (next.height * bounds.width) / bounds.height;
                  return next;
                })
              }
            />
          </label>
        ))}
      </div>
      <div className="transform-footer">
        <label>
          Rotate by{" "}
          <input
            aria-label="Object rotation"
            type="number"
            min="-360"
            max="360"
            value={values.degrees}
            onChange={(e) =>
              setValues((v) => ({ ...v, degrees: Number(e.target.value) }))
            }
          />
          °
        </label>
        <button className="secondary" type="submit">
          Apply
        </button>
      </div>
    </form>
  );
}
export function useVisible(margin = "300px") {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: margin },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [margin]);
  return { ref, visible };
}

export type PaletteAction = {
  shortcut?: string;
  name: string;
  group: string;
  icon: typeof Search;
  needs?: boolean;
  run: () => unknown;
};
export function CommandPalette({
  onBrowse,
  actions,
  hasDocument,
  onClose,
}: {
  onBrowse?: () => void;
  actions: PaletteAction[];
  hasDocument: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const groupOrder = [
    "File",
    "Edit",
    "Pages",
    "Annotate",
    "Forms",
    "Sign",
    "Review",
    "Convert",
    "Optimize",
    "Workspace",
    "View",
    "Create",
    "Protect",
    "Advanced",
  ];
  const filtered = [...actions]
    .sort((a, b) => groupOrder.indexOf(a.group) - groupOrder.indexOf(b.group))
    .filter((a) => toolSearch(a.name, a.group, query.replace(/^>\s*/, "")));
  const enabled = filtered.filter((a) => !a.needs || hasDocument);
  const chosen = enabled[index];
  useEffect(() => {
    ref.current?.showModal();
    input.current?.focus();
    const el = ref.current;
    return () => el?.close();
  }, []);
  useEffect(() => {
    document
      .getElementById(`command-${index}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [index]);
  function execute(a: PaletteAction) {
    onClose();
    void a.run();
  }
  return (
    <dialog
      ref={ref}
      className="command-palette"
      aria-label="Commands"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          setIndex((i) =>
            Math.max(
              0,
              Math.min(
                enabled.length - 1,
                i + (e.key === "ArrowDown" ? 1 : -1),
              ),
            ),
          );
        }
        if (e.key === "Enter" && chosen) {
          e.preventDefault();
          execute(chosen);
        }
      }}
    >
      <div className="palette-search">
        <Search size={16} />
        <input
          ref={input}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
          aria-label="Search tools"
          role="combobox"
          aria-expanded="true"
          aria-controls="commands"
          aria-activedescendant={chosen ? `command-${index}` : undefined}
          placeholder="Search commands and tools…"
        />
        <kbd>Esc</kbd>
      </div>
      <div
        className="palette-list"
        id="commands"
        role="listbox"
        aria-label="Available commands"
      >
        {filtered.length === 0 ? (
          <p className="palette-empty">No commands match “{query}”.</p>
        ) : (
          filtered.map((a, rowIndex) => {
            const i = enabled.indexOf(a);
            return (
              <div key={a.name} role="presentation">
                {(rowIndex === 0 ||
                  filtered[rowIndex - 1].group !== a.group) && (
                  <div className="palette-group">{a.group}</div>
                )}
                <button
                  id={i >= 0 ? `command-${i}` : undefined}
                  role="option"
                  aria-selected={chosen === a}
                  className={chosen === a ? "chosen" : ""}
                  disabled={a.needs && !hasDocument}
                  onMouseMove={() => {
                    if (i >= 0) setIndex(i);
                  }}
                  onClick={() => execute(a)}
                >
                  <a.icon size={15} />
                  <span>{a.name}</span>
                  <small>
                    {a.needs && !hasDocument ? "Open a PDF" : a.group}
                  </small>
                  {(a.shortcut ||
                    (
                      {
                        "New document": "Ctrl N",
                        "Open PDF": "Ctrl O",
                        Save: "Ctrl S",
                        "Save as": "Ctrl Shift S",
                        Settings: "Ctrl ,",
                      } as Record<string, string>
                    )[a.name]) && (
                    <kbd className="palette-shortcut">
                      {a.shortcut ||
                        (
                          {
                            "New document": "Ctrl N",
                            "Open PDF": "Ctrl O",
                            Save: "Ctrl S",
                            "Save as": "Ctrl Shift S",
                            Settings: "Ctrl ,",
                          } as Record<string, string>
                        )[a.name]}
                    </kbd>
                  )}
                  {chosen === a && <span className="enter-key">↵</span>}
                </button>
              </div>
            );
          })
        )}
      </div>
      <footer className="palette-footer">
        <span>
          ↑ ↓ Navigate <span>↵ Run command</span>
        </span>
        {onBrowse && <button onClick={onBrowse}>Browse all tools →</button>}
      </footer>
    </dialog>
  );
}

export function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: { label: string; run: () => void; disabled?: boolean }[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current
      ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
      ?.focus();
    const dismiss = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener("pointerdown", dismiss);
    return () => {
      window.removeEventListener("pointerdown", dismiss);
      previous?.focus();
    };
  }, []);
  return createPortal(
    <div
      ref={ref}
      role="menu"
      className="context-menu"
      style={{
        left: Math.min(x, innerWidth - 218),
        top: Math.min(y, innerHeight - items.length * 29 - 16),
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          const buttons = Array.from(
            ref.current!.querySelectorAll<HTMLButtonElement>(
              "button:not(:disabled)",
            ),
          );
          const i = buttons.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          buttons[
            (i + (e.key === "ArrowDown" ? 1 : buttons.length - 1)) %
              buttons.length
          ]?.focus();
        }
      }}
    >
      {items.map((item) => (
        <button
          role="menuitem"
          key={item.label}
          disabled={item.disabled}
          onClick={() => {
            onClose();
            item.run();
          }}
        >
          {item.label}
          <ArrowUpRight size={12} />
        </button>
      ))}
    </div>,
    document.body,
  );
}
