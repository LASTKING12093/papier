import { useEffect, useState } from "react";
import { api } from "./api";
import type { Session, PdfObject } from "../../../packages/editor-state/types";
import { Type, ImagePlus, PenLine, Search } from "./icons";
export function PageContents({
  doc,
  page,
  selected,
  onSelect,
}: {
  doc: Session;
  page: number;
  selected: PdfObject | null;
  onSelect: (p: number, o: PdfObject) => void;
}) {
  const [objects, setObjects] = useState<PdfObject[]>([]),
    [query, setQuery] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    void api<PdfObject[]>("inspect", doc.id, { page })
      .then((v) => {
        if (live) setObjects(v);
      })
      .catch((e) => {
        if (live) setError(String(e));
      });
    return () => {
      live = false;
    };
  }, [doc.id, doc.revision, page]);
  return (
    <div className="contents-panel">
      <label>
        <Search size={13} />
        <input
          aria-label="Search page contents"
          placeholder="Text, images, marks…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <small>
        Page {page + 1} · {objects.length} objects
      </small>
      <div>
        {objects
          .filter((o) =>
            (o.text ?? o.kind).toLowerCase().includes(query.toLowerCase()),
          )
          .map((o) => {
            const Icon =
              o.kind === "text"
                ? Type
                : o.kind === "image"
                  ? ImagePlus
                  : PenLine;
            return (
              <button
                key={o.index}
                aria-pressed={selected?.index === o.index}
                onClick={() => onSelect(page, o)}
              >
                <Icon size={14} />
                <span>
                  {o.text || `${o.kind} ${o.index + 1}`}
                  <small>
                    {Math.round(o.bounds.width)} × {Math.round(o.bounds.height)}{" "}
                    pt
                  </small>
                </span>
              </button>
            );
          })}
      </div>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
