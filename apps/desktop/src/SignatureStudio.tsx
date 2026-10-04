import { getPreferences } from "./preferences";
import { polygonPath } from "./signature-calligraphy";
import { signatureCollection } from "./signature-collection";
import {
  reconstructInk,
  type InkMode,
} from "../../../packages/editor-state/ink";
import { useMemo, useRef, useState, type CSSProperties } from "react";
import { Dialog, Field, Select } from "./components";
import {
  curve,
  normalize,
  styles,
  type Signature,
  type Stroke,
} from "./signature-vectors";
import { PenLine, ImagePlus, Trash2, RotateCw, Check } from "./icons";
import { pickFile, fileData, download } from "./api";

export function SignaturePreview({ value }: { value: Signature }) {
  if (value.filled)
    return (
      <svg
        className="signature-vector signature-outline"
        viewBox={`0 0 ${value.width} ${value.height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <path
          d={polygonPath(value.paths)}
          fill={value.color ?? "currentColor"}
          stroke={value.color ?? "currentColor"}
          strokeWidth={value.stroke * 0.12}
          fillRule="nonzero"
        />
      </svg>
    );
  return (
    <svg
      className="signature-vector"
      viewBox={`0 0 ${value.width} ${value.height}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {value.paths.map((p, i) => (
        <path
          key={i}
          pathLength={1}
          style={
            {
              "--path-length": 1,
              "--stroke-delay": `${i * 12}ms`,
            } as CSSProperties
          }
          d={curve(p)}
          fill="none"
          stroke={value.color ?? "currentColor"}
          strokeWidth={value.stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
export function SignatureStudio({
  onClose,
  onPlace,
  onImage,
  initialMode = "Type",
}: {
  onClose: () => void;
  onPlace: (s: Signature) => Promise<void>;
  onImage: (data: string) => Promise<void>;
  initialMode?: string;
}) {
  const [ink, setInk] = useState(getPreferences().signatureColor),
    [placementWidth, setPlacementWidth] = useState(
      getPreferences().signatureWidth,
    );
  const [mode, setMode] = useState(initialMode),
    [name, setName] = useState(""),
    [style, setStyle] = useState("Explore styles"),
    [seed] = useState(
      () => crypto.getRandomValues(new Uint32Array(1))[0],
    ),
    [choice, setChoice] = useState(0);
  const [batch, setBatch] = useState(0);
  const [showChoices, setShowChoices] = useState(false);
  const [customize, setCustomize] = useState(false);
  const [slant, setSlant] = useState(0.22),
    [flourish, setFlourish] = useState(0.5),
    [compact, setCompact] = useState(1),
    [stroke, setStroke] = useState(1.2);
  const [library, setLibrary] = useState<Signature[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("papier-signatures") ?? "[]");
    } catch {
      return [];
    }
  });
  const [picked, setPicked] = useState<Signature | null>(null),
    [paths, setPaths] = useState<Stroke[]>([]),
    [drawing, setDrawing] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [image, setImage] = useState("");
  const surface = useRef<SVGSVGElement>(null);
  const [inkMode, setInkMode] = useState<InkMode>("Smooth"),
    [strength, setStrength] = useState(0.65);
  const [original, setOriginal] = useState(false),
    [composition, setComposition] = useState("Full name");
  const signingName =
    composition === "Initial + surname"
      ? name
          .trim()
          .split(/\s+/)
          .map((w, i) => (i === 0 ? w[0] : w))
          .join(" ")
      : composition === "Initials"
        ? name
            .trim()
            .split(/\s+/)
            .map((w) => w[0])
            .join(" ")
        : name;
  const reconstructed = useMemo(
    () => paths.map((p) => reconstructInk(p, inkMode, strength)),
    [paths, inkMode, strength],
  );
  const candidates = useMemo(
    () =>
      signatureCollection(signingName, batch, seed, {
        style,
        rubric: mode === "Rubric",
        slant,
        flourish,
        compact,
        stroke,
      }),
    [signingName, batch, seed, style, mode, slant, flourish, compact, stroke],
  );
  const drawn: Signature = {
    id: "drawn",
    name:
      name || (initialMode === "Draw" ? "Refined drawing" : "Drawn signature"),
    style: "Draw",
    ...normalize(reconstructed.map((r) => r.points)),
    stroke,
  };
  const current =
    mode === "Library"
      ? picked
        ? { ...picked, stroke }
        : null
      : mode === "Draw"
        ? drawn
        : candidates[choice];
  function point(e: React.PointerEvent) {
    const matrix = surface.current!.getScreenCTM();
    if (!matrix) return [0, 0];
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(
      matrix.inverse(),
    );
    return [Math.max(0, Math.min(600, p.x)), Math.max(0, Math.min(200, p.y))];
  }
  async function place() {
    setBusy(true);
    try {
      if (mode === "Import") await onImage(image);
      else if (current?.paths.length)
        await onPlace({ ...current, color: ink, placementWidth });
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  function save() {
    if (!current?.paths.length) return;
    const value = {
      ...current,
      color: ink,
      placementWidth,
      id: crypto.randomUUID(),
    };
    const next = [value, ...library].slice(0, 40);
    localStorage.setItem("papier-signatures", JSON.stringify(next));
    setLibrary(next);
    setPicked(value);
    setMode("Library");
  }
  return (
    <Dialog
      title={initialMode === "Draw" ? "Ink Studio" : "Signature Studio"}
      dismissible={!busy}
      onClose={onClose}
      wide
    >
      <div
        className="signature-studio"
        data-mode={mode}
        data-choices={showChoices}
        data-customize={customize || mode === "Draw"}
      >
        <nav className="studio-tabs" aria-label="Signature modes">
          {["Draw", "Type", "Import", "Rubric", "Library"].map((v) => (
            <button
              key={v}
              className={mode === v ? "active" : ""}
              onClick={() => {
                setMode(v);
                setChoice(0);
              }}
            >
              {v}
            </button>
          ))}
        </nav>
        <div className="signature-layout">
          <div className="signature-workspace">
            {["Type", "Rubric"].includes(mode) && (
              <>
                <label className="signature-name">
                  <span>
                    {mode === "Rubric" ? "Name or initials" : "Your name"}
                  </span>
                  <input
                    autoFocus
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                {!name.trim() && (
                  <p className="signature-empty-guide">
                    Type your name. Then find a mark that feels like you.
                  </p>
                )}
                <div
                  className="signature-live"
                  key={`preview-${seed}-${batch}-${style}-${mode}-${choice}`}
                >
                  <SignaturePreview
                    value={{ ...candidates[choice], color: ink }}
                  />
                  <span>
                    {mode === "Rubric"
                      ? "YOUR PERSONAL MARK"
                      : "LIVE SIGNATURE"}
                  </span>
                </div>
                <div className="signature-explore">
                  <button
                    aria-expanded={showChoices}
                    onClick={() => setShowChoices(!showChoices)}
                  >
                    {showChoices ? "Hide styles" : "Explore 8 styles"}
                  </button>
                  <span>{candidates[choice].recipe}</span>
                </div>
                <div className="signature-candidates">
                  {candidates.map((v, i) => (
                    <button
                      key={`${seed}-${batch}-${mode}-${i}`}
                      className={choice === i ? "selected" : ""}
                      onClick={() => setChoice(i)}
                    >
                      <SignaturePreview value={{ ...v, color: ink }} />
                      <span>
                        {v.style} {String(i + 1).padStart(2, "0")}
                        <small>{v.recipe}</small>
                      </span>
                      {choice === i && <Check size={12} />}
                    </button>
                  ))}
                </div>
                <div className="signature-batch-bar">
                  <button
                    disabled={batch === 0}
                    onClick={() => {
                      setBatch(batch - 1);
                      setChoice(0);
                    }}
                  >
                    ← Previous
                  </button>
                  <span>Collection {batch + 1}</span>
                  <button
                    className="primary"
                    disabled={!name.trim()}
                    onClick={() => {
                      setBatch(batch + 1);
                      setChoice(0);
                    }}
                  >
                    <RotateCw size={13} />
                    Generate variations
                  </button>
                </div>
              </>
            )}
            {mode === "Draw" && (
              <>
                <div className="signature-draw">
                  <svg
                    ref={surface}
                    viewBox="0 0 600 200"
                    onPointerDown={(e) => {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      setDrawing(true);
                      setPaths((old) => [...old, [point(e)]]);
                    }}
                    onPointerMove={(e) => {
                      if (drawing) {
                        const p = point(e);
                        setPaths((old) => [
                          ...old.slice(0, -1),
                          [...old.at(-1)!, p],
                        ]);
                      }
                    }}
                    onPointerUp={() => setDrawing(false)}
                    onPointerCancel={() => setDrawing(false)}
                  >
                    <path
                      d="M24 155h552"
                      stroke={ink}
                      opacity=".13"
                      strokeDasharray="3 4"
                    />
                    {paths.map((p, i) => (
                      <path
                        key={i}
                        d={curve(p)}
                        fill="none"
                        stroke={ink}
                        strokeWidth={stroke}
                        strokeLinecap="round"
                      />
                    ))}
                  </svg>
                  {!paths.length && (
                    <span>
                      {initialMode === "Draw"
                        ? "Draw a mark, a shape or a gesture"
                        : "Sign here"}
                    </span>
                  )}
                </div>
                <div className="draw-actions">
                  <button
                    className="text-button"
                    onClick={() => setPaths(paths.slice(0, -1))}
                  >
                    Undo stroke
                  </button>
                  <button className="text-button" onClick={() => setPaths([])}>
                    <Trash2 size={13} />
                    Clear
                  </button>
                </div>
                <div className="ink-reconstruction">
                  <header>
                    <span>
                      {original ? "Original strokes" : "Reconstructed preview"}
                    </span>
                    <button
                      aria-pressed={original}
                      onClick={() => setOriginal(!original)}
                    >
                      {original ? "Show refined" : "Compare original"}
                    </button>
                  </header>
                  <SignaturePreview
                    value={{
                      ...drawn,
                      ...(original ? normalize(paths) : {}),
                      color: ink,
                    }}
                  />
                  <small>
                    {paths.length
                      ? [...new Set(reconstructed.map((r) => r.kind))].join(
                          " · ",
                        )
                      : "Draw above. Papier steadies the strokes while keeping your gesture."}
                  </small>
                </div>
              </>
            )}
            {mode === "Import" && (
              <div className="signature-import">
                {image ? (
                  <img
                    src={`data:image/png;base64,${image}`}
                    alt="Imported signature"
                  />
                ) : (
                  <ImagePlus size={28} />
                )}
                <button
                  className="secondary"
                  onClick={async () => {
                    const f = await pickFile("image/png,image/jpeg,image/webp");
                    if (f) setImage(await fileData(f));
                  }}
                >
                  Choose signature image…
                </button>
                <p>PNG with a transparent background works best.</p>
              </div>
            )}
            {mode === "Library" && (
              <div className="signature-candidates">
                {library.map((v) => (
                  <button
                    key={v.id}
                    className={picked?.id === v.id ? "selected" : ""}
                    onClick={() => {
                      setPicked(v);
                      setStroke(v.stroke);
                      setInk(v.color ?? getPreferences().signatureColor);
                      setPlacementWidth(
                        v.placementWidth ?? getPreferences().signatureWidth,
                      );
                    }}
                  >
                    <SignaturePreview value={{ ...v, color: ink }} />
                    <span>{v.name || v.style}</span>
                  </button>
                ))}
                {!library.length && (
                  <p className="muted">No saved signatures.</p>
                )}
              </div>
            )}
          </div>
          <aside className="signature-properties">
            <h3>{mode === "Rubric" ? "Refine rubric" : "Appearance"}</h3>
            {mode !== "Import" && (
              <>
                <Field label="Ink">
                  <input
                    type="color"
                    aria-label="Signature ink"
                    value={ink}
                    onChange={(e) => setInk(e.target.value)}
                  />
                </Field>
                <Field label="Placement width · pt">
                  <input
                    type="number"
                    aria-label="Signature placement width"
                    min="60"
                    max="500"
                    value={placementWidth}
                    onChange={(e) =>
                      setPlacementWidth(
                        Math.max(60, Math.min(500, +e.target.value)),
                      )
                    }
                  />
                </Field>
              </>
            )}
            {mode === "Type" && (
              <Field label="Style">
                <Select
                  value={style}
                  onChange={setStyle}
                  label="Signature style"
                  options={[
                    "Explore styles",
                    ...styles.filter((s) => s !== "Rubric"),
                  ]}
                />
              </Field>
            )}
            {mode === "Type" && (
              <Field label="Composition">
                <Select
                  label="Signature composition"
                  value={composition}
                  options={["Full name", "Initial + surname", "Initials"]}
                  onChange={setComposition}
                />
              </Field>
            )}
            {mode === "Draw" && (
              <>
                <Field label="Reconstruction">
                  <Select
                    label="Ink reconstruction"
                    value={inkMode}
                    options={["Original", "Smooth", "Smart shapes"]}
                    onChange={(v) => setInkMode(v as InkMode)}
                  />
                </Field>
                <Field label="Stabilization">
                  <input
                    aria-label="Ink stabilization"
                    type="range"
                    min="0"
                    max="1"
                    step=".05"
                    value={strength}
                    onChange={(e) => setStrength(+e.target.value)}
                  />
                </Field>
                <p className="signature-note">
                  Smooth preserves handwriting. Smart shapes also straightens
                  lines and rebuilds rectangles and ellipses. Compare before
                  placing.
                </p>
              </>
            )}
            {mode !== "Import" && (
              <Field label="Stroke · pt">
                <input
                  type="number"
                  min=".4"
                  max="5"
                  step=".1"
                  value={stroke}
                  onChange={(e) => setStroke(+e.target.value)}
                />
              </Field>
            )}
            {["Type", "Rubric"].includes(mode) && (
              <>
                {[
                  ["Slant", slant, -0.1, 0.7, setSlant],
                  ["Flourish", flourish, 0, 1, setFlourish],
                  ["Width", compact, 0.55, 1.4, setCompact],
                ].map(([label, value, min, max, set]) => (
                  <Field key={String(label)} label={String(label)}>
                    <input
                      type="range"
                      min={Number(min)}
                      max={Number(max)}
                      step=".01"
                      value={Number(value)}
                      onChange={(e) =>
                        (set as (v: number) => void)(+e.target.value)
                      }
                    />
                  </Field>
                ))}
              </>
            )}
            <p className="signature-note">
              An electronic signature is a visual mark. Use certificate signing
              to create a cryptographic digital signature.
            </p>
            {mode !== "Import" ? (
              <>
                <button
                  className="secondary"
                  disabled={!current?.paths.length}
                  onClick={save}
                >
                  Save to library
                </button>
                <button
                  className="secondary"
                  disabled={!current?.paths.length}
                  onClick={() => {
                    if (!current?.paths.length) return;
                    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${current.width} ${current.height}">${current.filled ? `<path d="${polygonPath(current.paths)}" fill="${ink}" stroke="${ink}" stroke-width="${current.stroke * 0.12}" fill-rule="nonzero"/>` : current.paths.map((p) => `<path d="${curve(p)}" fill="none" stroke="${ink}" stroke-width="${current.stroke}" stroke-linecap="round" stroke-linejoin="round"/>`).join("")}</svg>`;
                    void download(
                      svg,
                      "Papier-mark.svg",
                      "image/svg+xml",
                      false,
                    ).catch((e) => setError(String(e)));
                  }}
                >
                  Export transparent SVG
                </button>
              </>
            ) : null}
            {mode === "Library" && picked && (
              <button
                className="text-button danger-text"
                onClick={() => {
                  const next = library.filter((v) => v.id !== picked.id);
                  localStorage.setItem(
                    "papier-signatures",
                    JSON.stringify(next),
                  );
                  setLibrary(next);
                  setPicked(null);
                }}
              >
                Remove from library
              </button>
            )}
          </aside>
        </div>
        {error && (
          <p role="alert" className="new-document-error">
            {error}
          </p>
        )}
        <footer>
          {mode !== "Import" && mode !== "Draw" && (
            <button
              className="signature-customize"
              aria-expanded={customize}
              onClick={() => setCustomize(!customize)}
            >
              {customize ? "Done customizing" : "Customize"}
            </button>
          )}
          <span>
            <PenLine size={13} />
            Private. Generated on your device.
          </span>
          <button className="secondary" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button
            className="primary"
            disabled={
              busy || (mode === "Import" ? !image : !current?.paths.length)
            }
            onClick={() => void place()}
          >
            {busy
              ? "Placing…"
              : initialMode === "Draw" && mode === "Draw"
                ? "Place drawing"
                : "Place signature"}
          </button>
        </footer>
      </div>
    </Dialog>
  );
}
