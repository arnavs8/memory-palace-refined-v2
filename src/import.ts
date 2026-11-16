import * as pdfjs from "pdfjs-dist";
import worker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { SourcePage } from "./core";
pdfjs.GlobalWorkerOptions.workerSrc = worker;
export async function readFiles(
  files: File[],
  progress: (s: string) => void,
): Promise<SourcePage[]> {
  const pages: SourcePage[] = [];
  if (files.length > 20) throw Error("Upload up to 20 files at a time.");
  for (const file of files) {
    if (file.size > 50 * 1024 * 1024)
      throw Error(`${file.name} exceeds the 50 MB file limit.`);
    progress(`Reading ${file.name}…`);
    if (/\.pdf$/i.test(file.name)) {
      const task = pdfjs.getDocument({
        data: await file.arrayBuffer(),
        cMapUrl: `${import.meta.env.BASE_URL}pdf/cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `${import.meta.env.BASE_URL}pdf/standard_fonts/`,
        wasmUrl: `${import.meta.env.BASE_URL}pdf/wasm/`,
      });
      try {
        const doc = await task.promise;
        if (doc.numPages > 500)
          throw Error("Please split PDFs longer than 500 pages.");
        for (let i = 1; i <= doc.numPages; i++) {
          progress(`${file.name} · page ${i} of ${doc.numPages}`);
          const page = await doc.getPage(i);
          const content = await page.getTextContent();
          const text = content.items
            .map((item) =>
              "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "",
            )
            .join("");
          pages.push({ text, source: file.name, page: i });
        }
      } finally {
        await task.destroy();
      }
    } else if (/\.(txt|md)$/i.test(file.name)) {
      pages.push({ text: await file.text(), source: file.name, page: 1 });
    } else throw Error(`${file.name}: use PDF, TXT, or Markdown files.`);
  }
  if (pages.every((p) => p.text.trim().length < 25))
    throw Error("No readable text found. Scanned PDFs need OCR before upload.");
  return pages;
}
