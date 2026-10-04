import {getPreferences} from "./preferences";
import { invoke, isTauri } from "@tauri-apps/api/core";
import type { Session } from "../../../packages/editor-state/types";
export const native = isTauri();
export async function api<T>(
  action: string,
  id?: string,
  payload?: unknown,
): Promise<T> {
  if (native) return invoke<T>("api", { action, id, payload });
  if (!import.meta.env.DEV) throw new Error("Open Papier as a desktop application.");
  const response = await fetch("/__engine", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, id, payload }),
  });
  const value = await response.json();
  if (!value.ok) throw new Error(value.error);
  return value.value;
}
export async function fileData(file: File): Promise<string> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  let raw = "";
  for (let i = 0; i < buffer.length; i += 32768)
    raw += String.fromCharCode(...buffer.subarray(i, i + 32768));
  return btoa(raw);
}
export function pickFile(accept = ".pdf"): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}
export async function openDocument(): Promise<Session | null> {
  if (native) return invoke("open_document");
  const file = await pickFile();
  return file
    ? api("import", undefined, { name: file.name, data: await fileData(file) })
    : null;
}
export async function download(
  data: string,
  name: string,
  type = "application/pdf",
  encoded = true,
) {
  if (native) {
    await invoke("export_file", { data, name, encoded });
    return;
  }
  const bytes = encoded
    ? Uint8Array.from(atob(data), (c) => c.charCodeAt(0))
    : data;
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export async function signDocument(id: string) {
  return invoke<{ integrity: boolean; signer: string; trust: string }>(
    "digital_sign",
    { id },
  );
}
export async function saveDocument(
  doc: Session,
  mode = "save",
): Promise<Session | null> {
  if (native) return invoke("save_document", { id: doc.id, mode, filename:doc.name });
  await download(await api<string>("export", doc.id), doc.name);
  return null;
}
const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();
export async function renderPage(
  doc: Session,
  page: number,
  width: number,
): Promise<string> {
  const key = `${doc.id}:${doc.revision}:${page}:${width}`;
  if (cache.has(key)) return cache.get(key)!;
  if (inflight.has(key)) return inflight.get(key)!;
  const promise = api<string>("render", doc.id, { page, width })
    .then((value) => {
      cache.set(key, value);
      while (cache.size > getPreferences().cachePages) cache.delete(cache.keys().next().value!);
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

export function clearRenderCache(){cache.clear();}
