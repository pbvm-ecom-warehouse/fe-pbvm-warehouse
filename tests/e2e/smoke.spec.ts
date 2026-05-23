import { expect, test } from "@playwright/test";

test("loads WMS dashboard and inventory route", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: /Tổng quan/i })).toBeVisible();

  await page.goto("/inventory");
  await expect(
    page.getByRole("heading", { name: /Tồn kho realtime/i }),
  ).toBeVisible();
});
