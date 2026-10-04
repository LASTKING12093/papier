import { TaskMenu } from "./TaskMenu";
import { DocumentInspector } from "./DocumentInspector";
import { ToolLibrary } from "./ToolLibrary";
import { FindReplace } from "./FindReplace";
import { PageContents } from "./PageContents";
import {
  reconstructInk,
  type InkMode,
} from "../../../packages/editor-state/ink";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Copy,
  Download,
  Ellipsis,
  File,
  FilePlus2,
  FileText,
  FolderOpen,
  Grid2X2,
  Highlighter,
  Home,
  ImagePlus,
  Info,
  Layers,
  Link2,
  LockKeyhole,
  Maximize,
  MessageSquare,
  Minus,
  MousePointer2,
  PanelLeftClose,
  PanelRightClose,
  PenLine,
  Plus,
  RotateCw,
  Save,
  ScanLine,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Square,
  Trash2,
  Type,
  Undo2,
  Redo2,
  X,
  ZoomIn,
  Sun,
  Moon,
  Monitor,
  CheckSquare,
  Circle,
  Crop,
  Hash,
  Stamp,
  Github,
} from "./icons";
import { brand } from "../../../packages/design-system/brand";
import {
  formatBytes,
  parsePages,
  reorderPages,
  type Command,
  type PdfObject,
  type Rect,
  type Session,
  type Tool,
} from "../../../packages/editor-state/types";
import {
  api,
  download,
  fileData,
  native,
  openDocument,
  pickFile,
  saveDocument,
  signDocument,
} from "./api";
import {
  Dialog,
  Field,
  IconButton,
  Section,
  Select,
  Spinner,
  CommandPalette,
  GeometryFields,
  ContextMenu,
} from "./components";
import { PageCanvas, Thumbnail } from "./Canvas";
import { Mark } from "./Brand";
import { SaveAs } from "./SaveAs";
import { Compare } from "./Compare";
import { InsertPdf } from "./InsertPdf";
import { SignatureStudio } from "./SignatureStudio";
import { HomeScreen } from "./Home";
import { FontPicker, fontNames } from "./fonts";
import { getPreferences, usePreferences } from "./preferences";
import { Settings } from "./Settings";
import { NewDocument } from "./NewDocument";
import { WindowControls } from "./WindowControls";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { templateCommands } from "./templates";
import { runOcr } from "./ocr";

type Modal = {
  title: string;
  description?: string;
  fields?: {
    key: string;
    label: string;
    value: string;
    type?: string;
    options?: string[];
  }[];
  actionLabel?: string;
  danger?: boolean;
  submit?: (values: Record<string, string>) => Promise<void>;
  content?: React.ReactNode;
};
const tools: { id: Tool; label: string; icon: typeof Type }[] = [
  { id: "select", label: "Select objects", icon: MousePointer2 },
  { id: "text", label: "Add text", icon: Type },
  { id: "highlight", label: "Highlight", icon: Highlighter },
  { id: "note", label: "Comment", icon: MessageSquare },
  { id: "draw", label: "Draw", icon: PenLine },
  { id: "rectangle", label: "Rectangle", icon: Square },
  { id: "ellipse", label: "Ellipse", icon: Circle },
  { id: "link", label: "Link", icon: Link2 },
];
export default function App() {
  const preferences = usePreferences();
  const [objectMenu, setObjectMenu] = useState<{
    x: number;
    y: number;
    o: PdfObject;
    p: number;
  } | null>(null);
  const [inspectDocument, setInspectDocument] = useState(false);
  const [typeStyle, setTypeStyle] = useState<{
    font: string | null;
    size: number;
    color: number[];
  } | null>(null);
  const [saveAs, setSaveAs] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [compareSource, setCompareSource] = useState<Session | null>(null);
  const [insertSource, setInsertSource] = useState<Session | null>(null);
  const [signatureStudio, setSignatureStudio] = useState(false);
  const [signatureStart, setSignatureStart] = useState("Type");
  const [inkAssist, setInkAssist] = useState<InkMode>("Smooth");
  const [templateQuery, setTemplateQuery] = useState("");
  const [newDocument, setNewDocument] = useState(false);
  const objectClipboard = useRef<string | null>(null);
  const [brush, setBrush] = useState("Pen");
  const [stroke, setStroke] = useState("2");
  const [opacity, setOpacity] = useState("100");
  const [context, setContext] = useState<{
    x: number;
    y: number;
    page: number;
  } | null>(null);
  const ocrCancel = useRef<AbortController | null>(null);
  const [docs, setDocs] = useState<Session[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const doc = docs.find((d) => d.id === active);
  const [page, setPage] = useState(0);
  const [zoom, setZoom] = useState(getPreferences().zoom / 100);
  const [tool, setTool] = useState<Tool>("select");
  const [mode, setMode] = useState("Edit");
  const [panel, setPanel] = useState("Pages");
  const [inspector, setInspector] = useState(false);
  const [left, setLeft] = useState(false);
  const [layout, setLayout] = useState(getPreferences().layout);
  const [selection, setSelection] = useState<PdfObject | null>(null);
  const [selectedPages, setSelectedPages] = useState<number[]>([0]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState<Modal | null>(null);
  const [palette, setPalette] = useState(false);
  const [toolLibrary, setToolLibrary] = useState(false);
  const [findReplace, setFindReplace] = useState(false);
  const activeTextEditor = useRef<{
    page: number;
    commit: () => Promise<boolean>;
  } | null>(null);
  const [, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [results, setResults] = useState<{ page: number; text: string }[]>([]);
  const [text, setText] = useState("");
  const [font, setFont] = useState(fontNames[0]);
  const [fontSize, setFontSize] = useState("14");
  const [color, setColor] = useState("#303038");
  const [recovery, setRecovery] = useState<Session[]>([]);
  const [theme, setTheme] = useState(
    () => localStorage.getItem("studio-theme") ?? "Dark",
  );
  const [dropping, setDropping] = useState(false);
  const dragPage = useRef<number | null>(null);
  const dragTab = useRef<string | null>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const operation = useRef(false);
  const notify = useCallback((s: string) => {
    setToast(s);
    setTimeout(() => setToast(""), 4000);
  }, []);
  const report = useCallback(
    (e: unknown) => setError(String(e).replace(/^Error: /, "")),
    [],
  );
  function update(s: Session) {
    setDocs((old) =>
      old.some((d) => d.id === s.id)
        ? old.map((d) => (d.id === s.id ? s : d))
        : [...old, s],
    );
    setActive(s.id);
    setPage((p) => Math.min(p, s.info.pages.length - 1));
  }
  async function run<T>(
    label: string,
    fn: () => Promise<T>,
  ): Promise<T | undefined> {
    if (operation.current) {
      notify("Finish the current operation before starting another.");
      return;
    }
    operation.current = true;
    setBusy(label);
    try {
      return await fn();
    } catch (e) {
      report(e);
    } finally {
      operation.current = false;
      setBusy("");
    }
  }
  async function open() {
    if (activeTextEditor.current && !(await activeTextEditor.current.commit()))
      return;
    await run("Opening PDF", async () => {
      const s = await openDocument();
      if (s) {
        update(s);
        setMode("Edit");
        setTool("select");
        setPanel("Pages");
        setLeft(false);
        setInspector(false);
        setPage(0);
        setSelectedPages([0]);
        setSelection(null);
        setZoom(preferences.zoom / 100);
        setLayout(preferences.layout);
      }
    });
  }
  async function create() {
    if (activeTextEditor.current && !(await activeTextEditor.current.commit()))
      return;
    setNewDocument(true);
  }
  function settings() {
    setSettingsOpen(true);
  }
  async function chooseMode(value: string) {
    if (activeTextEditor.current && !(await activeTextEditor.current.commit()))
      return false;
    setMode(value);
    setSelection(null);
    setTool("select");
    setInspector(false);
    setLeft(false);
    if (value === "Annotate") {
      setTool("highlight");
      setColor("#f2ce55");
      setPanel("Comments");
      setLeft(true);
    }
    if (value === "Forms") {
      setPanel("Forms");
      setLeft(true);
    }
    if (value === "Review") {
      setPanel("Comments");
      setLeft(true);
    }
    if (value === "Pages") {
      setPanel("Pages");
      setLeft(true);
    }
    if (value === "Sign") {
      setInspector(false);
      setPanel("Signatures");
      setLeft(true);
      setSignatureStudio(true);
    }
    return true;
  }
  async function activateTool(next: Tool, workspace = "Edit") {
    if (await chooseMode(workspace)) setTool(next);
  }
  async function closeWindow() {
    const hadDraft = !!activeTextEditor.current;
    if (activeTextEditor.current && !(await activeTextEditor.current.commit()))
      return;
    if (hadDraft || docs.some((d) => d.dirty))
      setModal({
        title: "Close Papier?",
        description:
          "There are unsaved documents. Cancel to save your changes, or close and keep local recovery copies.",
        actionLabel: "Close and keep recovery",
        submit: async () => {
          await getCurrentWindow().destroy();
        },
      });
    else await getCurrentWindow().destroy();
  }
  async function edit(command: Command) {
    if (!doc) return;
    await run(command.kind.replaceAll("_", " "), async () => {
      const s = await api<Session>("edit", doc.id, {
        command,
        revision: doc.revision,
      });
      update(s);
      if (command.kind === "transform" && selection) {
        const objects = await api<PdfObject[]>("inspect", s.id, { page });
        select(page, objects.find((o) => o.index === selection.index) ?? null);
      } else setSelection(null);
    });
  }
  async function editInline(p: number, o: PdfObject, value: string) {
    if (!doc) return false;
    const command = {
      kind: "edit_text",
      page: p,
      object: o.index,
      text: value,
      font: font === fontNames[0] ? null : font,
      size: Number(fontSize),
      color: rgba(),
    };
    const result = await run("Edit text", async () => {
      try {
        update(
          await api<Session>("edit", doc.id, {
            revision: doc.revision,
            command,
          }),
        );
        setSelection(null);
        return true;
      } catch (e) {
        if (String(e).includes("font")) {
          setText(value);
          setModal({
            title: "Choose a replacement font",
            description: `${o.font ?? "The embedded font"} cannot encode this text. Your original text has not been changed. Choose a font to apply your edit.`,
            fields: [
              {
                key: "font",
                label: "Replacement font",
                value: "Noto Sans",
                options: fontNames.slice(1),
              },
            ],
            actionLabel: "Apply text",
            submit: async (v) => {
              await edit({ ...command, font: v.font });
            },
          });
          return false;
        } else throw e;
      }
    });
    return result === true;
  }
  async function insertInline(p: number, rect: Rect, value: string) {
    if (!doc) return false;
    const result = await run("Add text", async () => {
      const next = await api<Session>("edit", doc.id, {
        revision: doc.revision,
        command: {
          kind: "add_paragraph",
          page: p,
          rect,
          text: value,
          font: font === fontNames[0] ? preferences.defaultFont : font,
          size: Number(fontSize),
          color: rgba(),
        },
      });
      update(next);
      setTool("select");
      const objects = await api<PdfObject[]>("inspect", next.id, { page: p });
      select(p, objects.at(-1) ?? null);
      return true;
    });
    return result === true;
  }
  async function applyTextProperties(style?: {
    font: string | null;
    size: number;
    color: number[];
  }) {
    if (!doc || !selection) return;
    if (
      !Number.isFinite(Number(fontSize)) ||
      Number(fontSize) < 1 ||
      Number(fontSize) > 500
    ) {
      report("Choose a text size between 1 and 500 pt.");
      return;
    }
    const index = selection.index;
    const command = {
      kind: "edit_text",
      page,
      object: index,
      text,
      font: font === fontNames[0] ? null : font,
      size: Number(fontSize),
      color: rgba(),
      ...style,
    };
    await run("Applying text properties", async () => {
      try {
        const next = await api<Session>("edit", doc.id, {
          revision: doc.revision,
          command,
        });
        update(next);
        const object = (
          await api<PdfObject[]>("inspect", next.id, { page })
        ).find((o) => o.index === index);
        select(page, object ?? null);
        notify("Text properties applied");
      } catch (e) {
        if (String(e).toLowerCase().includes("font")) {
          setModal({
            title: "Choose a replacement font",
            description:
              "The original embedded font cannot encode this edit. The document is unchanged. Choose a replacement to apply your text and properties.",
            fields: [
              {
                key: "font",
                label: "Replacement font",
                value: "Noto Sans",
                options: fontNames.slice(1),
              },
            ],
            actionLabel: "Apply text",
            submit: async (v) => {
              const next = await api<Session>("edit", doc.id, {
                revision: doc.revision,
                command: { ...command, font: v.font },
              });
              update(next);
              const object = (
                await api<PdfObject[]>("inspect", next.id, { page })
              ).find((o) => o.index === index);
              select(page, object ?? null);
              notify("Text properties applied");
            },
          });
        } else throw e;
      }
    });
  }
  async function copyObject(cut = false) {
    if (!doc || !selection) return;
    await run(cut ? "Cut object" : "Copy object", async () => {
      objectClipboard.current = await api<string>("copy_object", doc.id, {
        page,
        object: selection.index,
      });
      if (cut) {
        update(
          await api<Session>("edit", doc.id, {
            revision: doc.revision,
            command: { kind: "delete_object", page, object: selection.index },
          }),
        );
        setSelection(null);
      }
      notify(cut ? "Object cut" : "Object copied");
    });
  }
  async function pasteObject() {
    if (!doc || !objectClipboard.current) return;
    await run("Paste object", async () => {
      update(
        await api<Session>("paste_object", doc.id, {
          page,
          data: objectClipboard.current,
        }),
      );
      setSelection(null);
    });
  }
  async function transformObject(
    p: number,
    o: PdfObject,
    r: Rect,
    degrees = 0,
  ) {
    if (!doc) return;
    let result: Session | undefined;
    await run("Transform object", async () => {
      const angle = (degrees * Math.PI) / 180,
        cos = Math.cos(angle),
        sin = Math.sin(angle);
      const next = await api<Session>("edit", doc.id, {
        revision: doc.revision,
        command: {
          kind: "transform",
          page: p,
          object: o.index,
          dx:
            r.x +
            r.width / 2 -
            o.bounds.x -
            (r.width * cos - r.height * sin) / 2,
          dy:
            r.y +
            r.height / 2 -
            o.bounds.y -
            o.bounds.height +
            (r.width * sin + r.height * cos) / 2,
          sx: r.width / o.bounds.width,
          sy: r.height / o.bounds.height,
          degrees,
        },
      });
      result = next;
      update(next);
      const transformed =
        (await api<PdfObject[]>("inspect", next.id, { page: p })).find(
          (v) => v.index === o.index,
        ) ?? null;
      select(p, transformed);
    });
    return result;
  }
  async function save(mode = "save") {
    if (activeTextEditor.current && !(await activeTextEditor.current.commit()))
      return;
    if (!doc) return;
    if (mode === "as") {
      setSaveAs(true);
      return;
    }
    await run("Validating and saving", async () => {
      const s = await saveDocument(doc, mode);
      if (s) update(s);
      if (native && !s) return;
      notify(native ? "Document saved" : "PDF exported");
    });
  }
  async function history(action: "undo" | "redo") {
    if (!doc) return;
    await run(action, async () => {
      update(await api<Session>(action, doc.id));
      setSelection(null);
    });
  }
  function go(p: number) {
    if (!doc) return;
    p = Math.max(0, Math.min(doc.info.pages.length - 1, p));
    setPage(p);
    setSelectedPages([p]);
    document.getElementById(`page-${p}`)?.scrollIntoView({
      behavior: document.documentElement.dataset.motion === "reduced"
        ? "instant"
        : "smooth",
      block: "start",
    });
  }
  function fit() {
    if (!doc || !canvas.current) return;
    setZoom(
      Math.max(
        0.25,
        Math.min(
          2,
          (canvas.current.clientWidth - 96) / doc.info.pages[page].width,
        ),
      ),
    );
  }
  async function close(id: string) {
    const hadDraft = active === id && !!activeTextEditor.current;
    if (hadDraft && !(await activeTextEditor.current!.commit())) return;
    const s = docs.find((d) => d.id === id)!;
    const perform = async () => {
      await api("close", id, { discard: true });
      setDocs((old) => old.filter((d) => d.id !== id));
      if (active === id)
        setActive(docs.filter((d) => d.id !== id).at(-1)?.id ?? null);
    };
    if (s.dirty || hadDraft)
      setModal({
        title: "Keep your changes?",
        description: `${s.name} has unsaved edits. Save it before closing, or discard these changes.`,
        content: (
          <button
            className="primary"
            onClick={() =>
              void run("Saving document", async () => {
                const saved = await saveDocument(s);
                if (native && !saved) return;
                await perform();
                setModal(null);
              })
            }
          >
            Save and close
          </button>
        ),
        actionLabel: "Discard changes",
        danger: true,
        submit: perform,
      });
    else void run("Closing document", perform);
  }
  function select(p: number, o: PdfObject | null) {
    setPage(p);
    setSelection(o);
    if (o) {
      setText(o.text ?? "");
      setOpacity(String(Math.round(o.color[3] / 2.55)));
      setFont(fontNames[0]);
      setFontSize(String(o.size ?? 14));
      setColor(
        "#" +
          o.color
            .slice(0, 3)
            .map((c) => c.toString(16).padStart(2, "0"))
            .join(""),
      );
      setInspector(true);
    }
  }
  function rgba(
    alpha = Math.round(Number(opacity) * 2.55),
  ): [number, number, number, number] {
    return [
      parseInt(color.slice(1, 3), 16),
      parseInt(color.slice(3, 5), 16),
      parseInt(color.slice(5, 7), 16),
      alpha,
    ];
  }
  async function addImage(replace = false) {
    if (!doc) return;
    if (activeTextEditor.current && !(await activeTextEditor.current.commit()))
      return;
    setMode("Edit");
    setTool("select");
    await run("Importing image", async () => {
      const file = await pickFile("image/png,image/jpeg,image/webp,image/tiff");
      if (!file) return;
      const current = await api<Session>("view", doc.id);
      const command = {
        kind: "image",
        page,
        object: replace ? selection?.index : null,
        rect:
          replace && selection
            ? selection.bounds
            : { x: 72, y: 72, width: 240, height: 160 },
        data: await fileData(file),
      };
      const s = await api<Session>("edit", doc.id, {
        command,
        revision: current.revision,
      });
      update(s);
      setSelection(null);
    });
  }
  async function insertImageFile(file: File) {
    if (!doc) return;
    await run("Inserting image", async () => {
      const data = await fileData(file);
      const bitmap = await createImageBitmap(file);
      const w = Math.min(320, doc.info.pages[page].width - 144),
        h = (w * bitmap.height) / bitmap.width;
      bitmap.close();
      update(
        await api<Session>("edit", doc.id, {
          revision: doc.revision,
          command: {
            kind: "image",
            page,
            object: null,
            data,
            rect: { x: 72, y: 72, width: w, height: h },
          },
        }),
      );
      setMode("Edit");
      setTool("select");
    });
  }
  useEffect(() => {
    const paste = (event: ClipboardEvent) => {
      if (
        (event.target as HTMLElement).closest(
          "input,textarea,[contenteditable],dialog",
        )
      )
        return;
      const file = Array.from(event.clipboardData?.files ?? []).find((f) =>
        f.type.startsWith("image/"),
      );
      if (file && doc) {
        event.preventDefault();
        void insertImageFile(file);
      }
    };
    window.addEventListener("paste", paste);
    return () => window.removeEventListener("paste", paste);
  });
  function region(p: number, rect: Rect) {
    setPage(p);
    if (tool === "highlight") {
      void edit({
        kind: "annotation",
        page: p,
        rect,
        subtype: "Highlight",
        text: "",
        color: rgba(120),
      });
      return;
    }
    if (["rectangle", "ellipse", "line"].includes(tool)) {
      void edit({
        kind: "shape",
        page: p,
        rect,
        shape: tool,
        color: rgba(),
        width: Number(stroke),
        fill: false,
      });
      return;
    }
    if (tool === "crop") {
      setModal({
        title: "Crop page",
        description:
          "This changes the CropBox. Content outside the crop remains in the file; use redaction to remove sensitive information.",
        actionLabel: "Apply crop",
        submit: async () => {
          await edit({ kind: "crop", pages: [p], rect });
          setTool("select");
        },
      });
      return;
    }
    if (tool === "redact") {
      setModal({
        title: "Permanently redact this region",
        description:
          "Secure image redaction rebuilds every page as a flattened image. The marked pixels and all original text, forms, comments, attachments and metadata are removed from the output. Undo remains available in this local session until you close it. Keep a separate original if needed.",
        danger: true,
        actionLabel: "Apply redaction",
        submit: async () => {
          await run("Applying verified redaction", async () => {
            update(await api<Session>("redact", doc!.id, { page: p, rect }));
            setTool("select");
          });
        },
      });
      return;
    }
    if (tool === "field") {
      setModal({
        title: "Create form field",
        fields: [
          {
            key: "name",
            label: "Field name",
            value: "field_" + Date.now().toString(36),
          },
          {
            key: "type",
            label: "Type",
            value: "text",
            options: ["text", "checkbox"],
          },
          { key: "value", label: "Default value", value: "" },
        ],
        actionLabel: "Create field",
        submit: async (v) => {
          await edit({
            kind: "field",
            page: p,
            rect,
            name: v.name,
            field_type: v.type,
            value: v.value,
            required: false,
          });
          setTool("select");
          setPanel("Forms");
        },
      });
      return;
    }
    const isLink = tool === "link";
    const isNote = tool === "note";
    if (!isLink && !isNote) return;
    setModal({
      title: isLink ? "Add hyperlink" : "Add comment",
      fields: [
        {
          key: "text",
          label: isLink ? "Web address" : "Comment",
          value: isLink ? "https://" : "",
          type: isLink ? "url" : "textarea",
        },
      ],
      actionLabel: "Add to page",
      submit: async (v) => {
        if (isLink) await edit({ kind: "link", page: p, rect, url: v.text });
        else if (isNote)
          await edit({
            kind: "annotation",
            page: p,
            rect,
            subtype: "Text",
            text: v.text,
            color: [245, 199, 73, 255],
          });
        setTool("select");
      },
    });
  }
  async function merge() {
    if (!doc) {
      await open();
      return;
    }
    await run("Opening PDF to insert", async () => {
      const file = await pickFile();
      if (file)
        setInsertSource(
          await api<Session>("import", undefined, {
            name: file.name,
            data: await fileData(file),
          }),
        );
    });
  }
  function rangeDialog(
    title: string,
    actionLabel: string,
    submit: (pages: number[]) => Promise<void>,
  ) {
    if (!doc) return;
    setModal({
      title,
      fields: [
        {
          key: "pages",
          label: "Page range",
          value: selectedPages.map((p) => p + 1).join(", "),
        },
      ],
      description: "Use a range such as 1, 3-5, or “all”.",
      actionLabel,
      submit: async (v) => submit(parsePages(v.pages, doc.info.pages.length)),
    });
  }
  function watermark() {
    if (!doc) return;
    setModal({
      title: "Watermark",
      description: "Adds real text objects to the selected pages.",
      fields: [
        { key: "text", label: "Watermark text", value: "DRAFT" },
        { key: "pages", label: "Pages", value: "all" },
        { key: "size", label: "Font size (pt)", value: "54", type: "number" },
        { key: "opacity", label: "Opacity (%)", value: "25", type: "number" },
        {
          key: "rotation",
          label: "Rotation (degrees)",
          value: "35",
          type: "number",
        },
      ],
      actionLabel: "Add watermark",
      submit: async (v) =>
        edit({
          kind: "watermark",
          text: v.text,
          size: Number(v.size),
          opacity: Math.round(
            Math.max(0, Math.min(100, Number(v.opacity))) * 2.55,
          ),
          degrees: Number(v.rotation),
          pages: parsePages(v.pages, doc.info.pages.length),
        }),
    });
  }
  function numbers() {
    if (!doc) return;
    setModal({
      title: "Page numbers",
      fields: [
        { key: "prefix", label: "Prefix", value: "" },
        { key: "start", label: "Start at", value: "1", type: "number" },
        { key: "pages", label: "Pages", value: "all" },
      ],
      actionLabel: "Add page numbers",
      submit: async (v) =>
        edit({
          kind: "page_numbers",
          prefix: v.prefix,
          start: Number(v.start),
          pages: parsePages(v.pages, doc.info.pages.length),
        }),
    });
  }
  function metadata() {
    if (!doc) return;
    setModal({
      title: "Document properties",
      description: `PDF ${doc.info.metadata.version} · ${doc.info.pages.length} pages · ${formatBytes(doc.info.bytes)} · ${doc.info.metadata.tagged ? "Tagged" : "Untagged"}`,
      fields: [
        "Title",
        "Author",
        "Subject",
        "Keywords",
        "Creator",
        "Producer",
      ].map((key) => ({
        key,
        label: key,
        value: doc.info.metadata.info[key] ?? "",
      })),
      actionLabel: "Save properties",
      submit: async (values) => edit({ kind: "metadata", values }),
    });
  }
  function protect() {
    if (!doc) return;
    setModal({
      title: "Protect a copy",
      description:
        "Export a separate PDF with AES-256 encryption. Keep your password somewhere safe.",
      fields: [
        {
          key: "password",
          label: "Open password (at least 8 characters)",
          value: "",
          type: "password",
        },
        {
          key: "confirm",
          label: "Confirm password",
          value: "",
          type: "password",
        },
      ],
      actionLabel: "Export protected PDF",
      submit: async (v) => {
        if (v.password !== v.confirm)
          throw new Error("The passwords do not match.");
        await run("Encrypting PDF", async () => {
          await download(
            await api<string>("protect", doc.id, { password: v.password }),
            doc.name.replace(/\.pdf$/i, "-protected.pdf"),
          );
        });
      },
    });
  }
  async function compare() {
    if (!doc) return;
    await run("Opening comparison", async () => {
      const file = await pickFile();
      if (file)
        setCompareSource(
          await api<Session>("import", undefined, {
            name: file.name,
            data: await fileData(file),
          }),
        );
    });
  }
  function sanitize() {
    setModal({
      title: "Remove private document data",
      description:
        "Removes metadata, comments, form fields and values, attachments, bookmarks, and common JavaScript / launch actions. Hidden page objects and optional-content layers are not removed by this cleanup. Use secure image redaction for a fully flattened output.",
      actionLabel: "Remove data",
      danger: true,
      submit: async () => edit({ kind: "sanitize" }),
    });
  }
  async function exportImage() {
    if (!doc) return;
    await run("Rendering page image", async () => {
      const image = await api<string>("render", doc.id, {
        page,
        width: Math.min(4096, Math.round(doc.info.pages[page].width * 2)),
      });
      await download(
        image.split(",")[1],
        doc.name.replace(/\.pdf$/i, `-page-${page + 1}.png`),
        "image/png",
      );
    });
  }
  const actions = [
    {
      name: "Find & replace text",
      group: "Edit",
      icon: Search,
      needs: true,
      run: () => setFindReplace(true),
    },
    {
      name: "Page contents",
      group: "Edit",
      icon: Layers,
      needs: true,
      run: async () => {
        if (!(await chooseMode("Edit"))) return;
        setPanel("Contents");
        setLeft(true);
        setTool("select");
      },
    },
    {
      name: "Insert current date",
      group: "Edit",
      icon: Type,
      needs: true,
      run: () =>
        void insertInline(
          page,
          { x: 72, y: 100, width: 230, height: 30 },
          new Date().toLocaleDateString(),
        ),
    },
    {
      name: "Browse all tools",
      group: "Workspace",
      icon: Grid2X2,
      run: () => setToolLibrary(true),
    },
    {
      name: "Inspect document fonts and objects",
      group: "Review",
      icon: Type,
      needs: true,
      run: () => setInspectDocument(true),
    },
    {
      name: "Settings",
      group: "Workspace",
      icon: Settings2,
      run: settings,
      shortcut: "Ctrl ,",
    },
    {
      name: "Sign with certificate",
      group: "Sign",
      icon: ShieldCheck,
      needs: true,
      run: () => {
        if (!native) {
          notify(
            "Certificate signing is available in the desktop application.",
          );
          return;
        }
        setModal({
          title: "Sign with certificate",
          description:
            "Choose a signing identity in Windows and save a signed copy. Offline validation checks document integrity; certificate trust and revocation are not checked.",
          actionLabel: "Choose certificate",
          submit: async () => {
            await run("Signing document", async () => {
              const result = await signDocument(doc!.id);
              notify(
                `Signed by ${result.signer}. Integrity ${result.integrity ? "verified" : "not verified"}.`,
              );
            });
          },
        });
      },
    },
    {
      name: "OCR searchable text",
      group: "Convert",
      icon: ScanLine,
      needs: true,
      run: () =>
        setModal({
          title: "Recognize text offline",
          description:
            "Add an invisible, selectable text layer using bundled Tesseract. For scanned pages; running OCR on existing text may duplicate it.",
          fields: [
            { key: "pages", label: "Pages", value: String(page + 1) },
            {
              key: "language",
              label: "Language",
              value: preferences.ocrLanguage,
              options: ["eng", "por", "spa"],
            },
          ],
          actionLabel: "Recognize text",
          submit: async (v) => {
            setModal(null);
            const controller = new AbortController();
            ocrCancel.current = controller;
            await run("Starting OCR", async () => {
              try {
                update(
                  await runOcr(
                    doc!,
                    parsePages(v.pages, doc!.info.pages.length),
                    v.language,
                    setBusy,
                    controller.signal,
                  ),
                );
                notify(
                  "OCR text layer added. Review recognition accuracy before saving.",
                );
              } finally {
                ocrCancel.current = null;
                update(await api<Session>("view", doc!.id));
              }
            });
          },
        }),
    },
    { name: "Open PDF", group: "File", icon: FolderOpen, run: open },
    { name: "Create PDF", group: "File", icon: FilePlus2, run: create },
    { name: "Save", group: "File", icon: Save, run: () => save(), needs: true },
    {
      name: "Save as",
      group: "File",
      icon: Copy,
      run: () => save("as"),
      needs: true,
    },
    {
      name: "Save copy",
      group: "File",
      icon: Copy,
      run: () => save("copy"),
      needs: true,
    },
    {
      name: "Insert image",
      group: "Edit",
      icon: ImagePlus,
      run: () => addImage(),
      needs: true,
    },
    {
      name: "Add text",
      group: "Edit",
      icon: Type,
      run: () => activateTool("text"),
      needs: true,
    },
    {
      name: "Draw",
      group: "Annotate",
      icon: PenLine,
      run: async () => {
        if (!(await chooseMode("Annotate"))) return;
        setTool("draw");
        setColor("#243047");
      },
      needs: true,
    },
    {
      name: "Highlight",
      group: "Annotate",
      icon: Highlighter,
      run: () => activateTool("highlight", "Annotate"),
      needs: true,
    },
    {
      name: "Add comment",
      group: "Annotate",
      icon: MessageSquare,
      run: () => activateTool("note", "Annotate"),
      needs: true,
    },
    { name: "Insert PDF / Merge", group: "Pages", icon: Layers, run: merge },
    {
      name: "Rotate selected pages",
      group: "Pages",
      icon: RotateCw,
      run: () => edit({ kind: "rotate", pages: selectedPages, degrees: 90 }),
      needs: true,
    },
    {
      name: "Extract pages",
      group: "Pages",
      icon: Download,
      run: () =>
        rangeDialog("Extract pages", "Export pages", async (pages) => {
          await run("Extracting pages", async () =>
            download(
              await api<string>("extract", doc!.id, { pages }),
              "Extracted pages.pdf",
            ),
          );
        }),
      needs: true,
    },
    {
      name: "Crop page",
      group: "Pages",
      icon: Crop,
      run: () => activateTool("crop"),
      needs: true,
    },
    {
      name: "Insert blank page",
      group: "Pages",
      icon: FilePlus2,
      run: () =>
        edit({
          kind: "blank_page",
          after: page,
          width: 595.28,
          height: 841.89,
        }),
      needs: true,
    },
    {
      name: "Add page numbers",
      group: "Pages",
      icon: Hash,
      run: numbers,
      needs: true,
    },
    {
      name: "Add watermark",
      group: "Pages",
      icon: Stamp,
      run: watermark,
      needs: true,
    },
    {
      name: "Create form field",
      group: "Forms",
      icon: CheckSquare,
      run: () => activateTool("field", "Forms"),
      needs: true,
    },
    {
      name: "Fill form fields",
      group: "Forms",
      icon: CheckSquare,
      run: async () => {
        if (!(await chooseMode("Forms"))) return;
        setPanel("Forms");
        setLeft(true);
      },
      needs: true,
    },
    {
      name: "Flatten form fields",
      group: "Forms",
      icon: Layers,
      run: () =>
        setModal({
          title: "Flatten form fields",
          description:
            "Field appearances become page content. The exported form will no longer be interactive.",
          actionLabel: "Flatten",
          submit: async () => edit({ kind: "flatten_forms" }),
        }),
      needs: true,
    },
    {
      name: "Signature Studio",
      group: "Sign",
      icon: PenLine,
      run: () => {
        setMode("Sign");
        setSignatureStart("Type");
        setSignatureStudio(true);
      },
      needs: false,
    },
    {
      name: "Ink Studio · refine a drawing",
      group: "Create",
      icon: PenLine,
      run: () => {
        setSignatureStart("Draw");
        setSignatureStudio(true);
      },
      needs: false,
    },
    {
      name: "Export page as PNG",
      group: "Convert",
      icon: ImagePlus,
      run: exportImage,
      needs: true,
    },
    {
      name: "Export text",
      group: "Convert",
      icon: FileText,
      run: () =>
        run("Extracting text", async () =>
          download(
            await api<string>("export_text", doc!.id),
            doc!.name.replace(/\.pdf$/i, ".txt"),
            "text/plain",
            false,
          ),
        ),
      needs: true,
    },
    {
      name: "Compress PDF",
      group: "Optimize",
      icon: SlidersHorizontal,
      run: () =>
        setModal({
          title: "Compress PDF",
          description:
            "Lossless compression rewrites object streams and recompresses data. Text, images and page content retain their quality. The result may be larger for an already optimized file.",
          content: (
            <dl className="document-details">
              <div>
                <dt>Current size</dt>
                <dd>{formatBytes(doc!.info.bytes)}</dd>
              </div>
              <div>
                <dt>Method</dt>
                <dd>Lossless · qpdf</dd>
              </div>
            </dl>
          ),
          actionLabel: "Compress",
          submit: async () => {
            await run("Compressing PDF", async () => {
              const before = doc!.info.bytes;
              const result = await api<Session>("optimize", doc!.id);
              update(result);
              notify(
                `${formatBytes(before)} → ${formatBytes(result.info.bytes)} · Lossless compression complete`,
              );
            });
          },
        }),
      needs: true,
    },
    {
      name: "Validate PDF structure",
      group: "Advanced",
      icon: ShieldCheck,
      needs: true,
      run: () =>
        run("Validating PDF", async () => {
          const result = await api<{
            valid: boolean;
            warnings: boolean;
            report: string;
          }>("validate", doc!.id);
          setModal({
            title: "PDF validation",
            content: <pre className="diagnostics">{result.report}</pre>,
          });
        }),
    },
    {
      name: "Repair PDF structure",
      group: "Advanced",
      icon: SlidersHorizontal,
      needs: true,
      run: () =>
        setModal({
          title: "Repair PDF structure",
          description:
            "Rebuild recoverable PDF structure using qpdf. Review the result before saving; undo is available.",
          actionLabel: "Repair",
          submit: async () => {
            await run("Repairing PDF", async () =>
              update(await api<Session>("repair", doc!.id)),
            );
          },
        }),
    },

    {
      name: "Secure image redaction",
      group: "Protect",
      icon: Square,
      run: () => activateTool("redact", "Review"),
      needs: true,
    },
    {
      name: "Password-protect a copy",
      group: "Protect",
      icon: LockKeyhole,
      run: protect,
      needs: true,
    },
    {
      name: "Remove private data",
      group: "Protect",
      icon: ShieldCheck,
      run: sanitize,
      needs: true,
    },
    {
      name: "Compare PDFs",
      group: "Advanced",
      icon: Columns2,
      run: compare,
      needs: true,
    },
    {
      name: "Document properties",
      group: "Advanced",
      icon: Info,
      run: metadata,
      needs: true,
    },
    {
      name: "Focus mode",
      group: "View",
      icon: Maximize,
      run: () => {
        setInspector((v) => !v);
        setLeft((v) => !v);
      },
      needs: true,
    },
  ];
  useEffect(() => {
    if (!native) return;
    const p = getCurrentWindow().onDragDropEvent((event) => {
      if (event.payload.type === "over") setDropping(true);
      if (event.payload.type === "leave") setDropping(false);
      if (event.payload.type === "drop") {
        setDropping(false);
        void run("Opening dropped PDFs", async () => {
          const values = await invoke<Session[]>("open_dropped", {
            paths: event.payload.type === "drop" ? event.payload.paths : [],
          });
          values.forEach(update);
        });
      }
    });
    return () => {
      void p.then((f) => f());
    };
  }, []);
  useEffect(() => {
    if (!native) return;
    void getCurrentWindow().setTitle(doc ? `Papier — ${doc.name}` : "Papier");
  }, [doc?.name]);
  useEffect(() => {
    if (!native) return;
    const promise = getCurrentWindow().onCloseRequested((e) => {
      e.preventDefault();
      void closeWindow().catch(report);
    });
    return () => {
      void promise.then((f) => f());
    };
  });
  useEffect(() => {
    const system = matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      (document.documentElement.dataset.theme =
        theme === "System"
          ? system.matches
            ? "dark"
            : "light"
          : theme.toLowerCase());
    apply();
    system.addEventListener("change", apply);
    localStorage.setItem("studio-theme", theme);
    return () => system.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => {
    api<Session[]>("recovery_list").then(setRecovery).catch(report);
  }, []);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (docs.some((d) => d.dirty)) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [docs]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("dialog,[role=menu]")) return;
      const input = (e.target as HTMLElement).closest("input,textarea,select");
      if (doc && !input && e.altKey && /^[1-8]$/.test(e.key)) {
        e.preventDefault();
        chooseMode(
          [
            "Edit",
            "Insert",
            "Annotate",
            "Pages",
            "Forms",
            "Sign",
            "Review",
            "Export",
          ][Number(e.key) - 1],
        );
        return;
      }
      if (e.key === "Escape") {
        setTool("select");
        setSelection(null);
        setPalette(false);
        return;
      }
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === ",") {
          e.preventDefault();
          settings();
          return;
        }
        if (!input && selection && ["c", "x"].includes(key)) {
          e.preventDefault();
          void copyObject(key === "x");
          return;
        }
        if (!input && key === "v" && objectClipboard.current) {
          e.preventDefault();
          void pasteObject();
          return;
        }
        if (!input && key === "d" && selection) {
          e.preventDefault();
          void edit({
            kind: "duplicate_object",
            page,
            object: selection.index,
          });
          return;
        }

        if (
          [
            "o",
            "n",
            "s",
            "z",
            "y",
            "f",
            "k",
            "w",
            "0",
            "+",
            "=",
            "-",
            "tab",
          ].includes(key) ||
          (key === "p" && e.shiftKey)
        ) {
          e.preventDefault();
          if (key === "n") void create();
          if (key === "o") void open();
          if (key === "s") void save(e.shiftKey ? "as" : "save");
          if (key === "z" && !input) void history(e.shiftKey ? "redo" : "undo");
          if (key === "y" && !input) void history("redo");
          if (key === "f") setSearchOpen((v) => !v);
          if (key === "k" || key === "p") {
            setPalette((v) => !v);
            setQuery("");
          }
          if (key === "w" && doc) close(doc.id);
          if (key === "0") fit();
          if (key === "+" || key === "=") setZoom((z) => Math.min(4, z + 0.1));
          if (key === "-") setZoom((z) => Math.max(0.25, z - 0.1));
          if (key === "tab" && docs.length) {
            const index = docs.findIndex((d) => d.id === active);
            setActive(
              docs[(index + (e.shiftKey ? docs.length - 1 : 1)) % docs.length]
                .id,
            );
          }
        }
      } else if (
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key) &&
        selection &&
        !input
      ) {
        e.preventDefault();
        const n = preferences.nudge * (e.shiftKey ? 10 : 1);
        void transformObject(page, selection, {
          ...selection.bounds,
          x:
            selection.bounds.x +
            (e.key === "ArrowLeft" ? -n : e.key === "ArrowRight" ? n : 0),
          y:
            selection.bounds.y +
            (e.key === "ArrowUp" ? -n : e.key === "ArrowDown" ? n : 0),
        });
      } else if (e.key === "Delete" && selection && !input) {
        void edit({ kind: "delete_object", page, object: selection.index });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });
  useEffect(() => {
    if (!doc || !search.trim()) {
      setResults([]);
      return;
    }
    let valid = true;
    const timeout = setTimeout(
      () =>
        api<string[]>("text", doc.id)
          .then((texts) => {
            if (valid)
              setResults(
                texts.flatMap((text, page) =>
                  text.toLowerCase().includes(search.toLowerCase())
                    ? [{ page, text }]
                    : [],
                ),
              );
          })
          .catch(report),
      300,
    );
    return () => {
      valid = false;
      clearTimeout(timeout);
    };
  }, [search, doc?.id, doc?.revision]);
  useEffect(() => {
    setSelection(null);
    setPage(0);
    setSelectedPages([0]);
  }, [active]);
  async function dropped(files: FileList | null) {
    if (!files) return;
    setDropping(false);
    const image = Array.from(files).find((f) => f.type.startsWith("image/"));
    if (image && doc) {
      await insertImageFile(image);
      return;
    }
    await run("Opening local documents", async () => {
      for (const file of Array.from(files)) {
        if (file.name.toLowerCase().endsWith(".pdf"))
          update(
            await api<Session>("import", undefined, {
              name: file.name,
              data: await fileData(file),
            }),
          );
      }
    });
  }
  const pageActions = (
    <>
      <IconButton
        label="Rotate selected pages"
        onClick={() =>
          void edit({ kind: "rotate", pages: selectedPages, degrees: 90 })
        }
      >
        <RotateCw size={15} />
      </IconButton>
      <IconButton
        label="Duplicate page"
        onClick={() => void edit({ kind: "duplicate_page", page })}
      >
        <Copy size={15} />
      </IconButton>
      <IconButton
        label="Delete selected pages"
        disabled={!doc || selectedPages.length >= doc.info.pages.length}
        onClick={() =>
          void edit({ kind: "delete_pages", pages: selectedPages })
        }
      >
        <Trash2 size={15} />
      </IconButton>
    </>
  );
  return (
    <div
      data-busy={!!busy}
      className={`app ${doc ? "document-mode" : "home-mode"} ${dropping ? "dropping" : ""}`}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDropping(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node))
          setDropping(false);
      }}
      onDrop={(e) => {
        if (e.dataTransfer.files.length) {
          e.preventDefault();
          void dropped(e.dataTransfer.files);
        }
      }}
    >
      <header
        className="topbar"
        data-tauri-drag-region
        onDoubleClick={(e) => {
          if (native && e.target === e.currentTarget)
            void getCurrentWindow().toggleMaximize();
        }}
      >
        <button
          className="brand"
          aria-label="Home"
          onClick={async () => {
            if (
              activeTextEditor.current &&
              !(await activeTextEditor.current.commit())
            )
              return;
            setActive(null);
          }}
          title="Papier Home"
        >
          <Mark />
          <span>{brand.name}</span>
        </button>
        <div
          className="document-tabs"
          role="tablist"
          aria-label="Open documents"
        >
          {docs.map((d) => (
            <div
              className={`document-tab ${active === d.id ? "current" : ""}`}
              key={d.id}
              draggable
              onDragStart={() => (dragTab.current = d.id)}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add("drag-target");
              }}
              onDragLeave={(e) =>
                e.currentTarget.classList.remove("drag-target")
              }
              onDragEnd={(e) => e.currentTarget.classList.remove("drag-target")}
              onDrop={() => {
                const from = docs.findIndex((s) => s.id === dragTab.current),
                  to = docs.findIndex((s) => s.id === d.id);
                if (from >= 0) {
                  const next = [...docs];
                  next.splice(to, 0, next.splice(from, 1)[0]);
                  setDocs(next);
                }
              }}
              onAuxClick={(e) => {
                if (e.button === 1) close(d.id);
              }}
            >
              <button
                role="tab"
                aria-selected={active === d.id}
                onClick={async () => {
                  if (
                    activeTextEditor.current &&
                    !(await activeTextEditor.current.commit())
                  )
                    return;
                  setActive(d.id);
                }}
              >
                <FileText size={14} />
                <span>{d.name}</span>
                {d.dirty && (
                  <span className="dirty-dot" aria-label="Unsaved changes" />
                )}
              </button>
              <button
                aria-label={`Close ${d.name}`}
                onClick={() => close(d.id)}
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
        {doc && (
          <div className="top-actions">
            <IconButton label="Open PDF (Ctrl+O)" onClick={() => void open()}>
              <Plus size={18} />
            </IconButton>
            <span className="divider" />
            <button
              className="global-search"
              aria-label="Search all tools (Ctrl+K)"
              onClick={() => {
                setPalette(true);
                setQuery("");
              }}
            >
              <Search size={15} />
              <span>Find a tool</span>
              <kbd>Ctrl K</kbd>
            </button>
            <button
              className="primary compact"
              disabled={!doc || !!busy}
              onClick={() => void save()}
            >
              <Save size={15} />
              Save<span className="key-hint">Ctrl S</span>
            </button>
          </div>
        )}
        <button
          className="utility-settings"
          onClick={settings}
          title="Settings (Ctrl+,)"
        >
          <Settings2 size={15} />
          <span>Settings</span>
        </button>
        <WindowControls
          onClose={() => void closeWindow().catch(report)}
          onError={report}
        />
      </header>
      <div
        data-navigation={panel}
        className={`workspace ${left ? "navigation-open" : ""} ${inspector ? "properties-open" : ""}`}
      >
        {!doc ? (
          <HomeScreen
            onOpen={() => void open()}
            onNew={() => void create()}
            onSignature={(draw = false) => {
              setSignatureStart(draw ? "Draw" : "Type");
              setSignatureStudio(true);
            }}
            onTemplate={(name) => {
              setTemplateQuery(name);
              setNewDocument(true);
            }}
            onSession={(s) => {
              update(s);
              setMode("Edit");
              setPage(0);
              setSelection(null);
            }}
            onError={report}
            onSettings={settings}
            onCommands={() => setPalette(true)}
            recovery={recovery}
            onRecover={(id) =>
              void run("Recovering document", async () =>
                update(await api<Session>("recover", id)),
              )
            }
          />
        ) : (
          <>
            {left && (
              <aside className="navigation-panel">
                <div className="panel-heading">
                  <Select
                    value={panel}
                    onChange={setPanel}
                    options={[
                      "Contents",
                      "Pages",
                      "Bookmarks",
                      "Comments",
                      "Forms",
                      "Signatures",
                    ]}
                    label="Navigation panel"
                  />
                  <IconButton
                    label="Hide navigation"
                    onClick={() => setLeft(false)}
                  >
                    <PanelLeftClose size={16} />
                  </IconButton>
                </div>
                {panel === "Contents" ? (
                  <PageContents
                    doc={doc}
                    page={page}
                    selected={selection}
                    onSelect={(p, o) => {
                      setTool("select");
                      select(p, o);
                      setInspector(true);
                    }}
                  />
                ) : panel === "Pages" ? (
                  <>
                    <div className="page-panel-tools">
                      <span>{doc.info.pages.length} pages</span>
                      <div>{pageActions}</div>
                    </div>
                    <div className="thumbnails">
                      {doc.info.pages.map((_, i) => (
                        <div
                          key={i}
                          className={`thumbnail ${selectedPages.includes(i) ? "selected" : ""}`}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setPage(i);
                            if (!selectedPages.includes(i))
                              setSelectedPages([i]);
                            setContext({ x: e.clientX, y: e.clientY, page: i });
                          }}
                          draggable
                          onDragStart={() => (dragPage.current = i)}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.currentTarget.classList.add("drag-target");
                          }}
                          onDragLeave={(e) =>
                            e.currentTarget.classList.remove("drag-target")
                          }
                          onDragEnd={(e) =>
                            e.currentTarget.classList.remove("drag-target")
                          }
                          onDrop={(e) => {
                            e.preventDefault();
                            e.currentTarget.classList.remove("drag-target");
                            if (dragPage.current !== null) {
                              const order = reorderPages(
                                doc.info.pages.length,
                                selectedPages,
                                dragPage.current,
                                i,
                              );
                              void edit({ kind: "reorder", order });
                              dragPage.current = null;
                            }
                          }}
                        >
                          <button
                            aria-label={`Go to page ${i + 1}`}
                            onClick={(e) => {
                              if (e.ctrlKey)
                                setSelectedPages((old) =>
                                  old.includes(i)
                                    ? old.filter((v) => v !== i)
                                    : [...old, i],
                                );
                              else if (e.shiftKey)
                                setSelectedPages(
                                  Array.from(
                                    { length: Math.abs(i - page) + 1 },
                                    (_, j) => Math.min(i, page) + j,
                                  ),
                                );
                              else go(i);
                            }}
                          >
                            <Thumbnail doc={doc} page={i} />
                            <span className="thumb-number">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            {selectedPages.includes(i) && (
                              <span className="thumb-check">
                                <Check size={10} />
                              </span>
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      className="panel-bottom-action"
                      onClick={() =>
                        void edit({
                          kind: "blank_page",
                          after: page,
                          width: 595.28,
                          height: 841.89,
                        })
                      }
                    >
                      <Plus size={15} />
                      Add a page
                    </button>
                  </>
                ) : (
                  <div className="panel-content">
                    {panel === "Bookmarks" && (
                      <>
                        <button
                          className="secondary full"
                          onClick={() =>
                            setModal({
                              title: "Add bookmark",
                              fields: [
                                {
                                  key: "title",
                                  label: "Bookmark title",
                                  value: `Page ${page + 1}`,
                                },
                              ],
                              actionLabel: "Add bookmark",
                              submit: async (v) =>
                                edit({
                                  kind: "bookmark",
                                  title: v.title,
                                  page,
                                }),
                            })
                          }
                        >
                          <Plus size={15} />
                          Add bookmark
                        </button>
                        {doc.info.metadata.bookmarks.length === 0 ? (
                          <Empty
                            icon={BookOpen}
                            title="No bookmarks"
                            text="Add a bookmark to keep an important page close."
                          />
                        ) : (
                          doc.info.metadata.bookmarks.map((b, i) => (
                            <div key={i} className="panel-item">
                              <button onClick={() => go(b.page ?? 0)}>
                                <BookOpen size={14} />
                                {b.title}
                              </button>
                              <IconButton
                                label={`Delete bookmark ${b.title}`}
                                onClick={() =>
                                  void edit({
                                    kind: "delete_bookmark",
                                    index: i,
                                  })
                                }
                              >
                                <X size={12} />
                              </IconButton>
                            </div>
                          ))
                        )}
                      </>
                    )}
                    {panel === "Comments" &&
                      (doc.info.metadata.annotations.length ? (
                        doc.info.metadata.annotations.map((a) => (
                          <article
                            className="comment"
                            key={`${a.page}-${a.index}`}
                          >
                            <header>
                              <span className="avatar">L</span>
                              <strong>{a.name || "Unspecified author"}</strong>
                              <IconButton
                                label="Delete annotation"
                                onClick={() =>
                                  void edit({
                                    kind: "delete_annotation",
                                    page: a.page,
                                    index: a.index,
                                  })
                                }
                              >
                                <Trash2 size={13} />
                              </IconButton>
                            </header>
                            <p>{a.text || a.subtype}</p>
                            <button onClick={() => go(a.page)}>
                              Page {a.page + 1}
                              <ArrowUpRight size={12} />
                            </button>
                          </article>
                        ))
                      ) : (
                        <Empty
                          icon={MessageSquare}
                          title="No comments yet"
                          text="Select the comment tool and click on the page to add a comment."
                        />
                      ))}
                    {panel === "Forms" && (
                      <>
                        <button
                          className="secondary full"
                          onClick={() => setTool("field")}
                        >
                          <Plus size={15} />
                          Create field
                        </button>
                        {doc.info.metadata.fields.map((f) => (
                          <Field key={`${f.page}-${f.index}`} label={f.name}>
                            <input
                              defaultValue={f.value}
                              key={`${doc.revision}-${f.name}`}
                              onBlur={(e) => {
                                if (e.target.value !== f.value)
                                  void edit({
                                    kind: "fill_field",
                                    name: f.name,
                                    value: e.target.value,
                                  });
                              }}
                              aria-label={`Value for ${f.name}`}
                            />
                          </Field>
                        ))}
                        {!doc.info.metadata.fields.length && (
                          <Empty
                            icon={CheckSquare}
                            title="No form fields"
                            text="Add a text field or checkbox, then fill it here."
                          />
                        )}
                      </>
                    )}
                    {panel === "Signatures" && (
                      <Empty
                        icon={ShieldCheck}
                        title={
                          doc.info.signatures
                            ? `${doc.info.signatures} signature(s) detected`
                            : "No digital signatures"
                        }
                        text={
                          doc.info.signatures
                            ? "Cryptographic validity has not been verified. Editing may invalidate these signatures."
                            : "An electronic mark is not a certificate-based digital signature."
                        }
                      />
                    )}
                  </div>
                )}
              </aside>
            )}
            <main className="editor">
              <div className="workspace-compass">
                <button
                  className="compass-pages"
                  aria-label={left ? "Hide navigation" : "Show navigation"}
                  aria-expanded={left}
                  onClick={() => setLeft(!left)}
                >
                  <Layers size={15} />
                  <span>{panel}</span>
                  <strong>
                    {page + 1}
                    <small> / {doc.info.pages.length}</small>
                  </strong>
                </button>
                <span className="compass-caption">
                  {mode === "Pages"
                    ? "Arrange your document"
                    : selection
                      ? `${selection.kind} selected`
                      : "Your document. Your space."}
                </span>
                <button
                  className="compass-properties"
                  aria-expanded={inspector}
                  onClick={() => setInspector(!inspector)}
                >
                  <Settings2 size={14} />
                  {selection ? "Object" : "Document"}
                  <ChevronRight size={12} />
                </button>
              </div>
              <div className="command-bridge">
                <div className="editor-toolbar">
                  <div className="toolbar-group">
                    <TaskMenu
                      value={
                        mode === "Draw"
                          ? "Annotate"
                          : mode === "Redact"
                            ? "Review"
                            : mode
                      }
                      onChange={chooseMode}
                      onBrowse={() => setToolLibrary(true)}
                    />
                    <span className="divider" />
                    {["Insert", "Export", "Review"].includes(mode) ? (
                      <>
                        {(mode === "Insert"
                          ? [
                              "Add text",
                              "Insert image",
                              "Insert PDF / Merge",
                              "Insert blank page",
                              "Add watermark",
                            ]
                          : mode === "Export"
                            ? [
                                "Save as",
                                "Export page as PNG",
                                "Export text",
                                "Compress PDF",
                              ]
                            : [
                                "Add comment",
                                "Compare PDFs",
                                "OCR searchable text",
                                "Validate PDF structure",
                              ]
                        ).map((name) => {
                          const action = actions.find((a) => a.name === name)!;
                          return (
                            <button
                              key={name}
                              className="text-button"
                              onClick={() => void action.run()}
                            >
                              <action.icon size={14} />
                              {name
                                .replace("Insert PDF / Merge", "PDF pages")
                                .replace("Validate PDF structure", "Validate")
                                .replace(
                                  "OCR searchable text",
                                  "Recognize text",
                                )
                                .replace("Export page as ", "")
                                .replace("Export text", "Text")}
                            </button>
                          );
                        })}
                      </>
                    ) : selection?.kind === "text" || tool === "text" ? (
                      <>
                        <span className="toolbar-font">
                          <FontPicker
                            value={font}
                            onChange={setFont}

                            label="Toolbar font"
                          />
                        </span>
                        <input
                          className="toolbar-number"
                          type="number"
                          aria-label="Toolbar font size"
                          min="1"
                          max="500"
                          value={fontSize}
                          onChange={(e) => setFontSize(e.target.value)}
                        />
                        <span className="context-label">pt</span>
                        <input
                          className="toolbar-color"
                          aria-label="Text fill"
                          type="color"
                          value={color}
                          onChange={(e) => setColor(e.target.value)}
                        />
                        {selection && (
                          <button
                            className="text-button primary"
                            aria-label="Apply typography"
                            onClick={() => void applyTextProperties()}
                          >
                            <Check size={15} /> Apply
                          </button>
                        )}
                      </>
                    ) : mode === "Pages" ? (
                      <>
                        {pageActions}
                        <button
                          className="text-button"
                          onClick={() => {
                            setMode("Edit");
                            setTool("crop");
                          }}
                        >
                          <Crop size={14} />
                          Crop
                        </button>
                        <button
                          className="text-button"
                          onClick={() => void merge()}
                        >
                          <Layers size={14} />
                          Merge
                        </button>
                        <button
                          className="text-button"
                          onClick={() =>
                            actions
                              .find((a) => a.name === "Extract pages")
                              ?.run()
                          }
                        >
                          Extract
                        </button>
                      </>
                    ) : mode === "Annotate" ||
                      mode === "Draw" ||
                      mode === "Sign" ? (
                      <>
                        {mode === "Annotate" &&
                          tools
                            .filter((t) =>
                              [
                                "highlight",
                                "draw",
                                "note",
                                "rectangle",
                                "ellipse",
                                "link",
                              ].includes(t.id),
                            )
                            .map((t) => (
                              <IconButton
                                key={t.id}
                                label={t.label}
                                caption={
                                  ["highlight", "note", "draw"].includes(t.id)
                                    ? t.label
                                    : undefined
                                }
                                active={tool === t.id}
                                onClick={() => setTool(t.id)}
                              >
                                <t.icon size={16} />
                              </IconButton>
                            ))}
                        {tool === "draw" && (
                          <Select
                            label="Drawing assistance"
                            value={inkAssist}
                            options={["Original", "Smooth", "Smart shapes"]}
                            onChange={(v) => setInkAssist(v as InkMode)}
                          />
                        )}
                        {tool === "draw" && (
                          <Select
                            label="Brush preset"
                            value={brush}
                            options={["Pen", "Pencil", "Marker", "Highlighter"]}
                            onChange={(v) => {
                              setBrush(v);
                              setStroke(
                                v === "Pen"
                                  ? "2"
                                  : v === "Pencil"
                                    ? "1"
                                    : v === "Marker"
                                      ? "8"
                                      : "14",
                              );
                              setOpacity(
                                v === "Highlighter"
                                  ? "30"
                                  : v === "Marker"
                                    ? "65"
                                    : "100",
                              );
                              setColor(
                                v === "Highlighter" ? "#ebce78" : "#303038",
                              );
                            }}
                          />
                        )}
                        <span className="context-label">Color</span>
                        <input
                          className="toolbar-color"
                          aria-label="Stroke color"
                          type="color"
                          value={color}
                          onChange={(e) => setColor(e.target.value)}
                        />
                        {tool !== "highlight" && tool !== "note" && (
                          <>
                            <span className="context-label">Width</span>
                            <input
                              className="toolbar-number"
                              aria-label="Stroke width"
                              type="number"
                              min=".5"
                              max="30"
                              step=".5"
                              value={stroke}
                              onChange={(e) => setStroke(e.target.value)}
                            />
                          </>
                        )}
                      </>
                    ) : mode === "Forms" ? (
                      <>
                        <button
                          className="text-button"
                          aria-pressed={tool === "field"}
                          onClick={() => setTool("field")}
                        >
                          <Plus size={14} />
                          Create field
                        </button>
                        <button
                          className="text-button"
                          onClick={() => {
                            setPanel("Forms");
                            setTool("select");
                          }}
                        >
                          Fill fields
                        </button>
                      </>
                    ) : tool === "redact" ? (
                      <span className="context-label">
                        Mark a region · Review before applying
                      </span>
                    ) : selection ? (
                      <>
                        <span className="context-label">
                          X {selection.bounds.x.toFixed(1)} · Y{" "}
                          {selection.bounds.y.toFixed(1)}
                        </span>
                        <span className="context-label">
                          {selection.bounds.width.toFixed(1)} ×{" "}
                          {selection.bounds.height.toFixed(1)} pt
                        </span>
                        <IconButton
                          label="Rotate selection"
                          onClick={() =>
                            void edit({
                              kind: "transform",
                              page,
                              object: selection.index,
                              dx: 0,
                              dy: 0,
                              sx: 1,
                              sy: 1,
                              degrees: 15,
                            })
                          }
                        >
                          <RotateCw size={15} />
                        </IconButton>
                      </>
                    ) : (
                      <>
                        <button
                          className="text-button"
                          aria-pressed={tool === "select"}
                          onClick={() => setTool("select")}
                        >
                          <MousePointer2 size={14} />
                          Select & move
                        </button>
                        <button
                          className="text-button"
                          onClick={() => setTool("text")}
                        >
                          <Type size={14} />
                          Add text
                        </button>
                        <button
                          className="text-button"
                          onClick={() =>
                            void actions
                              .find((a) => a.name === "Insert image")
                              ?.run()
                          }
                        >
                          <ImagePlus size={14} />
                          Image
                        </button>
                        <IconButton
                          label="Find in document"
                          onClick={() => setSearchOpen((v) => !v)}
                        >
                          <Search size={15} />
                        </IconButton>
                      </>
                    )}
                  </div>
                  <div className="toolbar-group">
                    <IconButton
                      label={`Undo${doc.undo ? " " + doc.undo : ""} (Ctrl+Z)`}
                      disabled={!doc.undo || !!busy}
                      onClick={() => void history("undo")}
                    >
                      <Undo2 size={17} />
                    </IconButton>
                    <IconButton
                      label={`Redo${doc.redo ? " " + doc.redo : ""}`}
                      disabled={!doc.redo || !!busy}
                      onClick={() => void history("redo")}
                    >
                      <Redo2 size={17} />
                    </IconButton>
                    <span className="divider" />
                    <IconButton
                      label="Toggle properties"
                      caption="Properties"
                      active={inspector}
                      onClick={() => setInspector((v) => !v)}
                    >
                      <PanelRightClose size={17} />
                    </IconButton>
                  </div>
                </div>
              </div>
              {searchOpen && (
                <div className="search-bar">
                  <Search size={16} />
                  <input
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label="Find in document"
                    placeholder="Find in document…"
                  />
                  <span>{results.length} pages</span>
                  {results.slice(0, 8).map((r) => (
                    <button key={r.page} onClick={() => go(r.page)}>
                      {r.page + 1}
                    </button>
                  ))}
                  <IconButton
                    label="Close search"
                    onClick={() => setSearchOpen(false)}
                  >
                    <X size={15} />
                  </IconButton>
                </div>
              )}
              {tool !== "select" && (
                <div
                  className={`tool-hint ${tool === "redact" ? "warning" : ""}`}
                >
                  <span>
                    {tool === "signature"
                      ? "Draw an electronic signature. This is a visual mark, not a digital certificate."
                      : tool === "crop"
                        ? "Drag a region to crop the current page."
                        : tool === "redact"
                          ? "Mark a region to remove. You will review the flattening consequences before applying."
                          : `Drag on the page to ${tool === "text" ? "place text" : tool === "field" ? "create a form field" : tool === "note" ? "add a comment" : tool === "link" ? "add a link" : tool === "highlight" ? "highlight a region" : "draw"}.`}
                  </span>
                  <button onClick={() => setTool("select")}>
                    Done
                    <Esc />
                  </button>
                </div>
              )}
              {mode === "Pages" ? (
                <div
                  key={doc.id}
                  className="canvas organizer"
                  aria-label="Page organizer"
                >
                  {doc.info.pages.map((_, i) => (
                    <div
                      key={i}
                      className={`thumbnail ${selectedPages.includes(i) ? "selected" : ""}`}
                      draggable
                      onDragStart={() => (dragPage.current = i)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.currentTarget.classList.add("drag-target");
                      }}
                      onDragLeave={(e) =>
                        e.currentTarget.classList.remove("drag-target")
                      }
                      onDragEnd={(e) =>
                        e.currentTarget.classList.remove("drag-target")
                      }
                      onDrop={(e) => {
                        e.preventDefault();
                        e.currentTarget.classList.remove("drag-target");
                        if (dragPage.current !== null) {
                          const order = reorderPages(
                            doc.info.pages.length,
                            selectedPages,
                            dragPage.current,
                            i,
                          );
                          void edit({ kind: "reorder", order });
                          dragPage.current = null;
                        }
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setPage(i);
                        if (!selectedPages.includes(i)) setSelectedPages([i]);
                        setContext({ x: e.clientX, y: e.clientY, page: i });
                      }}
                    >
                      <button
                        aria-label={`Select page ${i + 1}`}
                        onDoubleClick={() => {
                          setMode("Edit");
                          go(i);
                        }}
                        onClick={(e) => {
                          setPage(i);
                          if (e.ctrlKey)
                            setSelectedPages((old) =>
                              old.includes(i)
                                ? old.filter((v) => v !== i)
                                : [...old, i],
                            );
                          else if (e.shiftKey)
                            setSelectedPages(
                              Array.from(
                                { length: Math.abs(i - page) + 1 },
                                (_, j) => Math.min(i, page) + j,
                              ),
                            );
                          else setSelectedPages([i]);
                        }}
                      >
                        <Thumbnail doc={doc} page={i} />
                        <span className="thumb-number">{i + 1}</span>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  key={doc.id}
                  className={`canvas layout-${layout.toLowerCase()}`}
                  ref={canvas}
                  onClick={(e) => {
                    if (e.target === e.currentTarget) setSelection(null);
                  }}
                >
                  {doc.info.pages.map(
                    (_, i) =>
                      (layout !== "Single page" || i === page) && (
                        <PageCanvas
                          key={`${doc.id}-${i}`}
                          doc={doc}
                          page={i}
                          zoom={zoom}
                          inkColor={color}
                          inkWidth={Number(stroke)}
                          inkOpacity={Number(opacity) / 100}
                          tool={tool}
                          selected={page === i ? selection : null}
                          onSelect={select}
                          onContext={(x, y, p, o) => {
                            select(p, o);
                            setObjectMenu({ x, y, p, o });
                          }}
                          onTransform={(p, o, r, a) =>
                            transformObject(p, o, r, a)
                          }
                          onText={editInline}
                          onInsertText={insertInline}
                          onExitText={() => setTool("select")}
                          onTextDraft={setText}
                          textValue={text}
                          textStyle={{ size: Number(fontSize), color, font }}
                          registerTextEditor={(p, commit) => {
                            if (commit)
                              activeTextEditor.current = { page: p, commit };
                            else if (activeTextEditor.current?.page === p)
                              activeTextEditor.current = null;
                          }}
                          onAction={(p, o, action) => {
                            if (action === "center")
                              void transformObject(p, o, {
                                ...o.bounds,
                                x:
                                  (doc.info.pages[p].width - o.bounds.width) /
                                  2,
                              });
                            if (action === "left")
                              void transformObject(p, o, {
                                ...o.bounds,
                                x: 36,
                              });
                            if (action === "right")
                              void transformObject(p, o, {
                                ...o.bounds,
                                x:
                                  doc.info.pages[p].width - 36 - o.bounds.width,
                              });
                            if (action === "duplicate")
                              void edit({
                                kind: "duplicate_object",
                                page: p,
                                object: o.index,
                              });
                            if (action === "delete")
                              void edit({
                                kind: "delete_object",
                                page: p,
                                object: o.index,
                              });
                            if (action === "rotate")
                              void transformObject(p, o, o.bounds, 15);
                          }}
                          onRegion={region}
                          onDraw={(p, points) => {
                            const refined = reconstructInk(
                              points,
                              inkAssist,
                              0.65,
                            );
                            void edit({
                              kind: tool === "draw" ? "brush" : "signature",
                              page: p,
                              paths: [refined.points],
                              color: rgba(),
                              width: Number(stroke),
                            });
                            if (inkAssist !== "Original")
                              notify(
                                `${refined.kind} · Undo restores the page`,
                              );
                          }}
                          onActive={setPage}
                          onError={report}
                          search={search}
                        />
                      ),
                  )}
                </div>
              )}
              <footer className="statusbar">
                <div className="interaction-guide" aria-live="polite">
                  {tool === "select"
                    ? selection
                      ? selection.kind === "text"
                        ? "Drag to move · Handles resize text · Double-click to edit · Esc cancels"
                        : "Drag to move · Shift constrains · Ctrl bypasses snapping · Esc cancels"
                      : "Click text or an image to edit it · Use Insert to add content"
                    : tool === "text"
                      ? "Click or drag on the page to place text"
                      : tool === "crop"
                        ? "Drag the area to keep"
                        : tool === "field"
                          ? "Drag on the page to create a form field"
                          : "Drag on the page · Choose Edit to select objects"}
                </div>
                <div>
                  <IconButton
                    label="Previous page"
                    disabled={page === 0}
                    onClick={() => go(page - 1)}
                  >
                    <ChevronLeft size={14} />
                  </IconButton>
                  <span>
                    Page{" "}
                    <input
                      type="number"
                      aria-label="Page number"
                      min="1"
                      max={doc.info.pages.length}
                      value={page + 1}
                      onChange={(e) => go(Number(e.target.value) - 1)}
                    />{" "}
                    of {doc.info.pages.length}
                  </span>
                  <IconButton
                    label="Next page"
                    disabled={page === doc.info.pages.length - 1}
                    onClick={() => go(page + 1)}
                  >
                    <ChevronRight size={14} />
                  </IconButton>
                </div>
                <div className="document-status">
                  {busy ? (
                    <>
                      <Spinner />
                      <span>{busy}</span>
                      {ocrCancel.current && (
                        <button onClick={() => ocrCancel.current?.abort()}>
                          Cancel
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="local-dot" />
                      {doc.dirty ? "Unsaved changes" : "All changes saved"}
                    </>
                  )}
                </div>
                <div>
                  <Select
                    value={layout}
                    onChange={setLayout}
                    options={["Continuous", "Single page", "Two-page"]}
                    label="Page layout"
                  />
                  <span className="divider" />
                  <IconButton
                    label="Zoom out"
                    onClick={() => setZoom((z) => Math.max(0.25, z - 0.1))}
                  >
                    <Minus size={14} />
                  </IconButton>
                  <button className="zoom-value" onClick={fit}>
                    {Math.round(zoom * 100)}%
                  </button>
                  <IconButton
                    label="Zoom in"
                    onClick={() => setZoom((z) => Math.min(4, z + 0.1))}
                  >
                    <Plus size={14} />
                  </IconButton>
                  <IconButton label="Fit width (Ctrl+0)" onClick={fit}>
                    <Maximize size={14} />
                  </IconButton>
                </div>
              </footer>
            </main>
            {inspector && (
              <aside className="inspector">
                <div className="panel-heading">
                  <IconButton
                    label="Close properties"
                    onClick={() => setInspector(false)}
                  >
                    <X size={14} />
                  </IconButton>
                  <h2>
                    {selection
                      ? selection.kind === "text"
                        ? "Text properties"
                        : `${selection.kind} properties`
                      : mode === "Pages"
                        ? "Page properties"
                        : mode === "Forms"
                          ? "Form tools"
                          : mode === "Sign"
                            ? "Signature"
                            : mode === "Annotate" || mode === "Draw"
                              ? "Appearance"
                              : "Page properties"}
                  </h2>
                  <IconButton
                    label="More document tools"
                    onClick={() => {
                      setPalette(true);
                      setQuery("");
                    }}
                  >
                    <Ellipsis size={18} />
                  </IconButton>
                </div>
                {selection ? (
                  <>
                    <Section title="Selection">
                      <div className="selection-type">
                        <span className="selection-icon">
                          {selection.kind === "text" ? (
                            <Type size={20} />
                          ) : selection.kind === "image" ? (
                            <ImagePlus size={20} />
                          ) : (
                            <Square size={20} />
                          )}
                        </span>
                        <div>
                          <strong>
                            {selection.kind === "text"
                              ? "Text object"
                              : selection.kind === "image"
                                ? "Image object"
                                : "Page object"}
                          </strong>
                          <span>
                            Page {page + 1} · Object {selection.index + 1}
                          </span>
                        </div>
                      </div>
                    </Section>
                    {selection.kind === "text" && (
                      <>
                        <Section title="Content">
                          <textarea
                            className="object-text"
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            aria-label="Selected text"
                            rows={3}
                          />
                          <button
                            className="secondary full content-apply"
                            onClick={() => void applyTextProperties()}
                          >
                            <Check size={15} />
                            Apply text changes
                          </button>
                        </Section>
                        <Section title="Text style">
                          <div className="type-style-actions">
                            <button
                              onClick={() => {
                                setTypeStyle({
                                  font:
                                    font !== fontNames[0]
                                      ? font
                                      : fontNames.includes(selection.font ?? "")
                                        ? selection.font!
                                        : null,
                                  size: Number(fontSize),
                                  color: rgba(),
                                });
                                notify(
                                  "Text style copied. Select another text object and apply it.",
                                );
                              }}
                            >
                              <Copy size={12} />
                              Copy style
                            </button>
                            <button
                              disabled={!typeStyle}
                              title="Copies size and color; an embedded font is preserved on the destination"
                              onClick={() => {
                                if (typeStyle)
                                  void applyTextProperties(typeStyle);
                              }}
                            >
                              Apply style
                            </button>
                          </div>
                          <p className="inspector-hint">
                            Font, size and color are in the toolbar above the
                            page.
                          </p>
                          <p className="small muted">
                            Original: {selection.font}
                          </p>
                        </Section>
                      </>
                    )}
                    <Section title="Position & size">
                      <div
                        className="object-align"
                        role="group"
                        aria-label="Align on page"
                      >
                        {(
                          [
                            ["Left margin", 36],
                            [
                              "Center",
                              (doc.info.pages[page].width -
                                selection.bounds.width) /
                                2,
                            ],
                            [
                              "Right margin",
                              doc.info.pages[page].width -
                                36 -
                                selection.bounds.width,
                            ],
                          ] as const
                        ).map(([label, x]) => (
                          <button
                            key={label}
                            onClick={() =>
                              void transformObject(page, selection, {
                                ...selection.bounds,
                                x,
                              })
                            }
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <GeometryFields
                        bounds={selection.bounds}
                        proportional={selection.kind === "text"}
                        onApply={(bounds, angle) =>
                          void transformObject(page, selection, bounds, angle)
                        }
                      />
                      <div className="arrange-buttons">
                        <IconButton
                          label="Move left"
                          onClick={() =>
                            void edit({
                              kind: "transform",
                              page,
                              object: selection.index,
                              dx: -10,
                              dy: 0,
                              sx: 1,
                              sy: 1,
                              degrees: 0,
                            })
                          }
                        >
                          <ChevronLeft size={16} />
                        </IconButton>
                        <IconButton
                          label="Move up"
                          onClick={() =>
                            void edit({
                              kind: "transform",
                              page,
                              object: selection.index,
                              dx: 0,
                              dy: -10,
                              sx: 1,
                              sy: 1,
                              degrees: 0,
                            })
                          }
                        >
                          <ArrowUp size={16} />
                        </IconButton>
                        <IconButton
                          label="Move down"
                          onClick={() =>
                            void edit({
                              kind: "transform",
                              page,
                              object: selection.index,
                              dx: 0,
                              dy: 10,
                              sx: 1,
                              sy: 1,
                              degrees: 0,
                            })
                          }
                        >
                          <ArrowDown size={16} />
                        </IconButton>
                        <IconButton
                          label="Move right"
                          onClick={() =>
                            void edit({
                              kind: "transform",
                              page,
                              object: selection.index,
                              dx: 10,
                              dy: 0,
                              sx: 1,
                              sy: 1,
                              degrees: 0,
                            })
                          }
                        >
                          <ChevronRight size={16} />
                        </IconButton>
                        <IconButton
                          label="Rotate object"
                          onClick={() =>
                            void edit({
                              kind: "transform",
                              page,
                              object: selection.index,
                              dx: 0,
                              dy: 0,
                              sx: 1,
                              sy: 1,
                              degrees: 15,
                            })
                          }
                        >
                          <RotateCw size={16} />
                        </IconButton>
                      </div>
                      {selection.kind === "image" && (
                        <>
                          <div className="property-grid">
                            {["Horizontal", "Vertical"].map((axis) => (
                              <button
                                className="secondary"
                                key={axis}
                                onClick={() =>
                                  void edit({
                                    kind: "transform",
                                    page,
                                    object: selection.index,
                                    dx:
                                      axis === "Horizontal"
                                        ? selection.bounds.width
                                        : 0,
                                    dy:
                                      axis === "Vertical"
                                        ? -selection.bounds.height
                                        : 0,
                                    sx: axis === "Horizontal" ? -1 : 1,
                                    sy: axis === "Vertical" ? -1 : 1,
                                    degrees: 0,
                                  })
                                }
                              >
                                Flip {axis.toLowerCase()}
                              </button>
                            ))}
                          </div>
                          <button
                            className="secondary full"
                            onClick={() => void addImage(true)}
                          >
                            <ImagePlus size={15} />
                            Replace image
                          </button>
                        </>
                      )}
                    </Section>
                    <Section title="Object">
                      <button
                        className="danger-text full"
                        onClick={() =>
                          void edit({
                            kind: "delete_object",
                            page,
                            object: selection.index,
                          })
                        }
                      >
                        <Trash2 size={15} />
                        Delete object
                      </button>
                    </Section>
                  </>
                ) : (
                  <>
                    <Section title="Start here">
                      <div className="inspector-launch-actions">
                        <button
                          onClick={() => {
                            chooseMode("Edit");
                            setTool("text");
                          }}
                        >
                          <Type size={17} />
                          <span>
                            Add text<small>Click a position on the page</small>
                          </span>
                          <Plus size={13} />
                        </button>
                        <button onClick={() => void addImage()}>
                          <ImagePlus size={17} />
                          <span>
                            Place an image
                            <small>Photo, logo or illustration</small>
                          </span>
                          <Plus size={13} />
                        </button>
                        <button
                          onClick={() => {
                            chooseMode("Sign");
                          }}
                        >
                          <PenLine size={17} />
                          <span>
                            Sign this document
                            <small>Open your Signature Studio</small>
                          </span>
                          <ArrowUpRight size={13} />
                        </button>
                      </div>
                    </Section>
                    <Section title="Page">
                      <dl className="document-details">
                        <div>
                          <dt>Page</dt>
                          <dd>
                            {page + 1} / {doc.info.pages.length}
                          </dd>
                        </div>
                        <div>
                          <dt>Width</dt>
                          <dd>{doc.info.pages[page].width.toFixed(1)} pt</dd>
                        </div>
                        <div>
                          <dt>Height</dt>
                          <dd>{doc.info.pages[page].height.toFixed(1)} pt</dd>
                        </div>
                        <div>
                          <dt>Orientation</dt>
                          <dd>
                            {doc.info.pages[page].width >
                            doc.info.pages[page].height
                              ? "Landscape"
                              : "Portrait"}
                          </dd>
                        </div>
                      </dl>
                      <div className="inspector-actions">
                        <button
                          onClick={() =>
                            void edit({
                              kind: "rotate",
                              pages: [page],
                              degrees: 90,
                            })
                          }
                        >
                          <RotateCw size={14} />
                          Rotate page
                          <ChevronRight size={12} />
                        </button>
                        <button
                          onClick={() => {
                            setMode("Edit");
                            setTool("crop");
                          }}
                        >
                          <Crop size={14} />
                          Crop page
                          <ChevronRight size={12} />
                        </button>
                      </div>
                    </Section>
                    {(mode === "Annotate" ||
                      mode === "Draw" ||
                      mode === "Sign") && (
                      <Section title="Appearance">
                        <div className="property-grid">
                          <Field label="Color">
                            <input
                              type="color"
                              value={color}
                              onChange={(e) => setColor(e.target.value)}
                            />
                          </Field>
                          <Field label="Stroke (pt)">
                            <input
                              type="number"
                              min=".5"
                              max="30"
                              step=".5"
                              value={stroke}
                              onChange={(e) => setStroke(e.target.value)}
                            />
                          </Field>
                        </div>
                        <Field label="Opacity (%)">
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={opacity}
                            onChange={(e) => setOpacity(e.target.value)}
                          />
                        </Field>
                        {mode === "Sign" && (
                          <p className="small muted">
                            Draw a visual signature on the page. Certificate
                            signing is a separate command.
                          </p>
                        )}
                        {mode === "Annotate" && (
                          <div className="document-details">
                            <div>
                              <dt>Author</dt>
                              <dd>Local user</dd>
                            </div>
                          </div>
                        )}
                      </Section>
                    )}
                    {mode === "Forms" && (
                      <Section title="Form fields">
                        <div className="inspector-actions">
                          <button onClick={() => setTool("field")}>
                            <Plus size={14} />
                            Create field
                            <ChevronRight size={12} />
                          </button>
                          <button
                            onClick={() =>
                              actions
                                .find((a) => a.name === "Flatten form fields")
                                ?.run()
                            }
                          >
                            <Layers size={14} />
                            Flatten fields
                            <ChevronRight size={12} />
                          </button>
                        </div>
                        <p className="small muted">
                          Drag on the page to place a text field or checkbox.
                          Fill values in the Forms panel.
                        </p>
                      </Section>
                    )}
                    {mode === "Sign" && (
                      <Section title="Certificate">
                        <button
                          className="secondary full"
                          disabled={!native}
                          onClick={() =>
                            actions
                              .find((a) => a.name === "Sign with certificate")
                              ?.run()
                          }
                        >
                          <ShieldCheck size={14} />
                          Sign with certificate
                        </button>
                        <p className="small muted">
                          {native
                            ? "Choose an identity from the Windows certificate store."
                            : "Available in the desktop application."}
                        </p>
                      </Section>
                    )}
                    <Section title="Document">
                      <strong className="document-name">{doc.name}</strong>
                      <dl className="document-details">
                        <div>
                          <dt>File size</dt>
                          <dd>{formatBytes(doc.info.bytes)}</dd>
                        </div>
                        <div>
                          <dt>Format</dt>
                          <dd>PDF {doc.info.metadata.version}</dd>
                        </div>
                      </dl>
                      <button className="text-button" onClick={metadata}>
                        Document properties
                        <ArrowUpRight size={12} />
                      </button>
                    </Section>
                    {mode === "Edit" && (
                      <div className="inspector-guidance">
                        <p>
                          Select text, an image or a shape to edit its
                          properties.
                        </p>
                      </div>
                    )}
                    <div className="privacy-note">
                      <ShieldCheck size={13} />
                      <span>Local processing</span>
                    </div>
                  </>
                )}
              </aside>
            )}
          </>
        )}
      </div>
      {objectMenu && (
        <ContextMenu
          x={objectMenu.x}
          y={objectMenu.y}
          onClose={() => setObjectMenu(null)}
          items={[
            { label: "Copy", run: () => void copyObject() },
            { label: "Cut", run: () => void copyObject(true) },
            {
              label: "Duplicate",
              run: () =>
                void edit({
                  kind: "duplicate_object",
                  page: objectMenu.p,
                  object: objectMenu.o.index,
                }),
            },
            ...[
              ["Bring to front", "front"],
              ["Bring forward", "forward"],
              ["Send backward", "backward"],
              ["Send to back", "back"],
            ].map(([label, position]) => ({
              label,
              run: () =>
                void edit({
                  kind: "arrange",
                  page: objectMenu.p,
                  object: objectMenu.o.index,
                  position,
                }),
            })),
            {
              label: "Delete",
              run: () =>
                void edit({
                  kind: "delete_object",
                  page: objectMenu.p,
                  object: objectMenu.o.index,
                }),
            },
          ]}
        />
      )}
      {saveAs && doc && (
        <SaveAs
          doc={doc}
          page={page}
          onClose={() => setSaveAs(false)}
          onSaved={(s) => {
            if (s) update(s);
            notify("Document saved");
          }}
        />
      )}
      {compareSource && doc && (
        <Compare
          before={doc}
          after={compareSource}
          onClose={() => {
            void api("close", compareSource.id, { discard: true }).catch(
              report,
            );
            setCompareSource(null);
          }}
        />
      )}
      {insertSource && doc && (
        <InsertPdf
          source={insertSource}
          current={page}
          total={doc.info.pages.length}
          onClose={() => {
            void api("close", insertSource.id, { discard: true }).catch(report);
            setInsertSource(null);
          }}
          onInsert={async (data, at) => {
            update(await api<Session>("insert_pdf", doc.id, { data, at }));
            setPage(at);
            setPanel("Pages");
            setTool("select");
          }}
        />
      )}
      {inspectDocument && doc && (
        <DocumentInspector
          doc={doc}
          onClose={() => setInspectDocument(false)}
          onLocate={(p, o) => {
            go(p);
            setMode("Edit");
            setTool("select");
            select(p, o);
          }}
        />
      )}
      {settingsOpen && (
        <Settings
          theme={theme}
          onTheme={setTheme}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {signatureStudio && (
        <SignatureStudio
          initialMode={signatureStart}
          onClose={() => {
            setSignatureStudio(false);
            setSignatureStart("Type");
          }}
          onPlace={async (value) => {
            const target =
              doc ??
              (await api<Session>("create", undefined, {
                name:
                  signatureStart === "Draw"
                    ? "My drawing.pdf"
                    : "My signature.pdf",
              }));
            const targetPage = doc ? page : 0;
            const width = Math.min(
                value.placementWidth ?? preferences.signatureWidth,
                target.info.pages[targetPage].width - 144,
              ),
              scale = Math.min(
                width / value.width,
                Math.min(320, target.info.pages[targetPage].height - 160) /
                  value.height,
              );
            const next = await api<Session>("edit", target.id, {
              revision: target.revision,
              command: {
                kind: value.filled ? "filled_mark" : "signature",
                page: targetPage,
                paths: value.paths.map((stroke) =>
                  stroke.map((p) => [72 + p[0] * scale, 120 + p[1] * scale]),
                ),
                color: [
                  ...(value.color ?? preferences.signatureColor)
                    .slice(1)
                    .match(/.{2}/g)!
                    .map((v) => parseInt(v, 16)),
                  255,
                ],
                width: value.stroke * scale * (value.filled ? 0.12 : 1),
              },
            });
            update(next);
            setPage(targetPage);
            setTool("select");
            setMode("Edit");
            const objects = await api<PdfObject[]>("inspect", next.id, {
              page: targetPage,
            });
            setSelection(objects.at(-1) ?? null);
          }}
          onImage={async (data) => {
            const target =
              doc ??
              (await api<Session>("create", undefined, {
                name: "My signature.pdf",
              }));
            const targetPage = doc ? page : 0;
            update(
              await api<Session>("edit", target.id, {
                revision: target.revision,
                command: {
                  kind: "image",
                  page: targetPage,
                  object: null,
                  data,
                  rect: { x: 72, y: 120, width: 240, height: 90 },
                },
              }),
            );
            setPage(targetPage);
            setTool("select");
            setMode("Edit");
          }}
        />
      )}
      {newDocument && (
        <NewDocument
          initialQuery={templateQuery}
          onClose={() => {
            setNewDocument(false);
            setTemplateQuery("");
          }}
          onCreate={async (t, c) => {
            const s = await api<Session>("create", undefined, {
              ...c,
              commands: templateCommands(t, c),
            });
            update(s);
            setMode("Edit");
            setTool("select");
            setPanel("Pages");
            setLeft(false);
            setInspector(false);
            setPage(0);
            setSelection(null);
            setZoom(preferences.zoom / 100);
          }}
        />
      )}
      {dropping && (
        <div className="drop-overlay">
          <FolderOpen size={40} />
          <h2>Drop your PDF here</h2>
          <p>It stays on your computer.</p>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCheck size={17} />
          {toast}
        </div>
      )}
      {error && (
        <Dialog title="We couldn’t finish that" onClose={() => setError("")}>
          <div className="dialog-body">
            <p role="alert">
              {error.includes("FormatError")
                ? "Papier couldn’t read this file as a PDF. Try another copy, or export it as PDF from the app that created it."
                : error}
            </p>
            <p className="muted">
              Your source PDF has not been changed by this failed operation.
            </p>
            <button
              className="secondary"
              onClick={() => void navigator.clipboard.writeText(error)}
            >
              Copy diagnostics
            </button>
          </div>
          <footer>
            <button className="primary" onClick={() => setError("")}>
              OK
            </button>
          </footer>
        </Dialog>
      )}
      {modal && (
        <FormDialog
          modal={modal}
          onClose={() => setModal(null)}
          onError={report}
        />
      )}
      {palette && (
        <CommandPalette
          onBrowse={() => {
            setPalette(false);
            setToolLibrary(true);
          }}
          actions={actions}
          hasDocument={!!doc}
          onClose={() => setPalette(false)}
        />
      )}
      {toolLibrary && (
        <ToolLibrary
          actions={actions}
          hasDocument={!!doc}
          onClose={() => setToolLibrary(false)}
        />
      )}
      {findReplace && doc && (
        <FindReplace
          doc={doc}
          onClose={() => setFindReplace(false)}
          onUpdate={(s) => {
            update(s);
            setSelection(null);
            notify("Replacements applied · Ctrl Z to undo");
          }}
        />
      )}
      {context && (
        <ContextMenu
          x={context.x}
          y={context.y}
          onClose={() => setContext(null)}
          items={[
            {
              label: "Rotate 90°",
              run: () =>
                void edit({
                  kind: "rotate",
                  pages: selectedPages,
                  degrees: 90,
                }),
            },
            {
              label: "Duplicate page",
              run: () =>
                void edit({ kind: "duplicate_page", page: context.page }),
            },
            {
              label: "Extract selected pages",
              run: () => actions.find((a) => a.name === "Extract pages")?.run(),
            },
            {
              label: "Insert blank page",
              run: () =>
                void edit({
                  kind: "blank_page",
                  after: context.page,
                  width: 595.28,
                  height: 841.89,
                }),
            },
            {
              label: "Delete selected pages",
              disabled: selectedPages.length >= doc!.info.pages.length,
              run: () =>
                void edit({ kind: "delete_pages", pages: selectedPages }),
            },
          ]}
        />
      )}
    </div>
  );
}
function Empty({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Type;
  title: string;
  text: string;
}) {
  return (
    <div className="empty-panel">
      <Icon size={27} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
function Esc() {
  return <kbd>Esc</kbd>;
}
function FormDialog({
  modal,
  onClose,
  onError,
}: {
  modal: Modal;
  onClose: () => void;
  onError: (e: unknown) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries((modal.fields ?? []).map((f) => [f.key, f.value])),
  );
  const [working, setWorking] = useState(false);
  return (
    <Dialog
      title={modal.title}
      onClose={onClose}
      wide={modal.title === "Text comparison"}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!modal.submit) return;
          setWorking(true);
          try {
            await modal.submit(values);
            onClose();
          } catch (e) {
            onError(e);
          } finally {
            setWorking(false);
          }
        }}
      >
        <div className="dialog-body">
          {modal.description && (
            <p className="modal-description">{modal.description}</p>
          )}
          {modal.content}
          {modal.fields?.map((f) => (
            <Field key={f.key} label={f.label}>
              {f.options ? (
                <Select
                  label={f.label}
                  value={values[f.key]}
                  onChange={(v) => setValues((old) => ({ ...old, [f.key]: v }))}
                  options={f.options}
                />
              ) : f.type === "textarea" ? (
                <textarea
                  autoFocus
                  value={values[f.key]}
                  onChange={(e) =>
                    setValues((old) => ({ ...old, [f.key]: e.target.value }))
                  }
                  rows={4}
                />
              ) : (
                <input
                  type={f.type ?? "text"}
                  value={values[f.key]}
                  autoComplete="off"
                  onChange={(e) =>
                    setValues((old) => ({ ...old, [f.key]: e.target.value }))
                  }
                />
              )}
            </Field>
          ))}
        </div>
        <footer>
          <button type="button" className="secondary" onClick={onClose}>
            {modal.submit ? "Cancel" : "Close"}
          </button>
          {modal.submit && (
            <button
              className={modal.danger ? "danger" : "primary"}
              type="submit"
              disabled={working}
            >
              {working ? <Spinner /> : null}
              {modal.actionLabel ?? "Apply"}
            </button>
          )}
        </footer>
      </form>
    </Dialog>
  );
}
