# Security

## Report privately

Please use [GitHub private vulnerability reporting](https://github.com/LASTKING12093/papier/security/advisories/new). Do not post a vulnerability or a confidential PDF in a public issue.

Include the Papier version, Windows version, affected workflow, expected and actual behavior, and reproducible steps. Prefer a minimal synthetic PDF that reproduces the issue. Remove credentials, personal paths, names and document content from logs and screenshots. Share sensitive reproduction material only through the private report.

The latest public release is the supported version. This is a community-maintained project; there is no guaranteed response time. Confirmed fixes will be documented in release notes and, when appropriate, a security advisory.

## Security model

PDFs are untrusted input. Papier uses a separate native worker, input-size limits, operation timeouts and restricted frontend IPC. The bundled PDFium build disables JavaScript/V8 and XFA. The worker is a separate process, **not an operating-system security sandbox**. Keep Papier and Windows updated, and do not treat any document parser as immune to malformed files.

Certificate signing uses Windows certificate providers rather than storing exported private keys in Papier. Visual signature artwork is not a digital certificate or proof of identity. See [Privacy](docs/PRIVACY.md) and [Architecture](docs/ARCHITECTURE.md).
