# Architecture

Papier is a Windows desktop application built with Tauri 2, React and TypeScript. UI source is under `apps/desktop/src`; semantic styling and document-state helpers live in `packages`.

The native shell in `apps/desktop/src-tauri` exposes an allowlisted IPC interface. File selection, saving, certificate access and native window behavior use Windows/native APIs. Production assets are embedded by Tauri. The Vite development adapter is loopback-only and is excluded from production builds.

`crates/pdf-core` owns document sessions, parsing and transformations. A child worker process loads bundled PDFium for rendering/object editing and lopdf for PDF structure operations. qpdf handles validation, repair and optimization. Offline Tesseract.js/WASM provides OCR in the frontend using packaged language data.

Changes create document revisions with bounded undo history. Save operations use temporary output and replacement, and check the original fingerprint to avoid silently overwriting external edits. The app stores recovery snapshots and a bounded recent-file library locally. A separate worker and timeouts improve failure containment but are not an OS-level sandbox.

Font replacement uses bundled OFL fonts. The signature studio composes local vector outlines; it does not contact an AI service. Visual signatures and Windows certificate signatures are distinct features.

PDF editing is object-based. Complex PDFs can contain split text runs, unavailable fonts or flattened/scanned content. There is no document-wide word-processor reflow or universal font preservation. Unsupported operations should produce an explicit error rather than imply success.
