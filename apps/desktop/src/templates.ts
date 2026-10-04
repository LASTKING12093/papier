import type { Command } from "../../../packages/editor-state/types";
export type Template = {
  id: string;
  name: string;
  category: string;
  width: number;
  height: number;
  version: number;
  font: string;
  size: number;
  margins: [number, number, number, number];
  leading: number;
  pages: Element[][];
  note?: string;
};
export type Element = {
  type: "text" | "rule" | "field" | "panel";
  x: number;
  y: number;
  width?: number;
  height?: number;
  size?: number;
  font?: string;
  text?: string;
  color?: number[];
  align?: "center";
  name?: string;
};
import catalog from "../public/presets/templates-v1.json";
export const templates = catalog as Template[];
export type TemplateConfig = {
  name: string;
  width: number;
  height: number;
  pages: number;
  font: string;
  size: number;
  margin: number;
  leading: number;
};
export function templateCommands(t: Template, c: TemplateConfig): Command[] {
  const out: Command[] = [];
  const scaleX = c.width / t.width,
    scaleY = c.height / t.height;
  t.pages.forEach((elements, page) =>
    elements.forEach((el) => {
      const x = el.x * scaleX + (c.margin - t.margins[3]),
        y = el.y * scaleY;
      const width = Math.max(
        24,
        Math.min((el.width ?? 480) * scaleX, c.width - x - c.margin),
      );
      if (el.type === "panel")
        out.push({
          kind: "shape",
          page,
          rect: { x, y, width, height: (el.height ?? 40) * scaleY },
          shape: "rectangle",
          color: el.color ?? [235, 240, 247, 255],
          width: 0,
          fill: true,
        });
      else if (el.type === "rule")
        out.push({
          kind: "shape",
          page,
          rect: { x, y, width, height: 1 },
          shape: "line",
          color: [163, 174, 190, 255],
          width: 0.6,
          fill: false,
        });
      else if (el.type === "field")
        out.push({
          kind: "field",
          page,
          rect: { x, y, width, height: 32 },
          name: el.name,
          field_type: "text",
          value: "",
          required: false,
        });
      else {
        const size = ((el.size ?? t.size) * c.size) / t.size;
        const max = Math.max(8, Math.floor(width / (size * 0.52)));
        let line = 0;
        for (const paragraph of (el.text ?? "").split("\n")) {
          let current = "";
          const emit = () => {
            if (current)
              out.push({
                kind: "add_text",
                page,
                rect: {
                  x,
                  y: y + line * size * c.leading,
                  width,
                  height: size * c.leading,
                },
                text: current,
                font: el.font ?? c.font,
                size,
                color: el.color ?? [29, 38, 52, 255],
              });
            line++;
          };
          for (const word of paragraph.split(" ")) {
            if (current.length + word.length + 1 > max && current) {
              emit();
              current = "";
            }
            current += (current ? " " : "") + word;
          }
          emit();
        }
      }
    }),
  );
  if (t.id === "abnt")
    out.push({
      kind: "page_numbers",
      pages: [3, 4, 5, 6],
      start: 4,
      prefix: "",
    });
  return out;
}
