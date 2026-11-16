Memory Palace — Refined V2, initial Windows desktop release.

Download **Memory Palace Setup 2.0.0.exe** to install, or **Memory Palace 2.0.0.exe** for portable use. Both contain the environments and assets for offline use. Windows 10/11 x64 and WebGL2-capable graphics are required. Executables are unsigned.

Included:
- Upload your own PDF, TXT, and Markdown material, or paste notes.
- Review and edit extracted passages with source-page references.
- Explore a house or carnival with 16 textured props and stable memory locations.
- Hide the learned placements and test recall by walking to the remembered location.
- Save palaces and results locally, export backups, and restore them.

Verified: TypeScript/build, five core tests, four browser integration tests, and a packaged Windows application smoke test.

This is an initial product iteration. Extraction groups source passages; it does not yet use AI to rank exam relevance. Scanned PDFs require OCR, and diagrams are not interpreted. The environment collection contains two scenes, not a large marketplace. See README.md and VERIFICATION.md for scope and checks.

The repository includes a CI workflow template at `docs/windows-ci.yml`. It is not activated because the publishing OAuth session lacks GitHub's workflow scope. Local tests and packaging were run directly.
