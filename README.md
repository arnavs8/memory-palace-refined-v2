# Memory Palace — Refined V2

A local-first Windows desktop app for turning study material into walkable 3D memory palaces.
![Memory Palace](public/previews/house.jpg)

## Install

Download **Memory Palace Setup 2.0.0.exe** from this repository's Releases to install, or use **Memory Palace 2.0.0.exe** for the portable edition. Windows 10/11 x64 with hardware-accelerated WebGL2 is required. The build is unsigned; Windows may display an unknown-publisher prompt. Internet access is not required after download.

## Study flow

1. Create a palace and upload your own PDFs, TXT, or Markdown files, or paste notes.
2. Review the extracted passages. Edit titles and explanations, remove unhelpful passages, and add your own cards. Each extracted card retains its filename and page number.
3. Choose **The Sunlit House** or **The Twilight Carnival**. Your cards are assigned stable locations, with up to 16 memories in each wing.
4. Explore with WASD/arrow keys; drag to look, or capture the mouse. Escape releases the mouse. Press E near an object to read its memory. The route sidebar also supports guided visits.
5. Switch to **Test recall**. Explanations, numbered markers, and guided navigation are hidden. A shuffled concept title prompts you to walk to its original location and place it with E. Skip if you cannot recall it.
6. Review your score and mistaken locations, return to Learn mode, and revise. Completed attempts and explored cards are saved automatically.

Export a `.palace.json` backup from a palace's menu. Restore creates a separate copy, preserving the original. Data lives in IndexedDB within the desktop app profile; uninstalling or clearing that profile can remove it.

## What ships

- Two navigable environments, 16 locally bundled textured glTF props, PBR surface maps, lighting, shadows, and a configurable rendering resolution.
- PDF/text import with no hardcoded study document or cloud dependency.
- Editable cards, source references, up to 160 cards across 10 wings.
- Spatial placement tests, score history, local persistence, export/restore, rename/delete.
- Electron desktop shell with sandboxing, context isolation, disabled Node integration, restricted navigation, and a local application protocol.
- Windows installer and portable packaging; core tests, browser integration tests, and packaged-app smoke test.

## Current boundaries

This is an initial desktop release, not a claim of a finished commercial platform. Extraction is deterministic passage grouping, **not semantic AI summarization or exam-relevance ranking**. Review the cards before studying. Image-only scans need OCR first; diagrams and complex tables are not interpreted. Limits: 20 files per import, 50 MB each, 500 pages per PDF, 160 retained cards per palace. Oversized card sets are shown for review rather than silently truncated.

The environment collection currently contains two custom-built scenes. Detailed CC0 props improve on the MVP, but this is not a photorealistic environment marketplace or an arbitrary 3D asset importer. Wings reuse the environment layout; recall tests operate on the current wing. There is no cloud sync, account system, paid asset store, code signing, auto-update, or Mac/Linux distribution yet.

## Develop

Use Node.js 24 LTS with npm and Git.

```sh
npm ci
npm run dev
npm run build
npm run desktop
```

All required models, textures, fonts, and PDF support files are committed under `public/`. `npm run assets` re-downloads the curated Poly Haven assets. `node scripts/prepare.mjs` refreshes PDF support files and fonts if dependencies change. These maintenance scripts require internet access; using the app does not.

```sh
npm test
npx playwright install chromium
npm run test:e2e
npm run package
node scripts/electron-smoke.mjs
```

`npm run package` builds the installer and portable executable in `release/`. Windows packaging should run on Windows. `scripts/electron-smoke.mjs` tests the unpacked executable using an isolated temporary user profile.

## Structure

| Path                         | Purpose                                            |
| ---------------------------- | -------------------------------------------------- |
| `src/core.ts`                | Cards, extraction, scoring, import validation      |
| `src/import.ts`              | Local PDF.js and text-file ingestion               |
| `src/storage.ts`             | IndexedDB persistence                              |
| `src/main.ts`                | Library, creation, review, learning and testing UI |
| `src/scene.ts`               | Environments, glTF props, navigation and rendering |
| `public/assets/catalog.json` | Asset provenance and licenses                      |
| `electron/main.cjs`          | Sandboxed desktop entry point                      |
| `tests/`                     | Core, PDF and full workflow checks                 |

## Assets and attribution

Powered by [Poly Haven](https://polyhaven.com). Their bundled models and textures are [CC0](https://polyhaven.com/license). See `public/assets/catalog.json` and `THIRD_PARTY_NOTICES.md`. Environment geometry is authored for this project. Source previews are rendered from the actual bundled scenes.
