import { test, expect } from "@playwright/test";
const notes =
  "Photosynthesis is the conversion of sunlight into chemical energy stored in glucose.\n\nMitochondria are the organelles responsible for cellular respiration and ATP production.\n\nOsmosis is the movement of water through a selectively permeable membrane.";
test("real file import, editing, 3D learning, hidden test answers, results and persistence", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.locator("#new-palace").click();
  await page.locator("#palace-name").fill("Biology exam");
  await page
    .locator("#files")
    .setInputFiles({
      name: "biology.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(notes),
    });
  await page.locator("#extract").click();
  await expect(page.locator(".review-row")).toHaveCount(3);
  await page.locator('[data-title="0"]').fill("Photosynthesis");
  await page.locator("#choose-env").click();
  await page.locator("#build").click();
  await expect(page.locator("#world-loading")).toHaveCount(0, {
    timeout: 90000,
  });
  await page.locator('[data-stop="0"]').click();
  await expect(page.locator(".study-body")).toContainText(
    "conversion of sunlight",
  );
  await page.locator("#mark-seen").click();
  await expect(page.locator(".route-stop.visited")).toHaveCount(1);
  await page.locator("#test-mode").click();
  await expect(page.locator(".route-stop")).toHaveCount(0);
  await expect(page.locator(".study-body")).toHaveCount(0);
  await expect(page.locator(".question-card")).toBeVisible();
  await page.locator("#skip").click();
  await page.locator("#skip").click();
  await page.locator("#skip").click();
  await expect(page.locator(".score")).toContainText("0");
  await expect(page.locator(".result-row")).toHaveCount(3);
  await page.locator("#back-learning").click();
  await expect(page.locator(".study-body")).toBeVisible();
  await page.locator("#leave").click();
  await expect(page.locator(".palace-card")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".card-heading h3")).toHaveText("Biology exam");
  await expect(page.locator(".card-foot")).toContainText("1 of 3 explored");
  await page.screenshot({ path: "test-results/library.png", fullPage: true });
  expect(errors).toEqual([]);
});
test("rejects unsupported files and empty material", async ({ page }) => {
  await page.goto("/");
  await page.locator("#new-palace").click();
  await page.locator("#extract").click();
  await expect(page.locator("#toast")).toContainText("Add a file");
  await page
    .locator("#files")
    .setInputFiles({
      name: "data.exe",
      mimeType: "application/octet-stream",
      buffer: Buffer.from(notes),
    });
  await page.locator("#extract").click();
  await expect(page.locator("#toast")).toContainText("use PDF");
});
test("carnival loads all bundled assets and supports multiple wings", async ({
  page,
}) => {
  const missing: string[] = [];
  page.on("response", (r) => {
    if (r.status() >= 400) missing.push(r.url());
  });
  await page.goto("/");
  await page.locator("#new-palace").click();
  await page
    .locator("#pasted")
    .fill(
      Array.from(
        { length: 20 },
        (_, i) =>
          `Concept ${i} is an important topic with a detailed explanation for studying.`,
      ).join("\n\n"),
    );
  await page.locator("#extract").click();
  await page.locator("#choose-env").click();
  await page.locator('[data-env="carnival"]').click();
  await page.locator("#build").click();
  await expect(page.locator("#world-loading")).toHaveCount(0, {
    timeout: 90000,
  });
  await expect(page.locator(".route-stop")).toHaveCount(16);
  await page.locator("#wing").selectOption("1");
  await expect(page.locator(".route-stop")).toHaveCount(4);
  await expect(page.locator("#world-loading")).toHaveCount(0, {
    timeout: 90000,
  });
  await page.locator('[data-stop="0"]').click();
  await page.screenshot({ path: "test-results/carnival.png" });
  expect(missing).toEqual([]);
});
