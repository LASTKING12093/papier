import { describe, it, expect } from "vitest";
import { reconstructInk } from "../../packages/editor-state/ink";
import { generate } from "../../apps/desktop/src/signature-vectors";
describe("local ink reconstruction", () => {
  it("keeps endpoints, reduces tremor and does not mutate the raw gesture", () => {
    const input = Array.from({ length: 181 }, (_, i) => [
      i,
      i === 0 || i === 180 ? 20 : 20 + Math.sin(i * 2.1) * 4,
    ]);
    const copy = JSON.stringify(input);
    const result = reconstructInk(input, "Smooth", 0.9);
    expect(result.points[0]).toEqual(input[0]);
    expect(result.points.at(-1)).toEqual(input.at(-1));
    expect(JSON.stringify(input)).toBe(copy);
    expect(
      result.points.reduce((s, p) => s + (p[1] - 20) ** 2, 0) /
        result.points.length,
    ).toBeLessThan(2);
  });
  it("recognizes a rough closed ellipse and returns a closed vector contour", () => {
    const input = Array.from({ length: 121 }, (_, i) => {
      const t = (i * Math.PI) / 60;
      return [
        100 + (50 + Math.sin(i * 2) * 1.5) * Math.cos(t),
        80 + (30 + Math.cos(i * 3)) * Math.sin(t),
      ];
    });
    const result = reconstructInk(input, "Smart shapes");
    expect(result.kind).toBe("Ellipse");
    expect(result.points[0][0]).toBeCloseTo(result.points.at(-1)![0], 5);
    expect(result.points[0][1]).toBeCloseTo(result.points.at(-1)![1], 5);
  });
  it("recognizes all four rectangle edges but leaves an open scribble as handwriting", () => {
    const corners = [
      [0, 0],
      [100, 0],
      [100, 60],
      [0, 60],
      [0, 0],
    ];
    const input = corners
      .slice(0, -1)
      .flatMap((a, i) =>
        Array.from({ length: 30 }, (_, j) => [
          a[0] + ((corners[i + 1][0] - a[0]) * j) / 30,
          a[1] + ((corners[i + 1][1] - a[1]) * j) / 30,
        ]),
      );
    input.push([0, 0]);
    expect(reconstructInk(input, "Smart shapes").kind).toBe("Rectangle");
    expect(
      reconstructInk(
        [
          [0, 50],
          [10, 0],
          [20, 60],
          [30, 0],
          [40, 65],
          [50, 20],
        ],
        "Smart shapes",
      ).kind,
    ).toBe("Smoothed stroke");
  });
  it("filters invalid samples, respects original mode, and recognizes a straight line", () => {
    expect(
      reconstructInk(
        [
          [0, 0],
          [1, 2],
          [NaN, 2],
          [4, 5],
        ],
        "Original",
      ).points,
    ).toEqual([
      [0, 0],
      [1, 2],
      [4, 5],
    ]);
    expect(
      reconstructInk(
        Array.from({ length: 101 }, (_, i) => [i, i * 0.5 + Math.sin(i) * 0.3]),
        "Smart shapes",
      ).kind,
    ).toBe("Straight line");
    expect(reconstructInk([]).points).toEqual([]);
  });
});
describe("signature families", () => {
  it("uses distinct filled calligraphy and changes composition between batches", () => {
    const families=['Calligraphy','Personal','Expressive','Signature monogram'].map(style=>generate('João Almeida',style,3));
    expect(new Set(families.map(s=>JSON.stringify(s.paths))).size).toBe(4);
    for(const s of families){expect(s.filled).toBe(true);expect(s.paths.length).toBeGreaterThan(3);expect(s.paths.flat().every(p=>p.every(Number.isFinite))).toBe(true);}
    const single=generate('João Almeida','Calligraphy',3),stacked=generate('João Almeida','Calligraphy',7);
    expect(stacked.width/stacked.height).toBeLessThan(single.width/single.height*.85);
    expect(generate('João Almeida','Calligraphy',3)).toEqual(single);
  });
  it("keeps long signatures inside the native vector budget",()=>{
    for(const style of ['Calligraphy','Personal','Expressive','Signature monogram']){
      const mark=generate('Alex Ávila de Oliveira Santos '.repeat(3),style,17);
      expect(mark.paths.length).toBeLessThan(800);expect(mark.paths.flat().length).toBeLessThan(100000);
      expect(Number.isFinite(mark.width)&&Number.isFinite(mark.height)).toBe(true);
      expect(generate(' ',style,9).paths).toHaveLength(0);
    }
  });
  it("does not generate a meaningless mark for an empty name", () => {
    for (const style of ["Natural", "Editorial", "Monogram", "Rubric"])
      expect(generate(" ", style, 1).paths).toHaveLength(0);
  });
  it("has four different constructions and reproducible, non-repeating batches", () => {
    const families = ["Natural", "Architect", "Editorial", "Monogram"].map(
      (s) => generate("João Almeida", s, 1),
    );
    expect(new Set(families.map((s) => JSON.stringify(s.paths))).size).toBe(4);
    expect(families[2].height).toBeGreaterThan(families[1].height);
    expect(families[3].width).toBeLessThan(families[1].width);
    const batches = Array.from({ length: 16 }, (_, i) =>
      generate("João Almeida", "Natural", i),
    );
    expect(new Set(batches.map((s) => JSON.stringify(s.paths))).size).toBe(16);
    expect(generate("João Almeida", "Natural", 9)).toEqual(
      generate("João Almeida", "Natural", 9),
    );
    for (const s of families)
      expect(s.paths.flat().every((p) => p.every(Number.isFinite))).toBe(true);
  });
});
