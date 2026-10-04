# Your documents stay yours.

Papier processes PDF content on your computer. Editing, rendering, page organization, compression, visual comparison, signature artwork and OCR use local components. The shipped application has no document-upload service, analytics SDK, account requirement or automatic crash-upload endpoint.

## Local storage

- PDF edits are held in working sessions with undo history. Saving writes to the destination you choose; an existing source is checked for external changes before replacement.
- Recovery snapshots can contain complete document content. The recent-file library stores document names, thumbnails and source paths; imported documents may have local working copies.
- Preferences, favorite tools and signature artwork are stored in the app's local browser storage. Signature artwork can contain names and should be treated as personal data.
- OCR worker files and English, Portuguese and Spanish models are bundled. OCR does not require a remote recognition service.
- qpdf can create temporary working files for validation, repair and optimization. Normal completion removes these files; operating-system crashes can leave temporary data behind.

On Windows, app data generally lives under the current user's Local AppData directory in `org.pdfeditor.desktop`, including recovery/library data and WebView2 storage. The identifier is retained for compatibility. These files are not encrypted by Papier; use your operating system's account protection and disk encryption when needed.

## Removing data

Removing a recent entry does not delete the original PDF. Close Papier before manually removing its app-data directory. The uninstaller can remove application data when explicitly selected; this also removes local recovery copies and preferences. Keep independent copies of documents and signatures you want to retain. Normal uninstall does not erase PDFs saved elsewhere.

## Network boundaries

The core desktop editing workflow does not send PDF content to a server. The installer may contact Microsoft to obtain WebView2 if it is missing, and Microsoft platform runtimes have their own update/privacy behavior. GitHub downloads are external network activity. Build scripts download public dependencies and language models; those scripts are development tooling, not document-processing services.

PDF links are document content. Opening such a link in another application is subject to that application's behavior. Certificate trust checking uses Windows APIs and system certificate stores; Windows trust-provider behavior is governed by the operating system, not a Papier cloud service.

This description covers Papier's code and bundled workflow, not all activity performed by Windows, security software or other applications on the computer.
