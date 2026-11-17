import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { pdfFixture } from "../../tests/pdf-fixture.ts";
const { readStudyFile } = createRequire(import.meta.url)(
  "../bridge/server.cjs",
);
test("helper reads actual PDF bytes with source and page provenance", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "palace-ue5-pdf-test-"));
  try {
    const filename = path.join(dir, "lesson.pdf");
    await fs.writeFile(filename, pdfFixture());
    const pages = await readStudyFile(filename);
    assert.equal(pages[0].source, "lesson.pdf");
    assert.equal(pages[0].page, 1);
    assert.match(pages[0].text, /conversion of sunlight/);
    const text = path.join(dir, "lesson.txt");
    await fs.writeFile(text, "A study note.");
    assert.equal((await readStudyFile(text))[0].text, "A study note.");
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
test("helper rejects unsupported and relative file paths", async () => {
  await assert.rejects(readStudyFile("relative.pdf"), /absolute/);
  await assert.rejects(
    readStudyFile(path.join(os.tmpdir(), "program.exe")),
    /Only PDF/,
  );
});
