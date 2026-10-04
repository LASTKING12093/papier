import {getPreferences} from "./preferences";
import { createWorker, type Worker } from "tesseract.js";
import { api } from "./api";
import type { Session } from "../../../packages/editor-state/types";
export async function runOcr(
  doc: Session,
  pages: number[],
  language: string,
  progress: (s: string) => void,
  signal: AbortSignal,
): Promise<Session> {
  let worker: Worker | undefined;
  let current = doc;
  let pageIndex = 0;
  const cancel = () => {
    void worker?.terminate();
  };
  signal.addEventListener("abort", cancel);
  try {
    worker = await createWorker(language, 1, {
      workerPath: "/ocr/worker.min.js",
      corePath: "/ocr/core",
      langPath: "/ocr/data",
      gzip: false,
      logger: (m) => {
        if (m.status === "recognizing text")
          progress(
            `OCR · page ${pageIndex + 1} of ${pages.length} · ${Math.round(m.progress * 100)}%`,
          );
      },
    });
    for (const [i, page] of pages.entries()) {
      pageIndex = i;
      if (signal.aborted)
        throw new Error(
          "OCR cancelled. Completed pages remain in undo history.",
        );
      const width = Math.min(
        3000,
        Math.round(current.info.pages[page].width * getPreferences().ocrScale),
      );
      const image = await api<string>("render", current.id, { page, width });
      const result = await worker.recognize(
        image,
        {},
        { text: true, tsv: true },
      );
      const scale = current.info.pages[page].width / width;
      const words = (result.data.tsv ?? "")
        .split("\n")
        .slice(1)
        .flatMap((line) => {
          const c = line.split("\t");
          if (
            c.length < 12 ||
            c[0] !== "5" ||
            !c[11].trim() ||
            Number(c[10]) < getPreferences().ocrConfidence
          )
            return [];
          return [
            {
              text: c.slice(11).join("\t"),
              rect: {
                x: Number(c[6]) * scale,
                y: Number(c[7]) * scale,
                width: Number(c[8]) * scale,
                height: Number(c[9]) * scale,
              },
            },
          ];
        });
      if (signal.aborted)
        throw new Error(
          "OCR cancelled. Completed pages remain in undo history.",
        );
      if (words.length)
        current = await api<Session>("edit", current.id, {
          revision: current.revision,
          command: { kind: "ocr", page, words },
        });
    }
    return current;
  } finally {
    signal.removeEventListener("abort", cancel);
    await worker?.terminate();
  }
}
