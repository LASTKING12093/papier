import { useEffect, useState } from "react";
import { Dialog } from "./components";
import { api } from "./api";
import type { Session, PdfObject } from "../../../packages/editor-state/types";
type Usage = {
  family: string;
  count: number;
  pages: number[];
  first: { page: number; object: PdfObject };
};
export function DocumentInspector({
  doc,
  onClose,
  onLocate,
}: {
  doc: Session;
  onClose: () => void;
  onLocate: (page: number, object: PdfObject) => void;
}) {
  const [fonts, setFonts] = useState<Usage[]>([]),
    [counts, setCounts] = useState<Record<string, number>>({}),
    [progress, setProgress] = useState(0),
    [error, setError] = useState(""),
    [query, setQuery] = useState("");
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const inventory = new Map<string, Usage>(),
        totals: Record<string, number> = {};
      try {
        for (let page = 0; page < doc.info.pages.length; page++) {
          if (cancelled) return;
          const objects = await api<PdfObject[]>("inspect", doc.id, { page });
          if (cancelled) return;
          for (const o of objects) {
            totals[o.kind] = (totals[o.kind] ?? 0) + 1;
            if (o.font) {
              const f = inventory.get(o.font) ?? {
                family: o.font,
                count: 0,
                pages: [],
                first: { page, object: o },
              };
              f.count++;
              if (!f.pages.includes(page)) f.pages.push(page);
              inventory.set(o.font, f);
            }
          }
          setFonts([...inventory.values()].sort((a, b) => b.count - a.count));
          setCounts({ ...totals });
          setProgress(page + 1);
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doc.id, doc.revision]);
  return (
    <Dialog title="Document inspection" onClose={onClose} wide>
      <div className="document-inspection oled-atmosphere">
        <div className="inspection-summary">
          <div>
            <span>DOCUMENT</span>
            <strong>{doc.name}</strong>
            <small>
              {doc.info.pages.length} pages · PDF {doc.info.metadata.version}
            </small>
          </div>
          <dl>
            {[
              ["Text", counts.text ?? 0],
              ["Images", counts.image ?? 0],
              ["Paths", counts.path ?? 0],
              ["Fields", doc.info.metadata.fields.length],
            ].map(([name, n]) => (
              <div key={name}>
                <dt>{name}</dt>
                <dd>{n}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="inspection-heading">
          <h3>Fonts in this document</h3>
          <input
            aria-label="Search document fonts"
            placeholder="Filter fonts…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <p className="small muted">
          Locate an object to edit it or explicitly replace its font. Embedded
          subsets may contain only the glyphs already used.
        </p>
        <div className="font-inventory">
          {fonts
            .filter((f) => f.family.toLowerCase().includes(query.toLowerCase()))
            .map((f) => (
              <button
                key={f.family}
                onClick={() => {
                  onLocate(f.first.page, f.first.object);
                  onClose();
                }}
              >
                <span>
                  <strong>{f.family}</strong>
                  <small>
                    Pages{" "}
                    {f.pages
                      .map((n) => n + 1)
                      .slice(0, 15)
                      .join(", ")}
                    {f.pages.length > 15 ? "…" : ""}
                  </small>
                </span>
                <span>{f.count} objects</span>
                <small>Locate ↗</small>
              </button>
            ))}
        </div>
        {error && <p role="alert">{error}</p>}
        <p className="small muted">
          {progress < doc.info.pages.length
            ? `Inspecting page ${progress + 1} of ${doc.info.pages.length}…`
            : `${fonts.length} font families · Inspection complete`}{" "}
          · Top-level page objects; nested forms may contain additional content.
        </p>
      </div>
      <footer>
        <span className="muted">Read-only · Local analysis</span>
        <button className="secondary" onClick={onClose}>
          Done
        </button>
      </footer>
    </Dialog>
  );
}
