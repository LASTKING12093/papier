# Third-party notices

Papier's application code is MIT licensed. That license does not replace the licenses of bundled libraries, font data or platform runtimes. Original copyright notices remain with their components.

## Application and native dependencies

`licenses/dependencies.json` records exact versions, declared licenses, source locations and notice filenames for npm runtime packages and the resolved Windows Rust build graph. `Cargo.lock` and `package-lock.json` pin source dependencies. The installer includes collected texts under `licenses/dependencies` and PDFium notices under `licenses/pdfium`.

| Component | Version / source | License and distribution |
|---|---|---|
| React / React DOM | See npm inventory | MIT; frontend bundle |
| Tauri | See Rust/npm inventories | MIT OR Apache-2.0; desktop shell, IPC and adapted NSIS template |
| PDFium | chromium/8076, [verified distribution](https://github.com/bblanchon/pdfium-binaries/releases/tag/chromium%2F8076) | BSD-style license; native DLL and separate retained dependency notices. V8 and XFA disabled. |
| pdfium-render | See Rust inventory | MIT OR Apache-2.0; native bindings |
| lopdf | 0.42.0 | MIT; native PDF structure processing |
| qpdf | [12.4.2](https://github.com/qpdf/qpdf/releases/tag/v12.4.2) | Apache-2.0; unchanged Windows distribution; upstream LICENSE and NOTICE retained |
| Tesseract.js / core | See npm inventory | Apache-2.0; offline worker and WASM |
| tessdata_fast | Hash-pinned English, Portuguese and Spanish in `vendor/ocr-languages.json` | Apache-2.0; local language models |

Unmodified MPL-2.0 crates in the Windows build are cssparser, cssparser-macros, dtoa-short, option-ext and selectors. Their exact versions and freely downloadable source locations are in the inventory. Their source remains available under MPL-2.0; Papier's MIT license does not restrict those rights. The release also provides their source archive.

## Fonts and converted outline data

All distributed font files and the signature outline atlas remain under **SIL Open Font License 1.1**, not MIT. Complete original notices are retained in `assets/fonts`, `vendor/signature-fonts`, and the installed notices directory.

| Family | Source | Distributed form |
|---|---|---|
| Noto Sans | [Noto fonts](https://github.com/notofonts/noto-fonts/tree/main/hinted/ttf/NotoSans) | Regular TTF; unchanged |
| Manrope | [Google Fonts](https://github.com/google/fonts/tree/main/ofl/manrope) | Static regular instance |
| Noto Serif | [Google Fonts](https://github.com/google/fonts/tree/main/ofl/notoserif) | Static regular and italic instances |
| Roboto Mono | [Google Fonts](https://github.com/google/fonts/tree/main/ofl/robotomono) | Static regular instance |
| Cormorant Garamond | [Google Fonts](https://github.com/google/fonts/tree/main/ofl/cormorantgaramond) | Static regular instance |
| Caveat | [Google Fonts](https://github.com/google/fonts/tree/main/ofl/caveat) | Static regular instance |
| Allura | [Google Fonts](https://github.com/google/fonts/tree/main/ofl/allura) | Original TTF; converted outline data named Papier Script A |
| Mr De Haviland | [Google Fonts](https://github.com/google/fonts/tree/main/ofl/mrdehaviland) | Original TTF; converted outline data named Papier Script B |
| Nothing You Could Do | [Google Fonts](https://github.com/google/fonts/tree/main/ofl/nothingyoucoulddo) | Original TTF; converted outline data named Papier Script C |
| Sacramento | [Google Fonts](https://github.com/google/fonts/tree/main/ofl/sacramento) | Original TTF; converted outline data named Papier Script D |
| Qwigley | [Google Fonts](https://github.com/google/fonts/tree/main/ofl/qwigley) | Original TTF; converted outline data named Papier Script E |

Static instances use weight 400 and width 100 where applicable. Upstream and distributed hashes are recorded in `assets/fonts/curated-sources.json`. The signature atlas samples curves, normalizes coordinates and includes a Latin subset. Its internal family names differ from upstream reserved names; geometry is unchanged by renaming. Font authors do not endorse Papier. Documents and artwork created using these fonts do not become OFL-licensed solely by using them.

Segoe UI and other system font names are references only; their files are not redistributed.

## Windows prerequisites and redistributables

The qpdf Windows distribution includes Microsoft Visual C++ runtime DLLs. These are Microsoft redistributable components, not MIT software. Their terms are included under `licenses/upstream`; see [Microsoft Visual C++ Runtime terms](https://visualstudio.microsoft.com/license-terms/vs2022-cruntime/). Windows, .NET Framework/WPF and WebView2 are Microsoft platform components governed by Microsoft's terms. WebView2 may be downloaded by the installer when missing.

## Original assets

The Papier mark, application glyphs, templates and synthetic demo compositions are project assets under the project license. They do not contain third-party product branding or copied proprietary interface assets. Upstream names and credits above identify contributions without implying affiliation.
