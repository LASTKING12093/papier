export type InkPoint = number[];
export type InkMode = "Original" | "Smooth" | "Smart shapes";
const distance = (a: InkPoint, b: InkPoint) =>
  Math.hypot(a[0] - b[0], a[1] - b[1]);
const segmentDistance = (p: InkPoint, a: InkPoint, b: InkPoint) => {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    t = Math.max(
      0,
      Math.min(
        1,
        ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1),
      ),
    );
  return distance(p, [a[0] + t * dx, a[1] + t * dy]);
};
// Arc-length sampling makes smoothing independent of mouse event rate.
function resample(points: InkPoint[], step: number) {
  const out = [points[0].slice()];
  let remaining = step;
  for (let i = 1; i < points.length; i++) {
    let a = points[i - 1],
      b = points[i],
      length = distance(a, b);
    while (length >= remaining && out.length < 2048) {
      const t = remaining / length;
      a = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      out.push(a);
      length = distance(a, b);
      remaining = step;
    }
    remaining -= length;
  }
  if (distance(out[out.length - 1], points[points.length - 1]) > 0.001)
    out.push(points[points.length - 1].slice());
  return out;
}
export function reconstructInk(
  input: InkPoint[],
  mode: InkMode = "Smooth",
  strength = 0.6,
): { points: InkPoint[]; kind: string } {
  const points = input
    .filter(
      (p) => p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]),
    )
    .filter((p, i, all) => i === 0 || distance(p, all[i - 1]) > 0.001)
    .map((p) => p.slice(0, 2));
  if (points.length < 3 || mode === "Original")
    return { points, kind: "Original" };
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]),
    x = Math.min(...xs),
    y = Math.min(...ys),
    w = Math.max(...xs) - x,
    h = Math.max(...ys) - y,
    diagonal = Math.hypot(w, h);
  if (diagonal < 0.1) return { points, kind: "Original" };
  const length = points
      .slice(1)
      .reduce((sum, p, i) => sum + distance(points[i], p), 0),
    a = points[0],
    b = points.at(-1)!;
  const sampled = resample(
    points,
    Math.max(length / 500, diagonal / 180, 0.05),
  );
  if (mode === "Smart shapes") {
    const chord = distance(a, b),
      lineError = Math.sqrt(
        sampled.reduce((sum, p) => sum + segmentDistance(p, a, b) ** 2, 0) /
          sampled.length,
      );
    if (
      chord > 0.6 * diagonal &&
      length < chord * 1.3 &&
      lineError < diagonal * 0.028
    )
      return { points: [a, b], kind: "Straight line" };
    const closed = distance(a, b) < diagonal * 0.16;
    if (
      closed &&
      w > diagonal * 0.2 &&
      h > diagonal * 0.2 &&
      length > diagonal * 2 &&
      length < diagonal * 3.8
    ) {
      const edgeError =
        sampled.reduce(
          (sum, p) =>
            sum +
            Math.min(
              Math.abs(p[0] - x),
              Math.abs(p[0] - x - w),
              Math.abs(p[1] - y),
              Math.abs(p[1] - y - h),
            ),
          0,
        ) / sampled.length;
      const corners = [
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
      ];
      if (
        edgeError < diagonal * 0.022 &&
        corners.every((c) =>
          sampled.some((p) => distance(p, c) < diagonal * 0.09),
        )
      ) {
        // Duplicate corner knots keep the shared cubic renderer from rounding square corners.
        const start = corners.reduce(
          (best, c, i) =>
            distance(c, a) < distance(corners[best], a) ? i : best,
          0,
        );
        const ordered = Array.from(
          { length: 5 },
          (_, i) => corners[(start + i) % 4],
        );
        return {
          points: ordered.flatMap((p) => [p.slice(), p.slice(), p.slice()]),
          kind: "Rectangle",
        };
      }
      const cx = x + w / 2,
        cy = y + h / 2,
        error = Math.sqrt(
          sampled.reduce(
            (sum, p) =>
              sum +
              (Math.hypot((p[0] - cx) / (w / 2), (p[1] - cy) / (h / 2)) - 1) **
                2,
            0,
          ) / sampled.length,
        );
      if (error < 0.1) {
        const start = Math.atan2((a[1] - cy) / (h / 2), (a[0] - cx) / (w / 2));
        return {
          points: Array.from({ length: 65 }, (_, i) => [
            cx + (w / 2) * Math.cos(start + (i * Math.PI) / 32),
            cy + (h / 2) * Math.sin(start + (i * Math.PI) / 32),
          ]),
          kind: Math.abs(w - h) / Math.max(w, h) < 0.12 ? "Circle" : "Ellipse",
        };
      }
    }
  }
  const amount = Math.max(0, Math.min(1, strength)),
    radius = 2 + Math.round(amount * 5);
  const smoothed = sampled.map((p, i) => {
    if (i === 0 || i === sampled.length - 1) return p;
    let sx = 0,
      sy = 0,
      weight = 0;
    for (
      let j = Math.max(0, i - radius);
      j <= Math.min(sampled.length - 1, i + radius);
      j++
    ) {
      const k = radius + 1 - Math.abs(i - j);
      sx += sampled[j][0] * k;
      sy += sampled[j][1] * k;
      weight += k;
    }
    return [
      p[0] + (sx / weight - p[0]) * amount,
      p[1] + (sy / weight - p[1]) * amount,
    ];
  });
  return { points: smoothed, kind: "Smoothed stroke" };
}
