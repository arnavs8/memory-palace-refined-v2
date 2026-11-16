# Verification record

Verified locally on Windows x64, 16 November 2026.

- TypeScript compilation and Vite production build passed.
- Five core tests passed: source-preserving extraction, deduplication, long-document retention, spatial scoring, shuffle integrity, and backup validation (several assertions share a test).
- Four Playwright integration tests passed: real TXT upload/edit/build/learn/test/persist workflow; invalid and empty inputs; carnival assets and multi-wing navigation; real PDF extraction with filename/page provenance.
- Packaged Electron smoke test passed: create, learn, test, reload, and verify persistence in an isolated profile.
- Packaged security preferences verified: sandbox enabled, context isolation enabled, Node integration disabled.
- Both environment previews and the library screen were rendered and visually inspected.

The full browser run took approximately three minutes with headless rendering on this machine. This is functional verification, not a GPU performance benchmark or testing across a broad device matrix.

Runtime PDF.js and Electron dependencies were updated after security audit findings. The dependency audit still reports moderate issues in the electron-builder packaging toolchain (minimatch); no known high-severity findings remain in the final installed dependency set at verification time. Re-run npm audit before subsequent releases.

Known product boundaries are documented in README.md. Automated checks do not validate the academic accuracy or completeness of uploaded material; users review extracted cards before entering a palace.
