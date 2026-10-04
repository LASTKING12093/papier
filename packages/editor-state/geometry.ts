import type { Rect } from "./types";

/** Page coordinates stay unbounded: captured pointers must keep following outside the page. */
export function resizeRect(
  b: Rect,
  handle: string,
  dx: number,
  dy: number,
  proportional: boolean,
): Rect {
  const hx = handle.includes("e") ? 1 : handle.includes("w") ? -1 : 0;
  const hy = handle.includes("s") ? 1 : handle.includes("n") ? -1 : 0;
  let width = Math.max(4, b.width + hx * dx);
  let height = Math.max(4, b.height + hy * dy);
  if (proportional) {
    // Project the pointer onto the original diagonal; short text lines never amplify y noise.
    const scale =
      hx && hy
        ? 1 +
          (hx * dx * b.width + hy * dy * b.height) /
            (b.width ** 2 + b.height ** 2)
        : hx
          ? width / b.width
          : height / b.height;
    const bounded = Math.max(4 / b.width, 4 / b.height, Math.min(100, scale));
    width = b.width * bounded;
    height = b.height * bounded;
  }
  return {
    x: b.x + (hx < 0 ? b.width - width : hx === 0 ? (b.width - width) / 2 : 0),
    y:
      b.y +
      (hy < 0 ? b.height - height : hy === 0 ? (b.height - height) / 2 : 0),
    width,
    height,
  };
}

export function snapAxis(
  position: number,
  length: number,
  targets: number[],
  threshold: number,
) {
  let delta = 0,
    distance = threshold,
    guide: number | undefined;
  for (const target of targets)
    for (const edge of [0, length / 2, length]) {
      const candidate = target - position - edge;
      if (Math.abs(candidate) < distance) {
        delta = candidate;
        distance = Math.abs(candidate);
        guide = target;
      }
    }
  return { position: position + delta, guide };
}

export function rotationDelta(
  start: number[],
  point: number[],
  b: Rect,
  snap: boolean,
) {
  const cx = b.x + b.width / 2,
    cy = b.y + b.height / 2;
  let degrees =
    ((Math.atan2(point[1] - cy, point[0] - cx) -
      Math.atan2(start[1] - cy, start[0] - cx)) *
      180) /
    Math.PI;
  degrees = ((degrees + 540) % 360) - 180;
  return snap ? Math.round(degrees / 15) * 15 : degrees;
}
