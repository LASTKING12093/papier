Papier's installer retains Tauri's install, update, WebView2, shortcut and uninstall handling.

- Upstream: https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.12.1/crates/tauri-bundler/src/bundle/windows/nsis/installer.nsi
- Upstream license: MIT / Apache-2.0 (Tauri dependency license notices are included in the bundle).
- Local changes: dark material colors, original Papier artwork, explicit installer/uninstaller/shortcut icons, Windows icon refresh notification, and percentage from the native NSIS progress control.
- NSIS reference: https://nsis.sourceforge.io/Docs/Modern%20UI%202/Readme.html and https://nsis.sourceforge.io/Docs/nsDialogs/Readme.html
- Regeneration: `scripts/installer-design.py`, using the pinned upstream template at `tmp/upstream-installer.nsi`. The generated `papier.nsi` is checked into the source tree so building does not fetch it.

The percentage measures actual installation instruction progress, including copying and registration. It is not a byte/download percentage or an estimated countdown. It stays below 100 until NSIS reports success. A WebView2 bootstrapper may need a network connection on machines without WebView2.
