export type Rect = { x: number; y: number; width: number; height: number };
export function reorderPages(
  total: number,
  selected: number[],
  from: number,
  to: number,
): number[] {
  const all = Array.from({ length: total }, (_, i) => i);
  const moving = selected.includes(from)
    ? all.filter((i) => selected.includes(i))
    : [from];
  if (moving.includes(to)) return all;
  const rest = all.filter((i) => !moving.includes(i));
  const at = rest.indexOf(to) + (from < to ? 1 : 0);
  rest.splice(at, 0, ...moving);
  return rest;
}
export type PageInfo = { width: number; height: number };
export type Annotation = {
  page: number;
  index: number;
  subtype: string;
  text: string;
  name: string;
  value: string;
  fieldType: string;
};
export type Session = {
  id: string;
  name: string;
  dirty: boolean;
  revision: number;
  undo: string | null;
  redo: string | null;
  source: string | null;
  info: {
    pages: PageInfo[];
    signatures: number;
    bytes: number;
    metadata: {
      version: string;
      info: Record<string, string>;
      bookmarks: { title: string; page: number | null }[];
      annotations: Annotation[];
      fields: Annotation[];
      tagged: boolean;
      encrypted: boolean;
    };
  };
};
export type PdfObject = {
  index: number;
  kind: string;
  bounds: Rect;
  text: string | null;
  font: string | null;
  size: number | null;
  color: [number, number, number, number];
};
export type Tool =
  | "select"
  | "text"
  | "highlight"
  | "note"
  | "draw"
  | "rectangle"
  | "ellipse"
  | "line"
  | "link"
  | "crop"
  | "redact"
  | "field"
  | "signature";
export type Command = { kind: string; [key: string]: unknown };
export function parsePages(input: string, total: number): number[] {
  const result = new Set<number>();
  if (input.trim().toLowerCase() === "all")
    return Array.from({ length: total }, (_, i) => i);
  for (const part of input.split(",")) {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match)
      throw new Error("Use page numbers or ranges, for example 1, 3-5.");
    const a = Number(match[1]),
      b = Number(match[2] ?? a);
    if (a < 1 || b < a || b > total)
      throw new Error(`Choose pages between 1 and ${total}.`);
    for (let i = a; i <= b; i++) result.add(i - 1);
  }
  return [...result];
}
export function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(0)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
