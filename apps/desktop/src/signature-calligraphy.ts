import atlas from "./signature-atlas.json";
import type { Signature, Stroke } from "./signature-vectors";
type Glyph = { advance: number; paths: Stroke[] };
const families = atlas as Record<string, Record<string, Glyph>>;
export const calligraphyStyles = [
  "Calligraphy",
  "Personal",
  "Expressive",
  "Signature monogram",
  "Fluent",
  "Ornamental",
];
export type LetteringProfile = {
  layout?: number;
  ornament?: number;
  contrast?: boolean;
  tracking?: number;
  capital?: number;
};
export function polygonPath(paths: Stroke[]) {
  return paths
    .map((p) => (p.length ? `M${p.map((q) => q.join(" ")).join("L")}Z` : ""))
    .join("");
}
export function calligraphy(
  name: string,
  style: string,
  seed: number,
  slant: number,
  flourish: number,
  compact: number,
  stroke: number,
  profile: LetteringProfile = {},
): Signature {
  const family =
    style === "Personal"
      ? "Papier Script C"
      : style === "Expressive"
        ? "Papier Script B"
        : style === "Fluent"
          ? "Papier Script D"
          : style === "Ornamental"
            ? "Papier Script E"
            : "Papier Script A";
  const glyphs = families[family];
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const words = name.trim().split(/\s+/),
    mono = style === "Signature monogram";
  const text = (
    mono
      ? words
          .map((w) => w[0])
          .slice(0, 3)
          .join("")
      : name
  ).slice(0, 60);
  let x = 0,
    row = 0,
    index = 0;
  const layout = profile.layout ?? seed % 3;
  const paths: Stroke[] = [];
  const width = compact * (0.94 + random() * 0.12),
    lean = (slant - 0.22) * 0.3;
  for (const ch of text) {
    if (ch === " " && !mono && layout === 1 && row === 0) {
      row = 1;
      x = 8;
      continue;
    }
    const activeGlyphs =
      profile.contrast && row ? families["Papier Script C"] : glyphs;
    const glyph = activeGlyphs[ch] ?? activeGlyphs[ch.normalize("NFD")[0]];
    if (!glyph) continue;
    const scale = mono
      ? 1.25
      : row
        ? 0.7
        : layout === 2 && index === 0
          ? (profile.capital ?? 1.25)
          : 1 + (random() - 0.5) * 0.018;
    const y = mono
      ? (layout === 1 ? index * 24 : 0) + (random() - 0.5) * 8
      : row
        ? 48
        : 0;
    for (const p of glyph.paths)
      paths.push(
        p.map((q) => [
          (x + q[0] * scale - q[1] * lean) * width,
          q[1] * scale + y,
        ]),
      );
    x +=
      glyph.advance *
        scale *
        (mono ? (layout === 1 ? 0.4 : 0.72) : (profile.tracking ?? 1)) +
      (style === "Personal" ? random() * 1.1 : 0);
    index++;
  }
  if (paths.length && flourish > 0.15 && profile.ornament !== 0) {
    const extent = paths.flat();
    const bottom = Math.max(...extent.map((p) => p[1]));
    const edge = Math.max(...extent.map((p) => p[0]));
    const baseline = bottom + 3 + random() * 6,
      tail = edge * (0.82 + random() * 0.2);
    const ornament = profile.ornament ?? 1;
    const points = Array.from({ length: 90 }, (_, i) => {
      const t = i / 89;
      return [
        ornament === 3
          ? edge * 0.5 + Math.cos(t * Math.PI * 2) * edge * 0.53
          : edge * 0.05 + tail * t,
        (ornament === 3
          ? bottom * 0.3 + Math.sin(t * Math.PI * 2) * 30
          : baseline) +
          Math.sin(t * Math.PI * (layout === 2 ? 2 : 1)) *
            flourish *
            (mono ? 13 : 7) -
          t * flourish * (ornament === 2 ? 28 : 8),
      ];
    });
    const thickness = 0.45 + stroke * 0.2;
    paths.push([
      ...points.map((p, i) => [
        p[0],
        p[1] - thickness * Math.sin(((i + 1) / 91) * Math.PI),
      ]),
      ...[...points]
        .reverse()
        .map((p, i) => [
          p[0],
          p[1] + thickness * Math.sin(((i + 1) / 91) * Math.PI),
        ]),
    ]);
  }
  const points = paths.flat();
  if (!points.length)
    return {
      id: `${style}-${seed}`,
      name,
      style,
      paths: [],
      width: 100,
      height: 40,
      stroke,
      filled: true,
    };
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]),
    minX = Math.min(...xs),
    minY = Math.min(...ys);
  return {
    id: `${style}-${seed}-${name}`,
    name,
    style,
    filled: true,
    paths: paths.map((p) => p.map((q) => [q[0] - minX + 5, q[1] - minY + 5])),
    width: Math.max(...xs) - minX + 10,
    height: Math.max(...ys) - minY + 10,
    stroke,
  };
}
