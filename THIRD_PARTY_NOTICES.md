# Third-party notices

- **Poly Haven**: 16 glTF models and PBR textures, CC0 1.0. Each source is recorded in `public/assets/catalog.json`. https://polyhaven.com/license . The download script uses the Poly Haven API; the app displays the requested "Powered by Poly Haven" credit.
- **DM Sans**, **Lora**: SIL Open Font License 1.1. Font license texts are in `public/fonts/`.
- **PDF.js / pdfjs-dist**: Apache 2.0. Bundled worker, CMaps, standard fonts, and WASM files originate in the pinned npm package. See `public/pdf/LICENSE` and notices distributed with the support files.
- **Three.js**: MIT. **Lucide**: ISC. **idb**: ISC. License texts are retained in `licenses/`.
- **Electron / Chromium**: Electron MIT and Chromium third-party licenses are included in the packaged distribution by electron-builder.

The `original-mvp/` development reference checkout is ignored by Git and is not shipped. This replacement uses a new Vite/Electron implementation rather than copying the old application source.
