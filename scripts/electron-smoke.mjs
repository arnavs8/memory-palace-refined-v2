import { _electron as electron } from "playwright";
import { mkdtemp, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pdfFixture } from "../tests/pdf-fixture.ts";
const profile = await mkdtemp(path.join(os.tmpdir(), "palace-test-"));
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const desktop = await electron.launch({
  executablePath: path.resolve("release/win-unpacked/Memory Palace.exe"),
  args: [`--user-data-dir=${profile}`],
  env,
  timeout: 60000,
});
try {
  const page = await desktop.firstWindow();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.locator("#new-palace").waitFor({ timeout: 30000 });
  await page.locator("#new-palace").click();
  await page.locator("#palace-name").fill("Desktop verification");
  await page
    .locator("#pasted")
    .fill(
      "Memory consolidation is the process through which new memories become stable over time.\n\nSpatial memory is the ability to remember the locations of objects within an environment.",
    );
  await page.locator("#extract").click();
  await page.locator("#choose-env").click();
  await page.locator("#build").click();
  await page
    .locator("#world-loading")
    .waitFor({ state: "detached", timeout: 120000 });
  await page.locator('[data-stop="0"]').click();
  await page.locator(".study-body").waitFor();
  await page.locator("#mark-seen").click();
  await page.locator("#test-mode").click();
  await page.locator("#skip").click();
  await page.locator("#skip").click();
  await page.locator(".score").waitFor();
  await page.locator("#leave").click();
  await page.reload();
  await page.locator(".palace-card").waitFor();
  await page.locator("#new-palace").click();
  await page.locator("#files").setInputFiles({name:"desktop.pdf",mimeType:"application/pdf",buffer:pdfFixture()});
  await page.locator("#extract").click();
  await page.locator(".review-row").waitFor();
  if(!(await page.locator('[data-body="0"]').inputValue()).includes("conversion of sunlight"))throw Error("Packaged PDF extraction failed");
  await page.locator("#nav-library").click();
  await page.locator(".palace-card").waitFor();
  await mkdir("test-results", { recursive: true });
  await page.screenshot({ path: "test-results/desktop.png" });
  if (errors.length) throw Error(errors.join("\n"));
  const security = await desktop.evaluate(({ BrowserWindow }) => {
    const p =
      BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
    return {
      sandbox: p.sandbox,
      contextIsolation: p.contextIsolation,
      nodeIntegration: p.nodeIntegration,
    };
  });
  console.log(
    JSON.stringify({
      desktop: "PASS",
      persistentPalace: await page.locator(".card-heading h3").textContent(),
      security,
    }),
  );
} finally {
  await desktop.close();
}
