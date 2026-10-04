import type { SVGProps } from "react";

// Original Papier glyphs. 20-unit optical grid, square ends and open corners.
// Geometry is authored here; no third-party icon paths or proprietary assets.
type Props = SVGProps<SVGSVGElement> & { size?: number };
const glyphs = {
  ArrowDown: "M10 3v13m-5-5 5 5 5-5",
  ArrowUp: "M10 17V4m-5 5 5-5 5 5",
  ArrowUpRight: "M5 15 15 5M5 5h10v10",
  ChevronLeft: "m12 4-6 6 6 6",
  ChevronRight: "m7 4 6 6-6 6",
  ChevronDown: "m4 7 6 6 6-6",
  Check: "m4 10 4 4L16 5",
  CheckCheck: "m2 10 4 4 8-9m-3 8 2 2 6-8",
  X: "m5 5 10 10M15 5 5 15",
  Plus: "M10 3v14M3 10h14",
  Minus: "M3 10h14",
  MousePointer2: "M3 3h4M3 3v4m0 7v3h3m8 0h3v-4M11 3h6v4M7 6l3 10 2-4 4-2L7 6Z",
  Type: "M4 5V3h12v2M10 3v12M7 15h6M3 18h14m-14-2v3m14-3v3",
  File: "M4 3h9l3 3v11H4V3Zm9 0v4h3",
  FileText: "M4 3h9l3 3v11H4V3Zm9 0v4h3M7 10h6m-6 3h4",
  FilePlus2: "M10 3H4v14h12v-6m-2-9v6m-3-3h6",
  FolderOpen: "M3 8V4h5l2 2h7v2M3 8h15l-3 8H2l1-8Z",
  Save: "M3 3h12l2 2v12H3V3Zm4 0v5h6V3M6 17v-6h8v6",
  Copy: "M7 6h10v11H7V6ZM3 13V2h10",
  Layers: "M4 2h12v12H4V2ZM1 6v11h12M7 5h6m-6 3h4",
  BookOpen:
    "M10 5c-2-2-5-2-8-2v13c3 0 6 0 8 2 2-2 5-2 8-2V3c-3 0-6 0-8 2Zm0 0v13",
  MessageSquare: "M3 3h14v11H8l-4 3v-3H3V3Zm4 4h7m-7 3h5M1 6v11",
  Highlighter: "m11 2 6 4-5 8-6-4 5-8ZM6 10l-3 5 6 2 3-3M2 19h13m-6-2 3-3",
  PenLine: "m12 2 5 3-5 9-6 2v-6l6-8Zm-6 14 5-6m-2-3 5 3M3 18h14",
  ImagePlus: "M3 4h9m5 5v8H3V4M3 14l4-4 4 4 3-2 3 3M16 1v6m-3-3h6M6 7h1",
  Square: "M4 3h12v14H4V3Zm3 3h6v8H7V6M2 5h2m12 10h2",
  Circle: "M8 3a7 7 0 1 0 4 0",
  Link2: "m8 5 2-2a4 4 0 0 1 6 6l-2 2M6 9l-2 2a4 4 0 0 0 6 6l2-2M7 13l6-6",
  LockKeyhole: "M4 8h12v10H4V8Zm2 0V5a4 4 0 0 1 8 0v3M10 12v3",
  ShieldCheck: "m3 4 7-2 7 2v6c0 4-4 7-7 8-3-1-7-4-7-8V4Zm3 6 3 3 5-6",
  CheckSquare: "M3 2h12v3M3 2v15h14v-6M1 6h2m-2 4h2m-2 4h2M7 8l3 3 8-7",
  Crop: "M4 2v14h14M2 4h14v14M8 8h4v4M8 12h4",
  RotateCw: "M16 8a6 6 0 1 0 0 5M16 2v6h-6",
  Undo2: "M3 8h8c6 0 6 8 0 8H7M7 3 2 8l5 5",
  Redo2: "M17 8H9c-6 0-6 8 0 8h2m2-13 5 5-5 5",
  Trash2: "M3 5h14M8 2h4l1 3M5 7l1 10h8l1-10M8 8v6m4-6v6",
  Search: "M13 12a6 6 0 1 0-1 1l5 5m-9-6a4 4 0 1 0 0-8",
  ZoomIn: "M13 13a6 6 0 1 0-1 1l5 4M5 8h6M8 5v6",
  Maximize: "M8 3H3v5m9-5h5v5M3 12v5h5m9-5v5h-5",
  PanelLeftClose: "M3 3h14v14H3V3Zm4 0v14m6-11-3 4 3 4",
  PanelRightClose: "M3 3h14v14H3V3Zm10 0v14M7 6l3 4-3 4",
  Columns2: "M2 3h6v14H2V3Zm10 0h6v14h-6V3Z",
  Grid2X2: "M3 3h5v5H3V3Zm9 0h5v5h-5V3ZM3 12h5v5H3v-5Zm9 0h5v5h-5v-5Z",
  Home: "m2 9 8-7 8 7M5 7v10h10V7M8 17v-6h4v6",
  Settings2: "M3 5h8m4 0h2M3 10h2m4 0h8M3 15h8m4 0h2M11 3v4M5 8v4m6 1v4",
  SlidersHorizontal: "M2 5h6m4 0h6M2 14h10m4 0h2M8 2v6h4V2H8Zm4 9v8h4V9h-4Z",
  Download: "M10 2v11m-4-4 4 4 4-4M3 13v4h14v-4",
  ScanLine: "M7 2H2v5m11-5h5v5M2 13v5h5m11-5v5h-5M1 10h18M6 5h8M6 15h8",
  Hash: "M7 2 5 18M15 2l-2 16M3 7h15M2 13h15",
  Stamp: "M6 11V8c-3-7 11-7 8 0v3m-8 0h8l3 4H3l3-4Zm-3 7h14M8 6h4",
  Info: "M10 2a8 8 0 1 0 .01 0M10 8v7M10 5v.2",
  Sun: "M10 6a4 4 0 1 0 .01 0M10 1v2m0 14v2M1 10h2m14 0h2M4 4l1 1m10 10 1 1M4 16l1-1M15 5l1-1",
  Moon: "M8 2A8 8 0 1 0 18 12 7 7 0 0 1 8 2Z",
  Monitor: "M2 3h16v11H2V3Zm8 11v4m-4 0h8",
  Ellipsis: "M4 10h.1m6 0h.1m6 0h.1",
  LoaderCircle: "M10 2a8 8 0 1 1-8 8",
  Github: "M6 4 3 2v6c-2 8 16 8 14 0V2l-3 2M7 13v5m6-5v5",
} as const;
function make(name: keyof typeof glyphs) {
  return function DraftIcon({ size = 18, ...props }: Props) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.35}
        strokeLinecap={name === "Ellipsis" ? "round" : "square"}
        strokeLinejoin="miter"
        aria-hidden="true"
        {...props}
      >
        <path d={glyphs[name]} />
      </svg>
    );
  };
}
export const ArrowDown = make("ArrowDown"),
  ArrowUp = make("ArrowUp"),
  ArrowUpRight = make("ArrowUpRight"),
  BookOpen = make("BookOpen"),
  Check = make("Check"),
  CheckCheck = make("CheckCheck"),
  ChevronLeft = make("ChevronLeft"),
  ChevronRight = make("ChevronRight"),
  ChevronDown = make("ChevronDown"),
  Columns2 = make("Columns2"),
  Copy = make("Copy"),
  Download = make("Download"),
  Ellipsis = make("Ellipsis"),
  File = make("File"),
  FilePlus2 = make("FilePlus2"),
  FileText = make("FileText"),
  FolderOpen = make("FolderOpen"),
  Grid2X2 = make("Grid2X2"),
  Highlighter = make("Highlighter"),
  Home = make("Home"),
  ImagePlus = make("ImagePlus"),
  Info = make("Info"),
  Layers = make("Layers"),
  Link2 = make("Link2"),
  LockKeyhole = make("LockKeyhole"),
  Maximize = make("Maximize"),
  MessageSquare = make("MessageSquare"),
  Minus = make("Minus"),
  MousePointer2 = make("MousePointer2"),
  PanelLeftClose = make("PanelLeftClose"),
  PanelRightClose = make("PanelRightClose"),
  PenLine = make("PenLine"),
  Plus = make("Plus"),
  RotateCw = make("RotateCw"),
  Save = make("Save"),
  ScanLine = make("ScanLine"),
  Search = make("Search"),
  Settings2 = make("Settings2"),
  ShieldCheck = make("ShieldCheck"),
  SlidersHorizontal = make("SlidersHorizontal"),
  Square = make("Square"),
  Trash2 = make("Trash2"),
  Type = make("Type"),
  Undo2 = make("Undo2"),
  Redo2 = make("Redo2"),
  X = make("X"),
  ZoomIn = make("ZoomIn"),
  Sun = make("Sun"),
  Moon = make("Moon"),
  Monitor = make("Monitor"),
  CheckSquare = make("CheckSquare"),
  Circle = make("Circle"),
  Crop = make("Crop"),
  Hash = make("Hash"),
  Stamp = make("Stamp"),
  Github = make("Github"),
  LoaderCircle = make("LoaderCircle");
