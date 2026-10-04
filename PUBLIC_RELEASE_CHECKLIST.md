# Papier public release preparation

Publication gate: **OPEN**. Pre-publication audits passed; the native image-picker step was explicitly waived by the maintainer. Public source and release downloads have now been verified. Current application version: **1.0.3**. Product UI and features are frozen.

## Checklist

- [x] secret audit
- [x] personal-information audit
- [x] local-path audit
- [x] network/IP audit
- [x] build artifact audit
- [x] Git history audit
- [x] dependency audit
- [x] license audit
- [x] installer audit
- [x] screenshot/media audit
- [x] README complete
- [x] SECURITY.md complete
- [x] CONTRIBUTING.md complete
- [x] third-party notices complete
- [x] clean production build
- [x] installer tested
- [x] release assets verified
- [x] SHA-256 generated
- [x] final repository scan
- [x] public repo verification

## Process

Audit → sanitize → verify → prepare synthetic public media → final audit → create repository → push clean initial history → publish tested release → verify public source and downloads.

Existing internal screenshots, backups, audit outputs, caches, recovery data and historical installers are not public assets. Audit evidence remains local unless independently sanitized for publication. Unknown licensing, serious vulnerabilities, ambiguous authentication or failed release QA keep the gate closed.

## Verified evidence

- Public source: 218 allowlisted files; no generated binaries, local user data or caches staged.
- Gitleaks public tree: no findings. Independent byte/UTF-16 scan: 1,247 files and archive entries, no private-pattern matches.
- TypeScript and 26 unit tests pass in the clean public source tree; production frontend builds.
- 27 browser workflows, 14 native Rust tests, Clippy and Rust formatting pass.
- Installed production worker: 10 bundled-engine checks pass.
- Native UI: text selection/edit/move, page insertion, drawing, save/reopen, signature generation/variation/placement, relaunch and recent files verified. Native image-picker QA was explicitly waived by the maintainer; automated image workflows passed. Silent uninstall exited successfully and removed the test executable. Original local application data and installation metadata were restored.
- Five screenshots, nine-second GIF and social preview inspected; no EXIF in public media.
- Distribution is unsigned. Missing-WebView2 bootstrap and a fresh Windows VM were not tested.

- Clean initial Git history scanned with Gitleaks: no findings; verified public account and noreply commit identity.
- No known private information remains in the publishable tree or tested release assets within the documented scan scope.

- Public verification: anonymous source clone and asset downloads succeeded; both SHA-256 hashes match the tested originals. Downloaded source/archive scan found no private-pattern matches; downloaded Git history passed Gitleaks. The public installer opened at version 1.0.3 and was closed without changing the existing installation. README media loaded correctly.
