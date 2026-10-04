# Contributing to Papier

Small, focused contributions are welcome. For a substantial feature or workflow change, open an issue describing the problem before implementing it. Security reports belong in the [private reporting channel](SECURITY.md).

## Development on Windows

Install Node.js 22+, stable Rust with the MSVC toolchain, Microsoft C++ Build Tools with the Windows SDK, and WebView2. Normal users only need the installer.

```powershell
npm ci
node scripts/fetch-native.mjs
node scripts/fetch-qpdf.mjs
node scripts/prepare-ocr.mjs
npm run licenses
cargo build -p pdf-core --locked
npm run dev
```

The browser development adapter uses a loopback server and the local PDF worker. It is not a hosted edition of Papier. Use `npm run desktop` for the desktop shell. Python is only needed when regenerating synthetic fixtures or font assets; regular builds use the checked-in font data.

## Verify a change

```powershell
npm run check
npm test
cargo fmt --all -- --check
cargo test -p pdf-core --locked -- --test-threads=1
cargo clippy --workspace --all-targets --locked -- -D warnings
# With npm run dev running:
npx playwright test
```

Browser tests use Microsoft Edge and synthetic fixtures. Do not use personal documents or upload generated certificates, recovery files, logs or private paths. Keep the TypeScript types and Rust formatting consistent with neighboring code; run `cargo fmt --all` before submitting Rust changes.

## Pull requests

Explain the user-facing problem, the change and how it was tested. For UI changes, attach focused screenshots using fictional content. Preserve direct object movement, save/reopen behavior and keyboard access. Changes to parsing, fonts or packaging need relevant round-trip tests and updated third-party notices.

Contributions are offered under the project's MIT license unless a file is explicitly covered by another license. Font-derived data retains OFL terms. Keep upstream attribution intact.

## Release build

```powershell
npm run package
```

This generates dependency notices, applies compiler path remapping, builds the optimized native app and packages the custom Windows installer. Follow `PUBLIC_RELEASE_CHECKLIST.md` before making a public release. Do not commit installers or generated caches.
