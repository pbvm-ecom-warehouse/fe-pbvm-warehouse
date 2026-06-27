import { expect, test } from "@playwright/test";

test("loads WMS dashboard and inventory route", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: /Tổng quan/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Xuất kho/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Chuyển kho/i })).toHaveCount(0);

  await page.goto("/inventory");
  await expect(
    page.getByRole("heading", { name: /^Tồn kho$/i }),
  ).toBeVisible();
});

test("loads warehouse navigation route", async ({ page }) => {
  await page.goto("/warehouse-navigation");
  await expect(
    page.getByRole("heading", { name: /Điều hướng kệ/i }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Tính gợi ý/i })).toBeVisible();
});
