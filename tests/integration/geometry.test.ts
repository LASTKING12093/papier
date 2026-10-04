import { describe, expect, it } from 'vitest';
import { resizeRect, snapAxis, rotationDelta } from '../../packages/editor-state/geometry';
const b = { x: 50, y: 60, width: 200, height: 20 };
describe('direct manipulation', () => {
  it.each(['nw','n','ne','e','se','s','sw','w'])('keeps text proportional and the opposite anchor fixed: %s', handle => {
    const r = resizeRect(b, handle, handle.includes('w') ? -50 : 50, handle.includes('n') ? -10 : 10, true);
    expect(r.width / r.height).toBeCloseTo(10);
    expect(r.width).toBeGreaterThan(b.width);
    if (handle.includes('w')) expect(r.x + r.width).toBeCloseTo(b.x + b.width);
    if (handle.includes('n')) expect(r.y + r.height).toBeCloseTo(b.y + b.height);
    if (handle === 'n' || handle === 's') expect(r.x + r.width / 2).toBeCloseTo(b.x + b.width / 2);
  });
  it('chooses one snap delta without chaining corrections', () => {
    expect(snapAxis(70, 100, [72, 171, 120.5], 4)).toEqual({position:70.5,guide:120.5});
  });
  it('rotates relative to the grab point without an initial jump', () => {
    expect(rotationDelta([153,30],[153,30],b,false)).toBe(0);
    expect(rotationDelta([150,30],[190,70],b,true)).toBe(90);
  });
  it('does not invert when the pointer crosses the opposite edge', () => {
    const r = resizeRect(b,'nw',500,500,true);
    expect(r.width).toBeGreaterThanOrEqual(4); expect(r.height).toBeGreaterThanOrEqual(4);
    expect(r.x + r.width).toBeCloseTo(250);
  });
});
