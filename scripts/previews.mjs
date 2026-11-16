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
    window.previewReady = false;
    window.previewScene = new PalaceScene(document.querySelector("#preview"), {
      environment: env,
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
    if (env === "house") {
      s.camera.position.set(8, 2.9, 14);
      s.yaw = 0.35;
      s.pitch = -0.06;
    } else {
      s.camera.position.set(10.5, 5, 14);
      s.yaw = 0.32;
      s.pitch = -0.08;
    }
  }, environment);
  await page.waitForTimeout(3000);
  await page.screenshot({
    path: `public/previews/${environment}.jpg`,
    type: "jpeg",
    quality: 90,
  });
  console.log(`Rendered ${environment} preview`);
}
await browser.close();
