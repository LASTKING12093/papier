# Release audit — 1.0.3

This is a scoped engineering review, not a claim that PDF processing is risk-free.

## Source and dependency review

The public tree is an explicit source allowlist. Internal screenshots, recovery libraries, test-generated certificate keys, caches, installers and historical build output are excluded. A new Git history uses the maintainer's verified GitHub identity and noreply address. Synthetic fixtures and demo documents are identified as such.

Gitleaks and a separate byte/UTF-16 privacy scan cover source and deliverables. Upstream license contacts are retained attribution. The OCR virtual filesystem path `/home/web_user` is an Emscripten constant, not a developer profile. Base64 WASM can produce token-shaped false positives. Microsoft-signed runtime binaries retain upstream build-server symbol references; they are not this project's machine paths and the binaries are not modified.

The release compiler remaps source paths. Production configuration removes the Vite development URL and the browser development adapter. PDB files, raw logs and machine-specific scan reports are not release assets.

## Dependency findings

The npm lockfile audit returned no known vulnerabilities at review time. OSV was queried against the final Cargo.lock on 2026-10-04. The Windows build graph is recorded separately in `licenses/dependencies.json`.

- `lopdf` was updated from 0.38.0 to 0.42.0 to address [RUSTSEC-2026-0187](https://rustsec.org/advisories/RUSTSEC-2026-0187.html), an unbounded nesting/stack exhaustion issue. Native PDF round-trip tests passed after the update.
- `glib` 0.18.5 has [RUSTSEC-2024-0429](https://rustsec.org/advisories/RUSTSEC-2024-0429.html). It is a non-Windows dependency and is absent from the shipped Windows graph. Linux is not a supported release target.
- `proc-macro-error` 1.0.4 has an unmaintained advisory and is absent from the Windows graph.
- `ttf-parser` 0.25.1 remains a transitive dependency of lopdf and has [RUSTSEC-2026-0192](https://rustsec.org/advisories/RUSTSEC-2026-0192.html), an unmaintained notice. This is a maintenance risk, not a known vulnerability fix that can be applied by a version bump. Track upstream replacement.

Advisories change over time; no scan establishes permanent safety.

## Network and input boundaries

Application source contains no analytics, document-upload or crash-upload integration. Production CSP restricts connections to application/native IPC origins. Offline OCR uses bundled worker, WASM and hash-verified language data. The browser integration test checks that OCR makes no external requests.

The installer may obtain WebView2 when missing. Windows/WebView2 maintenance and certificate trust services follow their own platform policies. The worker runs separately with request timeouts and input/history limits; it is not an operating-system security sandbox. PDFium is built without JavaScript/V8 or XFA.

## Distribution licensing

Original application code is MIT. Original font notices and OFL terms accompany fonts and renamed converted outline data. Unmodified MPL dependencies have a corresponding source archive. The Windows build uses Visual Studio Community and app-local Microsoft release runtime components covered by its [distributable-code terms](https://learn.microsoft.com/en-us/visualstudio/releases/2022/redistribution). They remain unmodified and are not relicensed under MIT. Anyone redistributing a rebuilt package must satisfy those platform terms.

See `THIRD_PARTY_NOTICES.md`, the exact dependency inventory and installed notices for component-specific terms.

## Signing and validation scope

The Papier installer is unsigned; no substitute or self-signed trust claim is made. Release validation uses an isolated installation folder and a clean application-data directory on a Windows machine with WebView2 already installed. A separate fresh Windows VM and the missing-WebView2 bootstrap path are not validated by this environment.

## Native QA correction

The native smoke test exposed a selection integrity bug: opening the inspector could shift the canvas under the pointer and be interpreted as a drag. Transform deltas now use pointer travel in window coordinates. A regression test reproduced the unwanted movement before the fix and passed afterward; drag, resize and typography round-trip tests also passed.

## Final validation

The release passed 27 browser workflows, 26 frontend unit tests, 14 native Rust tests and 10 checks against the installed production worker. Native UI QA verified editing and moving text, drawing, adding a page, saving/reopening, signature variations and placement, relaunch and recent files. The maintainer explicitly waived the native image-picker step; image insertion and transforms remain covered by automated browser tests. Silent uninstall succeeded.

The public source tree passed a clean dependency install, TypeScript checks, unit tests and a production frontend build. Published source files match the release build inputs. Public media uses synthetic documents and contains no EXIF metadata.
