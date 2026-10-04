import { FontPicker } from "./fonts";
import { useState, useEffect } from "react";
import { Dialog, Field, Select } from "./components";
import { Search, Plus, Copy } from "./icons";
import { templates, type Template, type TemplateConfig } from "./templates";

export function TemplatePreview({ template: t }: { template: Template }) {
  return (
    <svg
      viewBox={`0 0 ${t.width} ${t.height}`}
      className="template-paper"
      aria-hidden="true"
    >
      <rect width={t.width} height={t.height} fill="#f8fbff" />
      {t.pages[0].map((el, i) =>
        el.type === "text" ? (
          <text
            key={i}
            x={el.x}
            y={el.y + (el.size ?? 12)}
            fontSize={el.size ?? 12}
            fill="#283348"
            fontFamily={el.font ?? t.font}
          >
            {el.text?.split("\n")[0]}
          </text>
        ) : el.type === "rule" ? (
          <path key={i} d={`M${el.x} ${el.y}h${el.width}`} stroke="#91a1b8" />
        ) : (
          <rect
            key={i}
            x={el.x}
            y={el.y}
            width={el.width}
            height={el.height ?? 32}
            fill="#eaf0f8"
            stroke={el.type === "panel" ? "none" : "#bdcadc"}
          />
        ),
      )}
    </svg>
  );
}
export function NewDocument({
  onClose,
  onCreate,
  initialQuery = "",
}: {
  onClose: () => void;
  onCreate: (t: Template, c: TemplateConfig) => Promise<void>;
  initialQuery?: string;
}) {
  const [category, setCategory] = useState("All presets"),
    [query, setQuery] = useState(initialQuery);
  const [custom, setCustom] = useState<Template[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("papier-custom-presets") ?? "[]");
    } catch {
      return [];
    }
  });
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(
        localStorage.getItem("papier-favorite-presets") ?? "[]",
      );
    } catch {
      return [];
    }
  });
  const [selected, setSelected] = useState(templates[0]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [name, setName] = useState("Untitled"),
    [width, setWidth] = useState(210),
    [height, setHeight] = useState(297),
    [pages, setPages] = useState(1),
    [font, setFont] = useState("Helvetica"),
    [size, setSize] = useState(12),
    [margin, setMargin] = useState(20),
    [leading, setLeading] = useState(1.4);
  function choose(t: Template) {
    setSelected(t);
    setName(t.category === "Blank" ? "Untitled" : t.name);
    setWidth(Math.round(t.width / 2.83464567));
    setHeight(Math.round(t.height / 2.83464567));
    setPages(t.pages.length);
    setFont(t.font);
    setSize(t.size);
    setMargin(Math.round(t.margins[3] / 2.83464567));
    setLeading(t.leading);
  }
  const all = [...templates, ...custom];
  useEffect(() => {
    const t = all.find((t) => t.name === initialQuery);
    if (t) choose(t);
  }, []);
  const visible = all.filter(
    (t) =>
      (category === "All presets" ||
        (category === "Recent" &&
          (
            JSON.parse(
              localStorage.getItem("papier-recent-presets") ?? "[]",
            ) as string[]
          ).includes(t.id)) ||
        (category === "Favorites" && favorites.includes(t.id)) ||
        t.category === category) &&
      t.name.toLowerCase().includes(query.toLowerCase()),
  );
  function favorite() {
    const next = favorites.includes(selected.id)
      ? favorites.filter((v) => v !== selected.id)
      : [...favorites, selected.id];
    setFavorites(next);
    localStorage.setItem("papier-favorite-presets", JSON.stringify(next));
  }
  function duplicate() {
    const t = {
      ...selected,
      id: crypto.randomUUID(),
      name: name || `${selected.name} copy`,
      category: "Custom",
      width: width * 2.83464567,
      height: height * 2.83464567,
      font,
      size,
      leading,
      margins: [margin, margin, margin, margin].map((v) => v * 2.83464567) as [
        number,
        number,
        number,
        number,
      ],
    };
    const next = [...custom, t];
    setCustom(next);
    localStorage.setItem("papier-custom-presets", JSON.stringify(next));
    setCategory("Custom");
    choose(t);
  }
  return (
    <Dialog title="New document" dismissible={!busy} onClose={onClose} wide>
      <form
        className="new-document"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const used = JSON.parse(
              localStorage.getItem("papier-recent-presets") ?? "[]",
            ) as string[];
            localStorage.setItem(
              "papier-recent-presets",
              JSON.stringify(
                [selected.id, ...used.filter((v) => v !== selected.id)].slice(
                  0,
                  8,
                ),
              ),
            );
            await onCreate(selected, {
              name: `${name.replace(/\.pdf$/i, "") || "Untitled"}.pdf`,
              width: width * 2.83464567,
              height: height * 2.83464567,
              pages: Math.max(pages, selected.pages.length),
              font,
              size,
              margin: margin * 2.83464567,
              leading,
            });
            onClose();
          } catch (e) {
            setError(String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="new-document-body">
          <nav className="template-categories" aria-label="Template categories">
            {[
              "All presets",
              "Recent",
              "Favorites",
              "Blank",
              "Academic",
              "Business",
              "Forms",
              "Print",
              "Personal",
              "Custom",
            ].map((v) => (
              <button
                key={v}
                type="button"
                className={category === v ? "chosen" : ""}
                onClick={() => setCategory(v)}
              >
                {v}
              </button>
            ))}
          </nav>
          <div className="template-browser">
            <label className="recent-search">
              <Search size={13} />
              <input
                aria-label="Search templates"
                placeholder="Search all presets…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <div className="template-grid">
              {visible.map((t) => (
                <button
                  type="button"
                  className={`template-tile ${selected.id === t.id ? "selected" : ""}`}
                  key={t.id}
                  onClick={() => choose(t)}
                >
                  <div>
                    <TemplatePreview template={t} />
                  </div>
                  <strong>{t.name}</strong>
                  <small>
                    {Math.round(t.width / 2.83464567)} ×{" "}
                    {Math.round(t.height / 2.83464567)} mm
                    {favorites.includes(t.id) ? " · ★" : ""}
                  </small>
                </button>
              ))}
            </div>
            {!visible.length && (
              <p className="template-empty">
                {category === "Custom"
                  ? "Save a preset using the configuration panel."
                  : "No matching presets."}
              </p>
            )}
          </div>
          <aside className="template-config">
            <Field label="Name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={100}
              />
            </Field>
            <div className="property-grid">
              <Field label="Width · mm">
                <input
                  type="number"
                  min="26"
                  max="2000"
                  value={width}
                  onChange={(e) => setWidth(+e.target.value)}
                />
              </Field>
              <Field label="Height · mm">
                <input
                  type="number"
                  min="26"
                  max="2000"
                  value={height}
                  onChange={(e) => setHeight(+e.target.value)}
                />
              </Field>
            </div>
            <div className="property-grid">
              <Field label="Pages">
                <input
                  type="number"
                  min={selected.pages.length}
                  max="200"
                  value={pages}
                  onChange={(e) => setPages(+e.target.value)}
                />
              </Field>
              <Field label="Orientation">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setWidth(height);
                    setHeight(width);
                  }}
                >
                  {width > height ? "Landscape" : "Portrait"}
                </button>
              </Field>
            </div>
            <div className="config-separator" />
            <Field label="Font">
              <FontPicker
                original={false}
                label="Document font"
                value={font}
                onChange={setFont}
              />
            </Field>
            <div className="property-grid">
              <Field label="Size · pt">
                <input
                  type="number"
                  min="6"
                  max="36"
                  value={size}
                  onChange={(e) => setSize(+e.target.value)}
                />
              </Field>
              <Field label="Leading">
                <input
                  type="number"
                  min="1"
                  max="3"
                  step=".1"
                  value={leading}
                  onChange={(e) => setLeading(+e.target.value)}
                />
              </Field>
            </div>
            <Field
              label={
                selected.id === "abnt" ? "Left margin · mm" : "Margin · mm"
              }
            >
              <input
                type="number"
                min="0"
                max="60"
                value={margin}
                onChange={(e) => setMargin(+e.target.value)}
              />
            </Field>
            {selected.note && <p className="preset-note">{selected.note}</p>}
            <div className="config-separator" />
            <div className="preset-actions">
              <button type="button" onClick={favorite}>
                {favorites.includes(selected.id) ? "★ Favorited" : "☆ Favorite"}
              </button>
              <button type="button" onClick={duplicate}>
                <Copy size={12} />
                Save preset
              </button>
            </div>
            <p className="preset-summary">
              {width} × {height} mm
              <small>
                {Math.max(pages, selected.pages.length)}{" "}
                {pages === 1 ? "page" : "pages"} · Editable PDF
              </small>
            </p>
          </aside>
        </div>
        {error && (
          <p role="alert" className="new-document-error">
            {error}
          </p>
        )}
        <footer>
          <button
            type="button"
            className="secondary"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <span>Local by design.</span>
          <button className="primary" disabled={busy}>
            <Plus size={14} />
            {busy ? "Creating…" : "Create"}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}
