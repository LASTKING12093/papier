import { useEffect, useState } from "react";
import { Dialog, Field } from "./components";
import { FontPicker } from "./fonts";
import { api } from "./api";
import type { Session, PdfObject } from "../../../packages/editor-state/types";
export function FindReplace({
  doc,
  onClose,
  onUpdate,
}: {
  doc: Session;
  onClose: () => void;
  onUpdate: (s: Session) => void;
}) {
  const [items, setItems] = useState<{ page: number; object: PdfObject }[]>([]),
    [progress, setProgress] = useState(0),
    [find, setFind] = useState(""),
    [replacement, setReplacement] = useState(""),
    [sensitive, setSensitive] = useState(false),
    [font, setFont] = useState("Keep original font"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [excluded, setExcluded] = useState<string[]>([]);
  useEffect(() => {
    let live = true;
    void (async () => {
      const result: typeof items = [];
      try {
        for (let p = 0; p < doc.info.pages.length; p++) {
          const values = await api<PdfObject[]>("inspect", doc.id, { page: p });
          if (!live) return;
          result.push(
            ...values
              .filter((o) => o.kind === "text" && o.text)
              .map((object) => ({ page: p, object })),
          );
          setProgress(p + 1);
        }
        setItems(result);
      } catch (e) {
        if (live) setError(String(e));
      }
    })();
    return () => {
      live = false;
    };
  }, [doc.id, doc.revision]);
  const regex = find
    ? new RegExp(
        find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        sensitive ? "g" : "gi",
      )
    : null;
  const rows = items
    .map((item) => ({
      ...item,
      key: `${item.page}-${item.object.index}`,
      next: regex
        ? item.object.text!.replace(regex, () => replacement)
        : item.object.text,
    }))
    .filter((r) => find && r.next !== r.object.text);
  const chosen = rows
    .filter((r) => !excluded.includes(r.key))
    .sort((a, b) => b.page - a.page || b.object.index - a.object.index);
  async function apply() {
    setBusy(true);
    setError("");
    try {
      const next = await api<Session>("edit_batch", doc.id, {
        revision: doc.revision,
        label: "Find & replace text",
        commands: chosen.map((r) => ({
          kind: "edit_text",
          page: r.page,
          object: r.object.index,
          text: r.next,
          font: font === "Keep original font" ? null : font,
          size: r.object.size ?? 12,
          color: r.object.color,
        })),
      });
      onUpdate(next);
      onClose();
    } catch (e) {
      setError(
        `${String(e)} No replacements were committed. If the original font cannot encode the replacement, choose a replacement font.`,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title="Find & replace text"
      wide
      onClose={onClose}
      dismissible={!busy}
    >
      <div className="replace-workspace">
        <div className="replace-inputs">
          <Field label="Find">
            <input
              autoFocus
              aria-label="Find text"
              value={find}
              onChange={(e) => {
                setFind(e.target.value);
                setExcluded([]);
              }}
            />
          </Field>
          <Field label="Replace with">
            <input
              aria-label="Replacement text"
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
            />
          </Field>
        </div>
        <div className="replace-options">
          <label>
            <input
              type="checkbox"
              checked={sensitive}
              onChange={(e) => setSensitive(e.target.checked)}
            />{" "}
            Match case
          </label>
          <FontPicker
            label="Replacement font"
            value={font}
            onChange={setFont}
          />
        </div>
        <p className="muted">
          {progress < doc.info.pages.length
            ? `Reading page ${progress + 1}…`
            : `${chosen.length} text objects selected. Review the changes before applying.`}
        </p>
        <div className="replace-results">
          {rows.slice(0, 1000).map((r) => (
            <label key={r.key}>
              <input
                type="checkbox"
                checked={!excluded.includes(r.key)}
                onChange={() =>
                  setExcluded((old) =>
                    old.includes(r.key)
                      ? old.filter((k) => k !== r.key)
                      : [...old, r.key],
                  )
                }
              />
              <span>
                <small>Page {r.page + 1}</small>
                <del>{r.object.text}</del>
                <ins>{r.next || "(empty text)"}</ins>
              </span>
            </label>
          ))}
          {!rows.length && (
            <p>
              {find
                ? "No changes match this search."
                : "Find a word or phrase in editable text. Scanned images need OCR first."}
            </p>
          )}
        </div>
        {error && <p role="alert">{error}</p>}
      </div>
      <footer>
        <span className="muted">
          One undo step · Changes stay in the working document
        </span>
        <button className="secondary" disabled={busy} onClick={onClose}>
          Cancel
        </button>
        <button
          className="primary"
          disabled={
            busy ||
            progress < doc.info.pages.length ||
            !chosen.length ||
            chosen.length > 1000
          }
          onClick={() => void apply()}
        >
          {busy ? "Replacing…" : `Replace ${chosen.length} objects`}
        </button>
      </footer>
    </Dialog>
  );
}
