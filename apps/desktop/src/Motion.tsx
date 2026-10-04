import { useEffect, useRef } from "react";
import { usePreferences } from "./preferences";

/** Light follows the pointer with momentum, without rendering React on every frame. */
export function HomeLight() {
  const ref = useRef<HTMLDivElement>(null);
  const { ambient, motion } = usePreferences();
  useEffect(() => {
    const field = ref.current;
    const home = field?.parentElement;
    if (!field || !home || !ambient || motion === "Reduced") return;
    let frame = 0, previous = 0;
    let width = home.clientWidth, height = home.clientHeight;
    let x = 0.28, y = 0.35, targetX = x, targetY = y;
    let running = true;
    const paint = (time: number) => {
      const dt = Math.min(40, previous ? time - previous : 16);
      previous = time;
      const ease = 1 - Math.exp(-dt / 155);
      x += (targetX - x) * ease;
      y += (targetY - y) * ease;
      field.style.setProperty("--light-x", `${x * 100}%`);
      field.style.setProperty("--light-y", `${y * 100}%`);
      field.style.setProperty("--light-px", `${x * width}px`);
      field.style.setProperty("--light-py", `${y * height}px`);
      home.style.setProperty("--brand-tilt-x", `${(y - .5) * -12}deg`);
      home.style.setProperty("--brand-tilt-y", `${(x - .5) * 16}deg`);
      if (Math.abs(x - targetX) + Math.abs(y - targetY) > .0001 && running)
        frame = requestAnimationFrame(paint);
      else frame = 0;
    };
    const start = () => { if (!frame && running) { previous = 0; frame = requestAnimationFrame(paint); } };
    const move = (e: PointerEvent) => {
      const bounds = home.getBoundingClientRect();
      targetX = Math.max(0, Math.min(1, (e.clientX - bounds.left) / bounds.width));
      targetY = Math.max(0, Math.min(1, (e.clientY - bounds.top) / bounds.height));
      start();
    };
    const leave = () => { targetX = .28; targetY = .35; start(); };
    const visibility = () => {
      running = !document.hidden;
      if (!running) { cancelAnimationFrame(frame); frame = 0; }
      else start();
    };
    home.addEventListener("pointermove", move, { passive: true });
    home.addEventListener("pointerleave", leave);
    document.addEventListener("visibilitychange", visibility);
    const resize = new ResizeObserver(() => {
      width = home.clientWidth; height = home.clientHeight; start();
    });
    resize.observe(home);
    start();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      home.removeEventListener("pointermove", move);
      home.removeEventListener("pointerleave", leave);
      document.removeEventListener("visibilitychange", visibility);
      home.style.removeProperty("--brand-tilt-x");
      home.style.removeProperty("--brand-tilt-y");
    };
  }, [ambient, motion]);
  return <div ref={ref} className="home-light" aria-hidden="true">
    <div className="light-follow"><i /><span /></div>
    <div className="light-horizon" /><div className="light-reflection" />
  </div>;
}

/** Shared press feedback stays on icons; PDF geometry and hit targets never animate. */
export function ProductMotion() {
  const { motion } = usePreferences();
  useEffect(() => {
    if (motion === "Reduced") return;
    const animations = new Set<Animation>();
    const press = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && !["Enter", " "].includes(event.key)) return;
      if (event instanceof PointerEvent && event.button !== 0) return;
      const button = event.target instanceof Element ? event.target.closest("button") : null;
      if (!button || button.disabled || button.closest(".pdf-page, .window-controls")) return;
      const icon = button.querySelector(":scope > svg:not(.spin)");
      if (!icon) return;
      icon.getAnimations().forEach(a => a.cancel());
      const animation = icon.animate([
        { transform: "scale(1)" },
        { transform: "scale(.78)", offset: .24 },
        { transform: "scale(1.08)", offset: .68 },
        { transform: "scale(1)" },
      ], { duration: 320, easing: "cubic-bezier(.22,.8,.3,1)" });
      animations.add(animation);
      void animation.finished.catch(() => {}).finally(() => animations.delete(animation));
    };
    document.addEventListener("pointerdown", press, true);
    document.addEventListener("keydown", press, true);
    return () => {
      document.removeEventListener("pointerdown", press, true);
      document.removeEventListener("keydown", press, true);
      animations.forEach(a => a.cancel());
    };
  }, [motion]);
  return null;
}
