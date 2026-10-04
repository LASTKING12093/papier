import { usePreferences } from "./preferences";
import { useId, useEffect, useRef, type CSSProperties } from "react";
export function Mark({
  size = 24,
  prism = false,
}: {
  size?: number;
  prism?: boolean;
}) {
  const preferences = usePreferences();
  const animated =
    preferences.ambient && preferences.motion !== "Reduced";
  const svg = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!animated || !prism) return;
    // Start after the SVG paint server is attached; Chromium otherwise freezes its first value.
    let next = 0;
    const frame = requestAnimationFrame(() => {
      next = requestAnimationFrame(() => {
        svg.current?.querySelectorAll("animate").forEach(el =>
          (el as SVGAnimationElement).beginElement());
      });
    });
    return () => { cancelAnimationFrame(frame); cancelAnimationFrame(next); };
  }, [animated, prism]);
  const id = useId().replaceAll(":", "");
  return (
    <svg
      ref={svg}
      className={prism ? "papier-mark prism-mark" : "papier-mark"}
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      {prism && (
        <defs>
          <linearGradient
            id={id}
            className="optic-gradient"
            x1="2"
            y1="3"
            x2="39"
            y2="38"
            gradientUnits="userSpaceOnUse"
          >
            {animated && (
              <>
                <animate
                  attributeName="x1"
                  values="-15;25;-15"
                  dur="14s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="y1"
                  values="3;18;3"
                  dur="18s"
                  repeatCount="indefinite"
                />
              </>
            )}
            <stop stopColor="#f1f6ff" />
            <stop offset=".28" stopColor="#bac8df" />
            <stop offset=".42" stopColor="#8fa9c9" />
            <stop offset=".54" stopColor="#e8f5ff" />
            <stop offset=".7" stopColor="#afd5e4" />
            <stop offset=".87" stopColor="#8d92bb" />
            <stop offset="1" stopColor="#e3e5f6" />
          </linearGradient>
          <linearGradient
            id={`${id}fold`}
            x1="24"
            y1="4"
            x2="35"
            y2="18"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#f5f9ff" />
            <stop offset=".55" stopColor="#f5f9ff" stopOpacity=".6" />
            <stop offset="1" stopColor="#8d92bb" stopOpacity=".8" />
          </linearGradient>
        </defs>
      )}
      <path
        fill={prism ? `url(#${id})` : "currentColor"}
        fillRule="evenodd"
        d="M7 5h18l8 8v10l-8 8H15v5H7V5Zm8 8v10h10V13H15Z"
      />
      <path
        d="M25 5v8h8L25 5Z"
        fill={prism ? `url(#${id}fold)` : "currentColor"}
        opacity={prism ? 1 : 0.45}
      />
      <path
        d="m15 23 10 8 8-8H15Z"
        fill={prism ? "#f5f9ff" : "currentColor"}
        opacity=".17"
      />
      <path
        d="M7.5 35.5v-30H24"
        stroke={prism ? "#fff" : "currentColor"}
        strokeOpacity=".38"
        strokeWidth=".5"
      />
    </svg>
  );
}
export function BrandLockup() {
  return (
    <div
      className="brand-lockup"
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty(
          "--optic-x",
          `${((e.clientX - r.left) / r.width - 0.5) * 10}deg`,
        );
        e.currentTarget.style.setProperty(
          "--optic-y",
          `${((e.clientY - r.top) / r.height - 0.5) * -8}deg`,
        );
      }}
      onPointerLeave={(e) => {
        e.currentTarget.style.setProperty("--optic-x", "0deg");
        e.currentTarget.style.setProperty("--optic-y", "0deg");
      }}
      style={{ "--optic-x": "0deg", "--optic-y": "0deg" } as CSSProperties}
    >
      <div className="brand-optic">
        <div className="brand-light" />
        <span className="brand-orbit" />
        <Mark size={112} prism />
        <span className="optic-glint" />
      </div>
      <h1 className="papier-wordmark">
        Papier
        <span className="wordmark-cut" />
      </h1>
    </div>
  );
}
