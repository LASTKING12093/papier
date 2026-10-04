import { capitals } from "./signature-lettering";
import { calligraphy, calligraphyStyles } from "./signature-calligraphy";
// Original single-line handwriting primitives. No fonts, network or copied glyphs.
// Points become cubic Bézier strokes in the PDF engine and the preview.
export type Stroke = number[][];
export type Signature = {
  id: string;
  name: string;
  style: string;
  paths: Stroke[];
  width: number;
  height: number;
  stroke: number;
  color?: string;
  placementWidth?: number;
  filled?: boolean;
  recipe?: string;
};
const alphabet: Record<string, Stroke[]> = {
  a: [
    [
      [0, 12],
      [4, 5],
      [10, 5],
      [10, 13],
      [6, 17],
      [2, 15],
      [3, 9],
      [11, 5],
      [10, 16],
      [16, 12],
    ],
  ],
  b: [
    [
      [0, 13],
      [9, -5],
      [8, -9],
      [4, -5],
      [2, 16],
      [7, 17],
      [12, 12],
      [11, 6],
      [7, 7],
      [5, 14],
      [16, 12],
    ],
  ],
  c: [
    [
      [0, 12],
      [7, 5],
      [12, 6],
      [7, 4],
      [3, 9],
      [3, 15],
      [9, 17],
      [16, 12],
    ],
  ],
  d: [
    [
      [0, 12],
      [6, 5],
      [11, 6],
      [8, 16],
      [3, 16],
      [2, 11],
      [8, 6],
      [11, -7],
      [14, -9],
      [13, -2],
      [9, 16],
      [16, 12],
    ],
  ],
  e: [
    [
      [0, 12],
      [9, 9],
      [10, 5],
      [6, 5],
      [2, 10],
      [4, 16],
      [10, 16],
      [16, 12],
    ],
  ],
  f: [
    [
      [0, 12],
      [8, 2],
      [12, -8],
      [10, -10],
      [6, -5],
      [3, 12],
      [2, 28],
      [6, 23],
      [6, 14],
      [12, 10],
      [16, 12],
    ],
    [
      [1, 5],
      [12, 4],
    ],
  ],
  g: [
    [
      [0, 12],
      [7, 5],
      [11, 7],
      [9, 15],
      [3, 16],
      [2, 10],
      [9, 5],
      [11, 7],
      [8, 25],
      [3, 29],
      [-1, 26],
      [4, 21],
      [16, 12],
    ],
  ],
  h: [
    [
      [0, 13],
      [9, -7],
      [7, -10],
      [4, -5],
      [2, 17],
      [7, 6],
      [11, 6],
      [11, 16],
      [16, 12],
    ],
  ],
  i: [
    [
      [0, 12],
      [5, 7],
      [4, 16],
      [8, 16],
      [13, 12],
    ],
    [
      [6, 0],
      [6.5, 0.7],
    ],
  ],
  j: [
    [
      [0, 12],
      [6, 7],
      [5, 23],
      [1, 29],
      [-3, 27],
      [0, 23],
      [14, 12],
    ],
    [
      [7, 0],
      [7.5, 0.7],
    ],
  ],
  k: [
    [
      [0, 13],
      [8, -7],
      [6, -9],
      [3, -3],
      [2, 17],
    ],
    [
      [3, 11],
      [11, 5],
      [12, 8],
      [5, 12],
      [11, 16],
      [16, 12],
    ],
  ],
  l: [
    [
      [0, 13],
      [10, -7],
      [8, -10],
      [4, -6],
      [2, 10],
      [4, 17],
      [9, 16],
      [15, 12],
    ],
  ],
  m: [
    [
      [0, 12],
      [4, 6],
      [3, 16],
      [8, 6],
      [12, 6],
      [11, 16],
      [16, 6],
      [20, 6],
      [20, 16],
      [26, 12],
    ],
  ],
  n: [
    [
      [0, 12],
      [5, 6],
      [4, 16],
      [10, 6],
      [14, 7],
      [13, 16],
      [19, 12],
    ],
  ],
  o: [
    [
      [0, 12],
      [6, 5],
      [12, 7],
      [11, 14],
      [6, 17],
      [2, 13],
      [4, 7],
      [10, 6],
      [12, 10],
      [17, 12],
    ],
  ],
  p: [
    [
      [0, 12],
      [6, 6],
      [1, 29],
      [5, 8],
      [11, 5],
      [14, 10],
      [11, 16],
      [6, 16],
      [18, 12],
    ],
  ],
  q: [
    [
      [0, 12],
      [7, 5],
      [12, 7],
      [8, 16],
      [3, 15],
      [3, 9],
      [12, 6],
      [9, 27],
      [14, 21],
      [18, 12],
    ],
  ],
  r: [
    [
      [0, 12],
      [5, 6],
      [7, 2],
      [8, 6],
      [14, 6],
      [11, 10],
      [10, 16],
      [16, 12],
    ],
  ],
  s: [
    [
      [0, 12],
      [9, 5],
      [10, 2],
      [7, 7],
      [10, 12],
      [8, 17],
      [3, 16],
      [2, 13],
      [16, 12],
    ],
  ],
  t: [
    [
      [0, 12],
      [7, -4],
      [4, 14],
      [7, 17],
      [14, 12],
    ],
    [
      [1, 4],
      [12, 3],
    ],
  ],
  u: [
    [
      [0, 12],
      [5, 6],
      [4, 15],
      [8, 17],
      [13, 6],
      [11, 16],
      [17, 12],
    ],
  ],
  v: [
    [
      [0, 12],
      [5, 6],
      [5, 15],
      [10, 17],
      [16, 6],
      [17, 10],
      [21, 12],
    ],
  ],
  w: [
    [
      [0, 12],
      [5, 6],
      [5, 16],
      [10, 16],
      [14, 7],
      [14, 16],
      [19, 16],
      [23, 6],
      [25, 10],
      [28, 12],
    ],
  ],
  x: [
    [
      [0, 12],
      [5, 6],
      [12, 16],
      [18, 12],
    ],
    [
      [13, 5],
      [4, 17],
    ],
  ],
  y: [
    [
      [0, 12],
      [5, 6],
      [4, 15],
      [8, 16],
      [13, 6],
      [9, 24],
      [4, 29],
      [0, 27],
      [3, 22],
      [18, 12],
    ],
  ],
  z: [
    [
      [0, 12],
      [6, 6],
      [13, 7],
      [5, 14],
      [11, 13],
      [14, 16],
      [8, 27],
      [3, 29],
      [1, 26],
      [5, 21],
      [19, 12],
    ],
  ],
};
export const styles = [
  ...calligraphyStyles,
  "Natural",
  "Executive",
  "Elegant",
  "Quick",
  "Minimal",
  "Flow",
  "Compact",
  "Bold",
  "Architect",
  "Editorial",
  "Monogram",
  "Ribbon",
  "Rubric",
];
export function curve(points: Stroke): string {
  if (!points.length) return "";
  let d = `M${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)],
      p1 = points[i],
      p2 = points[i + 1],
      p3 = points[Math.min(points.length - 1, i + 2)];
    // Repeated knots constrain a corner; they must not create a looping cubic.
    if (p1[0] === p2[0] && p1[1] === p2[1]) continue;
    d += `C${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]} ${p2[1]}`;
  }
  return d;
}
export function normalize(paths: Stroke[]): {
  paths: Stroke[];
  width: number;
  height: number;
} {
  const points = paths.flat();
  if (!points.length) return { paths: [], width: 100, height: 40 };
  const x = Math.min(...points.map((p) => p[0])),
    y = Math.min(...points.map((p) => p[1])),
    w = Math.max(...points.map((p) => p[0])) - x,
    h = Math.max(...points.map((p) => p[1])) - y;
  return {
    paths: paths.map((s) => s.map((p) => [p[0] - x + 8, p[1] - y + 8])),
    width: w + 16,
    height: h + 16,
  };
}
export function generate(
  name: string,
  style: string,
  seed: number,
  slant = 0.2,
  flourish = 0.5,
  compactness = 1,
  stroke = 1.2,
): Signature {
  if (calligraphyStyles.includes(style))
    return calligraphy(name, style, seed, slant, flourish, compactness, stroke);
  const text = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z '-]/g, "")
    .slice(0, 70);
  const words = text.trim().split(/\s+/);
  if (!text.trim())
    return {
      id: "empty",
      name,
      style,
      paths: [],
      width: 100,
      height: 40,
      stroke,
    };
  const rubric = style === "Rubric";
  const letters = rubric ? words.map((w) => w[0]).join("") : text;
  let state =
    [...text].reduce(
      (h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619),
      seed * 7919 + 2166136261,
    ) >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const variation = Math.floor(random() * 4);
  if (["Architect", "Monogram"].includes(style)) {
    const mono = style === "Monogram";
    const label = (
      mono
        ? words
            .filter(Boolean)
            .map((w) => w[0])
            .slice(0, 3)
            .join("")
        : text
    ).toUpperCase();
    const paths: Stroke[] = [];
    let offset = 0;
    const spacing = mono ? 11 + random() * 6 : 23 + random() * 5;
    const lean = mono ? 0.03 + random() * 0.12 : slant * 0.22;
    for (const ch of label) {
      if (ch === " ") {
        offset += spacing * 0.5;
        continue;
      }
      const glyph = capitals[ch];
      if (!glyph) continue;
      const scale = mono ? 1.9 : 1;
      for (const line of glyph)
        paths.push(
          line.flatMap((p) => {
            const q = [
              offset + p[0] * scale + (24 - p[1]) * lean,
              (p[1] - 24) * scale + 48,
            ];
            return mono ? [q] : [q, q, q];
          }),
        );
      offset += spacing * compactness;
    }
    if (paths.length && flourish > 0.1) {
      const end = offset + (mono ? 20 : 0);
      if (mono && variation % 2 === 0) {
        paths.push(
          Array.from({ length: 49 }, (_, i) => [
            end / 2 + end * 0.64 * Math.cos((i * Math.PI) / 24),
            26 + 36 * Math.sin((i * Math.PI) / 24),
          ]),
        );
      } else
        paths.push([
          [0, 56],
          [end, 56],
        ]);
    }
    return {
      id: `${style}-${seed}-${text}`,
      name,
      style,
      ...normalize(paths),
      stroke: stroke * (mono ? 1.25 : 0.8),
    };
  }
  if (style === "Editorial") {
    const parts = words.filter(Boolean);
    const first = generate(
      parts[0] ?? "",
      "Elegant",
      seed,
      slant,
      flourish * 0.3,
      compactness,
      stroke,
    );
    const surname = generate(
      parts.slice(1).join(" ") || parts[0] || "",
      "Architect",
      seed + 137,
      0,
      0,
      compactness,
      stroke,
    );
    const scale = Math.min(
      1,
      (first.width / Math.max(1, surname.width)) * 0.85,
    );
    const paths = [
      ...first.paths,
      ...surname.paths.map((line) =>
        line.map((p) => [p[0] * scale, p[1] * scale + first.height + 5]),
      ),
    ];
    return {
      id: `Editorial-${seed}-${text}`,
      name,
      style,
      ...normalize(paths),
      stroke,
    };
  }
  const idx = styles
    .filter((s) => !calligraphyStyles.includes(s))
    .indexOf(style);
  const squeeze =
    compactness * ([1, 0.95, 1.13, 0.78, 0.9, 1.12, 0.7, 1, 1][idx] ?? 1);
  let x = 0,
    initial = true;
  const paths: Stroke[] = [];
  let main: Stroke = [];
  for (let i = 0; i < letters.length; i++) {
    const letter = letters[i].toLowerCase();
    if (letter === " ") {
      if (main.length) paths.push(main);
      main = [];
      x += 9;
      initial = true;
      continue;
    }
    const glyph = alphabet[letter];
    if (!glyph) continue;
    const scale = initial
      ? rubric
        ? 2.2 + variation * 0.16
        : 1.35 + random() * 0.7
      : 0.94 + random() * 0.15;
    const baseline =
      Math.sin(i * (0.4 + random() * 0.3) + seed) *
        (["Executive", "Minimal"].includes(style) ? 0.35 : 1.15) -
      i * (["Elegant", "Flow"].includes(style) ? 0.2 : 0.05);
    const transform = (p: number[]) => [
      (x + p[0] * scale + (17 - p[1]) * (slant + (variation - 1.5) * 0.035)) *
        squeeze,
      (p[1] - 17) * scale + baseline + 30,
    ];
    const segment = glyph[0].map(transform);
    if (initial && style !== "Minimal" && flourish > 0.25) {
      const lead = segment[0];
      paths.push([
        [lead[0] - 10 * flourish, lead[1] + 5],
        [lead[0] - 16 * flourish, lead[1] - 7],
        [lead[0] + 4, lead[1] - 22 * scale],
        [lead[0] + 10, lead[1] - 16 * scale],
        [lead[0] + 3, lead[1] - 5],
      ]);
    }
    if (main.length && initial) {
      paths.push(main);
      main = [];
    }
    if (style === "Minimal" || style === "Executive") {
      if (main.length) paths.push(main);
      main = segment;
    } else main.push(...segment);
    for (const lift of glyph.slice(1)) paths.push(lift.map(transform));
    x += (glyph[0].at(-1)![0] - 1) * scale * (1 + (variation - 1.5) * 0.025);
    initial = false;
  }
  if (main.length) paths.push(main);
  const w = x * squeeze;
  if (style === "Ribbon" && paths.length) {
    paths.push([
      [w * 0.06, 42],
      [w * 0.45, 50],
      [w * 0.94, 35],
      [w * 1.06, 29],
      [w * 0.82, 49],
      [w * 0.3, 57],
    ]);
  }

  if (flourish > 0.05 && style !== "Minimal") {
    if (rubric && variation === 0)
      paths.push([
        [w * 0.9, 28],
        [w * 1.16, 12],
        [w * 0.8, -22],
        [w * 0.15, -28],
        [-12, -4],
        [w * 0.14, 46],
        [w * 0.8, 49],
        [w * 1.1, 30],
        [w * 0.6, 40],
      ]);
    else if (rubric && variation === 1)
      paths.push([
        [-8, 41],
        [w * 0.2, 32],
        [w * 0.86, 33],
        [w * 1.13, 25],
        [w * 0.9, 36],
        [w * 0.42, 47],
        [-3, 48],
        [w * 0.34, 41],
        [w * 1.08, 38],
      ]);
    else if (rubric && variation === 2)
      paths.push([
        [w * 0.1, 52],
        [w * 0.24, 39],
        [w * 0.61, 22],
        [w * 0.9, 4],
        [w * 1.05, -14],
        [w * 0.98, -22],
        [w * 0.82, -11],
        [w * 0.92, 6],
        [w * 1.15, 12],
      ]);
    else
      paths.push([
        [w + 5, 30],
        [w + 10 + flourish * 14, 25],
        [w * 0.66, 40 + variation * 3],
        [w * 0.05, 46 + flourish * 9],
        [w * 0.22, 40],
        [w * (0.78 + flourish * 0.32), 35],
      ]);
  }
  return {
    id: `${style}-${seed}-${text}`,
    name,
    style,
    ...normalize(paths),
    stroke: stroke * (style === "Bold" ? 1.65 : 1),
  };
}
