import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1200, height: 850 } });
await page.goto("http://127.0.0.1:5173");
await mkdir("public/previews", { recursive: true });
for (const environment of ["house", "carnival"]) {
  await page.evaluate(async (env) => {
    window.previewScene?.dispose();
    document.body.innerHTML =
      '<div id="preview" style="position:fixed;inset:0"></div>';
    const { PalaceScene } = await import("/src/scene.ts");
    const { createLayout } = await import("/src/layout.ts");
    const cards = Array.from({ length: 16 }, (_, i) => ({
      id: String(i),
      title: "Concept " + i,
      body: "",
      source: "",
      page: 1,
      anchor: i,
      category: ["study", "energy", "time", "comparison"][i % 4],
    }));
    window.previewReady = false;
    window.previewScene = new PalaceScene(document.querySelector("#preview"), {
      environment: env,
      layout: createLayout("preview-refined-21", cards, env),
      count: 0,
      quality: "high",
      onSelect() {},
      onNear() {},
      onReady() {
        window.previewReady = true;
      },
      onError: console.error,
    });
  }, environment);
  await page.waitForFunction(() => window.previewReady, null, {
    timeout: 90000,
  });
  await page.evaluate((env) => {
    const s = window.previewScene;
    s.setInteractive(false);
    if (env === "house") {
      s.camera.position.set(-3.4, 2.2, -3.1);
      s.yaw = 0.6;
      s.pitch = -0.03;
    } else {
      s.camera.position.set(0, 2.2, 14);
      s.yaw = 0.22;
      s.pitch = 0.02;
    }
  }, environment);
  await page.waitForTimeout(3000);
  await page.screenshot({
    path: `public/previews/${environment}.jpg`,
    type: "jpeg",
    quality: 90,
    timeout:120000,
  });
  console.log(`Rendered ${environment} preview`);
}
await browser.close();
