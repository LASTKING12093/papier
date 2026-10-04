import { useSyncExternalStore } from "react";
export const defaults = {
  motion: "Full",
  ambient: true,
  glass: true,
  snap: true,
  nudge: 1,
  defaultFont: "Noto Sans",
  zoom: 100,
  layout: "Continuous",
  signatureColor: "#202b40",
  signatureWidth: 220,
  ocrLanguage: "eng",
  ocrScale: 3,
  ocrConfidence: 20,
  renderScale: 2,
  cachePages: 24,
};
export type Preferences = typeof defaults;
let value: Preferences = { ...defaults };
try {
  const saved = JSON.parse(localStorage.getItem("papier-preferences") ?? "{}");
  for (const key of Object.keys(defaults) as (keyof Preferences)[])
    if (typeof saved[key] === typeof defaults[key])
      (value as Record<string, unknown>)[key] = saved[key];
} catch {
  /* Use defaults when local data is damaged. */
}
// Older installations used System. Motion is now explicitly owned by Papier.
if (value.motion !== "Reduced") value.motion = "Full";
const listeners = new Set<() => void>();
export const getPreferences = () => value;
export function setPreference<K extends keyof Preferences>(
  key: K,
  v: Preferences[K],
) {
  value = { ...value, [key]: v };
  localStorage.setItem("papier-preferences", JSON.stringify(value));
  listeners.forEach((fn) => fn());
  applyPreferences();
}
export function resetPreferences() {
  value = { ...defaults };
  localStorage.removeItem("papier-preferences");
  listeners.forEach((fn) => fn());
  applyPreferences();
}
export function usePreferences() {
  return useSyncExternalStore((cb) => {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }, getPreferences);
}
function applyPreferences() {
  const root = document.documentElement;
  root.dataset.motion = value.motion.toLowerCase();
  root.dataset.ambient = String(value.ambient);
  root.dataset.glass = String(value.glass);
}
applyPreferences();
