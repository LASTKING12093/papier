import {
  resizeRect,
  snapAxis,
  rotationDelta,
} from "../../../packages/editor-state/geometry";
import { getPreferences } from "./preferences";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import type {
  Session,
  PdfObject,
  Tool,
  Rect,
} from "../../../packages/editor-state/types";
import { Copy, Trash2, RotateCw, Type, Ellipsis } from "./icons";
import { curve } from "./signature-vectors";
import { api, renderPage } from "./api";
import { useVisible, Spinner } from "./components";
export function Thumbnail({ doc, page }: { doc: Session; page: number }) {
  const { ref, visible } = useVisible("120px");
  const [src, setSrc] = useState("");
  const [renderedRevision, setRenderedRevision] = useState(-1);
  useEffect(() => {
    let valid = true;
    if (visible)
      renderPage(doc, page, 140)
        .then((s) => {
          if (valid) {
            setSrc(s);
            setRenderedRevision(doc.revision);
          }
        })
        .catch(() => {});
    else setSrc("");
    return () => {
      valid = false;
    };
  }, [visible, doc.id, doc.revision, page]);
  const p = doc.info.pages[page];
  return (
    <div
      ref={ref}
      className="thumb-paper"
      data-render-required={doc.revision}
      data-rendered={renderedRevision}
      style={{ aspectRatio: p.width / p.height }}
    >
      {src ? (
        <img src={src} alt={`Page ${page + 1}`} draggable={false} />
      ) : (
        <span>{page + 1}</span>
      )}
    </div>
  );
}
export function PageCanvas({
  doc,
  page,
  zoom,
  tool,
  selected,
  onSelect,
  onRegion,
  onDraw,
  onActive,
  onError,
  search,
  inkColor,
  inkWidth,
  inkOpacity,
  onTransform,
  onText,
  onInsertText,
  onTextDraft,
  onExitText,
  textValue,
  textStyle,
  registerTextEditor,
  onContext,
  onAction,
}: {
  doc: Session;
  page: number;
  zoom: number;
  tool: Tool;
  selected: PdfObject | null;
  onSelect: (page: number, o: PdfObject | null) => void;
  onRegion: (page: number, rect: Rect) => void;
  onDraw: (page: number, p: number[][]) => void;
  onActive: (page: number) => void;
  onError: (s: string) => void;
  search: string;
  inkColor: string;
  inkWidth: number;
  inkOpacity: number;
  onTransform: (
    page: number,
    object: PdfObject,
    rect: Rect,
    degrees: number,
  ) => Promise<Session | undefined>;
  onText: (page: number, object: PdfObject, text: string) => Promise<boolean>;
  onInsertText: (page: number, rect: Rect, text: string) => Promise<boolean>;
  onTextDraft: (value: string) => void;
  onExitText: () => void;
  textValue: string;
  textStyle: { size: number; color: string; font: string };
  registerTextEditor: (
    page: number,
    commit: (() => Promise<boolean>) | null,
  ) => void;
  onAction: (page: number, object: PdfObject, action: string) => void;
  onContext: (x: number, y: number, page: number, object: PdfObject) => void;
}) {
  const { ref, visible } = useVisible("500px");
  const [src, setSrc] = useState("");
  const [renderedRevision, setRenderedRevision] = useState(-1);
  const [objects, setObjects] = useState<PdfObject[]>([]);
  const [drag, setDrag] = useState<Rect | null>(null);
  const [ink, setInk] = useState<number[][]>([]);
  const start = useRef<number[] | null>(null);
  const surface = useRef<HTMLDivElement>(null);
  const size = doc.info.pages[page];
  const manipulation = useRef<{
    object: PdfObject;
    handle: string;
    start: number[];
    clientStart: number[];
    rect: Rect;
    degrees: number;
    started: boolean;
  } | null>(null);
  const [preview, setPreview] = useState<Rect | null>(null);
  const [angle, setAngle] = useState(0);
  const [guides, setGuides] = useState<{ x?: number; y?: number }>({});
  const [editing, setEditing] = useState<PdfObject | null>(null);
  const [draft, setDraft] = useState("");
  const [inserting, setInserting] = useState<Rect | null>(null);
  const textCommit = useRef(false);
  const [textSaving, setTextSaving] = useState(false);
  useEffect(() => {
    setEditing(null);
    setInserting(null);
  }, [doc.id, doc.revision]);
  async function commitText() {
    if (textCommit.current) return false;
    const value = editing ? textValue : draft;
    if (!value.trim() && inserting) {
      setInserting(null);
      return true;
    }
    textCommit.current = true;
    setTextSaving(true);
    try {
      const done = editing
        ? await onText(page, editing, value)
        : inserting
          ? await onInsertText(page, inserting, value)
          : false;
      if (done) {
        setEditing(null);
        setInserting(null);
      }
      return done;
    } finally {
      textCommit.current = false;
      setTextSaving(false);
    }
  }
  useEffect(() => {
    if (editing || inserting) {
      registerTextEditor(page, commitText);
      return () => registerTextEditor(page, null);
    }
  });
  const [layers, setLayers] = useState<{
    key: string;
    images: string[];
    bounds: Rect;
  } | null>(null);
  const [committing, setCommitting] = useState(false);
  const [hudBelow, setHudBelow] = useState(false);
  useEffect(() => {
    const viewport = surface.current?.closest(".canvas");
    if (!viewport || !selected) return;
    const position = () =>
      setHudBelow(
        surface.current!.getBoundingClientRect().top +
          selected.bounds.y * zoom <
          viewport.getBoundingClientRect().top + 76,
      );
    position();
    viewport.addEventListener("scroll", position, { passive: true });
    window.addEventListener("resize", position);
    return () => {
      viewport.removeEventListener("scroll", position);
      window.removeEventListener("resize", position);
    };
  }, [selected, zoom]);
  const layerRequest = useRef(0);
  const previewWidth = Math.max(
    32,
    Math.floor(
      Math.min(
        2400,
        (4096 * size.width) / size.height,
        Math.sqrt((8_000_000 * size.width) / size.height),
        size.width *
          zoom *
          Math.min(devicePixelRatio, getPreferences().renderScale),
      ),
    ),
  );
  const layerKey = (o: PdfObject) =>
    `${doc.id}:${doc.revision}:${page}:${o.index}:${previewWidth}`;
  const layerPending = useRef("");
  async function prepareLayers(o: PdfObject) {
    if (committing) return;
    const key = layerKey(o);
    if (layers?.key === key || layerPending.current === key) return;
    layerPending.current = key;
    const request = ++layerRequest.current;
    try {
      const images = await api<string[]>("object_layers", doc.id, {
        page,
        object: o.index,
        width: previewWidth,
        revision: doc.revision,
      });
      await Promise.all(
        images.map(
          (src) =>
            new Promise<void>((resolve, reject) => {
              const im = new Image();
              im.onload = () => resolve();
              im.onerror = reject;
              im.src = src;
            }),
        ),
      );
      if (request === layerRequest.current)
        setLayers({ key, images, bounds: o.bounds });
    } catch (e) {
      if (request === layerRequest.current && manipulation.current)
        onError(`Object preview: ${String(e)}`);
    } finally {
      if (request === layerRequest.current) layerPending.current = "";
    }
  }
  useEffect(() => {
    if (selected && tool === "select") void prepareLayers(selected);
  }, [selected?.index, doc.revision, zoom, tool, committing]);
  const showingLayers = !!(
    preview &&
    selected &&
    layers &&
    (committing || layers.key === layerKey(selected))
  );
  function manipulate(e: PointerEvent, o: PdfObject, handle = "move") {
    if (e.button !== 0 || committing || editing) return;
    void prepareLayers(o);
    e.preventDefault();
    e.stopPropagation();
    onSelect(page, o);
    manipulation.current = {
      object: o,
      handle,
      start: point(e),
      clientStart: [e.clientX, e.clientY],
      rect: o.bounds,
      degrees: 0,
      started: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    setPreview(null);
    setAngle(0);
  }
  function moveObject(e: PointerEvent) {
    const m = manipulation.current;
    if (!m) return false;
    // Selection can open the inspector and shift the canvas under a stationary
    // pointer. Only actual pointer travel should transform document content.
    const dx = (e.clientX - m.clientStart[0]) / zoom,
      dy = (e.clientY - m.clientStart[1]) / zoom,
      x = m.start[0] + dx,
      y = m.start[1] + dy,
      b = m.object.bounds;
    if (!m.started && Math.hypot(dx, dy) * zoom < 3) return true;
    m.started = true;
    let r = { ...b };
    const g: { x?: number; y?: number } = {};
    if (m.handle === "rotate") {
      m.degrees = rotationDelta(m.start, [x, y], b, e.shiftKey);
      setAngle(m.degrees);
    } else if (m.handle === "move") {
      r.x += e.shiftKey && Math.abs(dy) > Math.abs(dx) ? 0 : dx;
      r.y += e.shiftKey && Math.abs(dx) >= Math.abs(dy) ? 0 : dy;
      if (!e.ctrlKey && getPreferences().snap) {
        const xs = [
          0,
          36,
          72,
          size.width / 2,
          size.width - 72,
          size.width - 36,
          size.width,
        ];
        const ys = [
          0,
          36,
          72,
          size.height / 2,
          size.height - 72,
          size.height - 36,
          size.height,
        ];
        for (const o of objects)
          if (o.index !== m.object.index) {
            xs.push(
              o.bounds.x,
              o.bounds.x + o.bounds.width / 2,
              o.bounds.x + o.bounds.width,
            );
            ys.push(
              o.bounds.y,
              o.bounds.y + o.bounds.height / 2,
              o.bounds.y + o.bounds.height,
            );
          }
        const sx = snapAxis(r.x, r.width, xs, 4 / zoom);
        const sy = snapAxis(r.y, r.height, ys, 4 / zoom);
        if (!e.shiftKey || Math.abs(dx) >= Math.abs(dy)) {
          r.x = sx.position;
          g.x = sx.guide;
        }
        if (!e.shiftKey || Math.abs(dy) > Math.abs(dx)) {
          r.y = sy.position;
          g.y = sy.guide;
        }
      }
    } else {
      // Text always keeps its glyph proportions. Images keep aspect unless Shift is held.
      const proportional =
        m.object.kind === "text" ||
        (m.object.kind === "image" ? !e.shiftKey : e.shiftKey);
      r = resizeRect(b, m.handle, dx, dy, proportional);
    }
    m.rect = r;
    setPreview(r);
    setGuides(g);
    return true;
  }
  useEffect(() => {
    const cancel = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !manipulation.current) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      manipulation.current = null;
      setPreview(null);
      setAngle(0);
      setGuides({});
    };
    window.addEventListener("keydown", cancel, true);
    return () => window.removeEventListener("keydown", cancel, true);
  }, []);
  useEffect(() => {
    let valid = true;
    if (visible) {
      const width = Math.min(
        4096,
        Math.max(
          32,
          Math.round(
            size.width *
              zoom *
              Math.min(devicePixelRatio, getPreferences().renderScale),
          ),
        ),
      );
      renderPage(doc, page, width)
        .then((s) => {
          if (valid) {
            setSrc(s);
            setRenderedRevision(doc.revision);
          }
        })
        .catch((e) => {
          if (valid) onError(String(e));
        });
      api<PdfObject[]>("inspect", doc.id, { page })
        .then((o) => {
          if (valid) setObjects(o);
        })
        .catch((e) => {
          if (valid) onError(String(e));
        });
    } else {
      setSrc("");
      setObjects([]);
    }
    return () => {
      valid = false;
    };
  }, [doc.id, doc.revision, page, visible, zoom, size.width]);
  function point(e: PointerEvent) {
    const r = surface.current!.getBoundingClientRect();
    return [(e.clientX - r.left) / zoom, (e.clientY - r.top) / zoom];
  }
  function down(e: PointerEvent) {
    if (e.button !== 0) return;
    if (editing || inserting) return;
    onActive(page);
    if (tool === "select") {
      onSelect(page, null);
      return;
    }
    start.current = point(e);
    e.currentTarget.setPointerCapture(e.pointerId);
    if (tool === "draw" || tool === "signature") setInk([start.current]);
    else
      setDrag({
        x: start.current[0],
        y: start.current[1],
        width: 1,
        height: 1,
      });
  }
  function move(e: PointerEvent) {
    if (moveObject(e)) return;
    if (!start.current) return;
    const p = point(e);
    if (tool === "draw" || tool === "signature") setInk((old) => [...old, p]);
    else
      setDrag({
        x: Math.min(start.current[0], p[0]),
        y: Math.min(start.current[1], p[1]),
        width: Math.abs(start.current[0] - p[0]),
        height: Math.abs(start.current[1] - p[1]),
      });
  }
  async function up() {
    const m = manipulation.current;
    if (m) {
      manipulation.current = null;
      setGuides({});
      const changed =
        m.started &&
        Math.abs(m.rect.x - m.object.bounds.x) +
          Math.abs(m.rect.y - m.object.bounds.y) +
          Math.abs(m.rect.width - m.object.bounds.width) +
          Math.abs(m.rect.height - m.object.bounds.height) +
          Math.abs(m.degrees) >
          0.1;
      if (changed) {
        setCommitting(true);
        try {
          const next = await onTransform(page, m.object, m.rect, -m.degrees);
          if (next) {
            const src = await renderPage(next, page, previewWidth);
            await new Promise<void>((resolve) => {
              const im = new Image();
              im.onload = () => resolve();
              im.onerror = () => resolve();
              im.src = src;
            });
            setSrc(src);
            setRenderedRevision(next.revision);
          }
        } finally {
          setCommitting(false);
          setPreview(null);
          setAngle(0);
        }
      } else {
        setPreview(null);
        setAngle(0);
      }
      return;
    }
    if (!start.current) return;
    if (tool === "draw" || tool === "signature") {
      if (ink.length > 1) onDraw(page, ink);
    } else if (drag) {
      const region = {
        ...drag,
        width: Math.max(drag.width, tool === "note" ? 24 : 120),
        height: Math.max(drag.height, tool === "note" ? 24 : 28),
      };
      if (tool === "text") {
        setInserting({
          ...region,
          width: Math.min(Math.max(region.width, 240), size.width - region.x),
        });
        setDraft("");
        onSelect(page, null);
      } else onRegion(page, region);
    }
    start.current = null;
    setDrag(null);
    setInk([]);
  }
  return (
    <div
      ref={ref}
      className="page-slot"
      id={`page-${page}`}
      style={{ width: size.width * zoom, height: size.height * zoom + 32 }}
    >
      <div className="page-caption">
        <span>PAGE {String(page + 1).padStart(2, "0")}</span>
        <span>
          {Math.round(size.width)} × {Math.round(size.height)} pt
        </span>
      </div>
      <div
        ref={surface}
        className={`pdf-page tool-${tool}`}
        data-transforming={!!preview}
        data-document-id={doc.id}
        data-render-required={doc.revision}
        data-rendered={renderedRevision}
        style={{ width: size.width * zoom, height: size.height * zoom }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => {
          manipulation.current = null;
          setPreview(null);
          setAngle(0);
          setGuides({});
          start.current = null;
          setDrag(null);
          setInk([]);
        }}
      >
        {src ? (
          <img
            className="rendered-page"
            src={src}
            draggable={false}
            alt={`Document page ${page + 1}`}
          />
        ) : (
          <div className="page-loading">{visible && <Spinner />}</div>
        )}
        {showingLayers && layers && preview && (
          <div
            className="object-live-composite"
            aria-label="Live PDF object preview"
          >
            <img className="object-underlay" src={layers.images[0]} alt="" />
            <img
              className="object-live-content"
              src={layers.images[1]}
              alt="Moving PDF object"
              style={{
                transformOrigin: `${layers.bounds.x * zoom}px ${layers.bounds.y * zoom}px`,
                transform: `translate(${(preview.x - layers.bounds.x) * zoom}px,${(preview.y - layers.bounds.y) * zoom}px) translate(${(preview.width * zoom) / 2}px,${(preview.height * zoom) / 2}px) rotate(${angle}deg) translate(${(-preview.width * zoom) / 2}px,${(-preview.height * zoom) / 2}px) scale(${preview.width / layers.bounds.width},${preview.height / layers.bounds.height})`,
              }}
            />
            <img className="object-overlays" src={layers.images[2]} alt="" />
          </div>
        )}
        {tool === "select" &&
          objects.map((o) => (
            <span
              key={o.index}
              className={`pdf-object ${selected?.index === o.index ? "selected" : ""} ${search && o.text?.toLowerCase().includes(search.toLowerCase()) ? "search-hit" : ""}`}
              title={o.text ? `${o.font} · ${o.size?.toFixed(1)} pt` : o.kind}
              style={{
                left: o.bounds.x * zoom,
                top: o.bounds.y * zoom,
                width: Math.max(4, o.bounds.width * zoom),
                height: Math.max(4, o.bounds.height * zoom),
                fontSize: (o.size ?? 12) * zoom,
              }}
              onPointerDown={(e) => manipulate(e, o)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onContext(e.clientX, e.clientY, page, o);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (o.text !== null) {
                  setEditing(o);
                  setDraft(o.text);
                }
              }}
            >
              {o.text && <span className="text-selection">{o.text}</span>}
            </span>
          ))}
        {tool === "select" &&
          selected &&
          (() => {
            const b =
              (showingLayers || committing ? preview : null) ?? selected.bounds;
            return (
              <div
                className="object-selection"
                data-tight={b.height * zoom < 22 || b.width * zoom < 22}
                style={{
                  left: b.x * zoom,
                  top: b.y * zoom,
                  width: b.width * zoom,
                  height: b.height * zoom,
                  transform: `rotate(${angle}deg)`,
                }}
                onPointerDown={(e) => manipulate(e, selected)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (selected.kind === "text") {
                    setEditing(selected);
                    setDraft(selected.text ?? "");
                  }
                }}
              >
                {["nw", "n", "ne", "e", "se", "s", "sw", "w"].map((handle) => (
                  <button
                    key={handle}
                    aria-label={`Resize ${handle}`}
                    className={`resize-handle handle-${handle}`}
                    onPointerDown={(e) => manipulate(e, selected, handle)}
                  />
                ))}
                <span className="rotation-stem" />
                <button
                  className="rotate-handle"
                  aria-label="Rotate object"
                  onPointerDown={(e) => manipulate(e, selected, "rotate")}
                />
                {!preview && !editing && (
                  <div
                    className="selection-hud"
                    style={{
                      top: hudBelow ? b.height * zoom + 14 : -68,
                      left: Math.max(
                        132 - b.x * zoom,
                        Math.min(
                          (b.width * zoom) / 2,
                          (size.width - b.x) * zoom - 132,
                        ),
                      ),
                    }}
                    role="toolbar"
                    aria-label="Object quick actions"
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    {selected.kind === "text" && (
                      <button
                        aria-label="Edit selected text"
                        title="Edit text"
                        onClick={() => {
                          setEditing(selected);
                          setDraft(selected.text ?? "");
                        }}
                      >
                        <Type size={14} />
                        <span>Edit text</span>
                      </button>
                    )}
                    <button
                      aria-label="Center object on page"
                      title="Center on page"
                      onClick={() => onAction(page, selected, "center")}
                    >
                      <span>Center</span>
                    </button>
                    <button
                      aria-label="Duplicate selected object"
                      title="Duplicate · Ctrl D"
                      onClick={() => onAction(page, selected, "duplicate")}
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      aria-label="Rotate selected object"
                      title="Rotate 15°"
                      onClick={() => onAction(page, selected, "rotate")}
                    >
                      <RotateCw size={14} />
                    </button>
                    <span />
                    <button
                      aria-label="Delete selected object"
                      title="Delete"
                      onClick={() => onAction(page, selected, "delete")}
                    >
                      <Trash2 size={14} />
                    </button>
                    <button
                      aria-label="More object actions"
                      title="More actions"
                      onClick={(e) =>
                        onContext(e.clientX, e.clientY, page, selected)
                      }
                    >
                      <Ellipsis size={14} />
                    </button>
                  </div>
                )}
                {preview && (
                  <span className="transform-readout">
                    {Math.round(b.width)} × {Math.round(b.height)} pt
                    {angle ? ` · ${Math.round(angle)}°` : ""}
                  </span>
                )}
              </div>
            );
          })()}
        {guides.x !== undefined && (
          <div
            className="smart-guide vertical"
            style={{ left: guides.x * zoom }}
          />
        )}
        {guides.y !== undefined && (
          <div
            className="smart-guide horizontal"
            style={{ top: guides.y * zoom }}
          />
        )}
        {(editing || inserting) && (
          <div
            className="page-text-composer"
            style={{
              left: (editing?.bounds.x ?? inserting!.x) * zoom,
              top: (editing?.bounds.y ?? inserting!.y) * zoom,
              width:
                Math.min(
                  size.width - (editing?.bounds.x ?? inserting!.x),
                  Math.max(180, editing?.bounds.width ?? inserting!.width),
                ) * zoom,
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <textarea
              className="inline-text-editor"
              aria-label={editing ? "Edit text on page" : "New text on page"}
              placeholder="Type here…"
              autoFocus
              value={editing ? textValue : draft}
              disabled={textSaving}
              style={{
                minHeight: Math.max(
                  34,
                  (editing?.bounds.height ?? inserting!.height) * zoom + 12,
                ),
                fontSize: Math.max(8, textStyle.size) * zoom,
                fontFamily:
                  textStyle.font === "Keep original font"
                    ? (editing?.font ?? "sans-serif")
                    : textStyle.font,
              }}
              onChange={(e) => {
                setDraft(e.target.value);
                if (editing) onTextDraft(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (
                  (e.ctrlKey || e.metaKey) &&
                  ["s", "k"].includes(e.key.toLowerCase())
                )
                  return;
                e.stopPropagation();
                if (e.key === "Escape") {
                  setEditing(null);
                  setInserting(null);
                  if (editing) onTextDraft(editing.text ?? "");
                  onExitText();
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void commitText();
                }
              }}
            />
            <div className="page-text-actions">
              <span>Enter to save · Shift Enter for a new line</span>
              <button
                disabled={textSaving}
                onClick={() => {
                  setEditing(null);
                  setInserting(null);
                  if (editing) onTextDraft(editing.text ?? "");
                  onExitText();
                }}
              >
                Cancel
              </button>
              <button disabled={textSaving} onClick={() => void commitText()}>
                {textSaving ? "Saving…" : "Done"}
              </button>
            </div>
          </div>
        )}
        {drag && (
          <div
            className={`region ${tool === "redact" ? "redaction-mark" : ""}`}
            style={{
              left: drag.x * zoom,
              top: drag.y * zoom,
              width: drag.width * zoom,
              height: drag.height * zoom,
            }}
          />
        )}
        {ink.length > 1 && (
          <svg className="ink-preview" width="100%" height="100%">
            <path
              d={curve(ink.map((p) => [p[0] * zoom, p[1] * zoom]))}
              fill="none"
              stroke={inkColor}
              opacity={inkOpacity}
              strokeWidth={inkWidth * zoom}
            />
          </svg>
        )}
      </div>
    </div>
  );
}
