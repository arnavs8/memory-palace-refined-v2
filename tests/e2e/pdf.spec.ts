import { test, expect } from "@playwright/test";
import { pdfFixture } from "../pdf-fixture";
test("extracts a user PDF with source and page reference", async ({ page }) => {
  await page.goto("/");
  await page.locator("#new-palace").click();
  await page
    .locator("#files")
    .setInputFiles({
      name: "biology.pdf",
      mimeType: "application/pdf",
      buffer: pdfFixture(),
    });
  await page.locator("#extract").click();
  await expect(page.locator(".review-row")).toHaveCount(1);
  await expect(page.locator('[data-body="0"]')).toHaveValue(
    /conversion of sunlight/,
  );
  await expect(page.locator(".review-row small")).toContainText(
    "biology.pdf · page 1",
  );
});
