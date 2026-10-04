import { describe, it, expect } from "vitest";
import { parsePages, reorderPages } from "../../packages/editor-state/types";
describe("page ranges", () => {
  it("deduplicates ranges and preserves selection order", () => {
    expect(parsePages("1, 3-5, 3", 5)).toEqual([0, 2, 3, 4]);
    expect(parsePages("all", 3)).toEqual([0, 1, 2]);
  });
  it("rejects malformed and out-of-bounds ranges", () => {
    for (const value of ["0", "1-9", "3-2", "x", "1,"])
      expect(() => parsePages(value, 5)).toThrow();
  });
});

describe("page group reordering", () => {
  it("preserves the order of a non-contiguous selection when moving forward", () => {
    expect(reorderPages(6, [1, 3], 1, 5)).toEqual([0, 2, 4, 5, 1, 3]);
  });
  it("moves selected pages before an earlier target", () => {
    expect(reorderPages(6, [2, 4], 4, 0)).toEqual([2, 4, 0, 1, 3, 5]);
  });
  it("does not reshuffle a group dropped on itself", () => {
    expect(reorderPages(4, [1, 2], 1, 2)).toEqual([0, 1, 2, 3]);
  });
});
