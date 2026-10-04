import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { api, native } from "./api";
import { Mark } from "./Brand";
import { HomeLight } from "./Motion";
import { brand } from "../../../packages/design-system/brand";
import type { Session } from "../../../packages/editor-state/types";
import {
  FolderOpen,
  Plus,
  Search,
  Ellipsis,
  Grid2X2,
  Layers,
  Settings2,
  FileText,
  PenLine,
  ArrowUpRight,
} from "./icons";
import { ContextMenu, IconButton } from "./components";

type Recent = {
  id: string;
  name: string;
  source: string | null;
  thumbnail: string;
  opened: number;
  bytes: number;
  pages: number;
  pinned: boolean;
};
export function HomeScreen({
  onOpen,
  onNew,
  onSession,
  onError,
  onSettings,
  onCommands,
  onSignature,
  onTemplate,
  recovery,
  onRecover,
}: {
  onOpen: () => void;
  onNew: () => void;
  onSession: (s: Session) => void;
  onError: (e: unknown) => void;
  onSettings: () => void;
  recovery: Session[];
  onRecover: (id: string) => void;
  onCommands: () => void;
  onSignature: (draw?: boolean) => void;
  onTemplate: (name: string) => void;
}) {
  const [rows, setRows] = useState<Recent[]>([]),
    [query, setQuery] = useState(""),
    [list, setList] = useState(false);
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    row: Recent;
  } | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [recentsReady, setRecentsReady] = useState(false);
  const refresh = () =>
    api<Recent[]>("recent_list")
      .then(setRows)
      .catch(onError)
      .finally(() => setRecentsReady(true));
  useEffect(() => {
    void refresh();
  }, []);
  async function action(name: string, row: Recent) {
    setMenu(null);
    setLoading(row.id);
    try {
      if (name === "reveal") await invoke("reveal_recent", { id: row.id });
      else {
        const value = await api<Session>(`recent_${name}`, row.id);
        if (name === "open" || name === "duplicate") onSession(value);
        else await refresh();
      }
    } catch (e) {
      onError(e);
    } finally {
      setLoading(null);
    }
  }
  const visible = rows
    .filter((r) =>
      `${r.name} ${r.source ?? ""}`.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.opened - a.opened);
  return (
    <main className="papier-home quiet-home">
      <HomeLight />
      <div className="quiet-home-content">
        <section className="quiet-welcome">
          <div className="quiet-brand">
            <Mark size={48} prism />
            <h1>Papier</h1>
          </div>
          <p>Open a PDF. Make it yours.</p>
          <div className="quiet-launch">
            <button className="primary" onClick={onOpen}>
              <FolderOpen size={16} />
              Open PDF…<kbd>Ctrl O</kbd>
            </button>
            <button onClick={onNew}>
              <Plus size={16} />
              New document<kbd>Ctrl N</kbd>
            </button>
          </div>
          <span className="quiet-drop">Or drop a PDF anywhere.</span>
          <div className="quiet-studios">
            <button
              onClick={() => onSignature()}
              aria-label="Your signature, your style — Signature Studio"
            >
              <PenLine size={15} />
              Signature Studio
              <ArrowUpRight size={12} />
            </button>
            <button
              onClick={() => onSignature(true)}
              aria-label="From rough to refined — Ink Studio"
            >
              <span className="ink-symbol">∿</span>Ink Studio
              <ArrowUpRight size={12} />
            </button>
            <button onClick={onCommands}>
              <Search size={15} />
              Find a tool<kbd>Ctrl K</kbd>
            </button>
          </div>
          <details className="quiet-templates">
            <summary>Start from a template</summary>
            <div className="home-template-line">
              {["Creative Brief", "Weekly Focus", "Client Intake"].map((n) => (
                <button key={n} onClick={() => onTemplate(n)}>
                  {n}
                  <Plus size={12} />
                </button>
              ))}
            </div>
          </details>
        </section>
        <section className="quiet-recents" aria-label="Recent documents">
          <header>
            <h2>Open recent</h2>
            <button onClick={() => setList(!list)} aria-expanded={list}>
              {list ? "Show less" : "See all"}
            </button>
          </header>
          <label className="quiet-search">
            <Search size={13} />
            <input
              aria-label="Search recent documents"
              placeholder="Find a document…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="quiet-file-list">
            {visible.slice(0, list || query ? visible.length : 6).map((row) => (
              <article
                className="quiet-file"
                key={row.id}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setMenu({ x: e.clientX, y: e.clientY, row });
                }}
              >
                <button
                  className="quiet-file-open"
                  disabled={loading !== null}
                  onClick={() => void action("open", row)}
                  title={row.source ?? "Local working copy"}
                >
                  <img src={row.thumbnail} alt="" draggable={false} />
                  <span>
                    <strong>{row.name}</strong>
                    <small>
                      {row.pages} {row.pages === 1 ? "page" : "pages"}
                      {row.pinned ? " · Pinned" : ""}
                    </small>
                  </span>
                  <time>
                    {new Date(row.opened * 1000).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </time>
                </button>
                <button
                  className="quiet-file-more"
                  aria-label={"Options for " + row.name}
                  onClick={(e) => setMenu({ x: e.clientX, y: e.clientY, row })}
                >
                  <Ellipsis size={15} />
                </button>
              </article>
            ))}
          </div>
          {!recentsReady && <p role="status">Loading documents…</p>}
          {recentsReady && !visible.length && (
            <p className="quiet-empty">
              {query
                ? "No matching documents."
                : "Your recent documents will appear here."}
            </p>
          )}
          {recovery.length > 0 && (
            <details className="home-recovery">
              <summary>
                Recover unsaved work <span>{recovery.length}</span>
              </summary>
              {recovery.slice(0, 6).map((d) => (
                <button key={d.id} onClick={() => onRecover(d.id)}>
                  <FileText size={12} />
                  {d.name}
                </button>
              ))}
            </details>
          )}
        </section>
      </div>
      <footer className="quiet-home-footer">
        <span>
          <i className="local-dot" />
          Local by design.
        </span>
        <button onClick={onSettings}>
          <Settings2 size={14} />
          Settings
        </button>
        <small>{brand.version}</small>
      </footer>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            { label: "Open", run: () => void action("open", menu.row) },
            {
              label: menu.row.pinned ? "Unpin" : "Pin",
              run: () => void action("pin", menu.row),
            },
            {
              label: "Show in Explorer",
              disabled: !native || !menu.row.source,
              run: () => void action("reveal", menu.row),
            },
            {
              label: "Duplicate",
              run: () => void action("duplicate", menu.row),
            },
            {
              label: "Remove from recent",
              run: () => void action("remove", menu.row),
            },
          ]}
        />
      )}
    </main>
  );
}
