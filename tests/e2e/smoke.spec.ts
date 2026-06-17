import { expect, test, type Page } from "@playwright/test";

type SeedRole =
  | "ADMIN"
  | "MANAGER"
  | "RECEIVER"
  | "PICKER"
  | "PRINTER"
  | "COUNTER";

async function seedWmsSession(page: Page, roles: SeedRole[], name = "Role User") {
  await page.addInitScript(
    ({ name, roles }) => {
      window.localStorage.setItem(
        "wms-auth",
        JSON.stringify({
          state: {
            user: {
              id: `e2e-${roles.join("-").toLowerCase()}`,
              name,
              roles,
              tenantId: "demo-tenant",
              type: "user",
              warehouseId: "MW-001",
            },
          },
          version: 2,
        }),
      );
    },
    { name, roles },
  );
}

test("manager sees management dashboard and inventory route", async ({ page }) => {
  await seedWmsSession(page, ["MANAGER"], "Manager User");

  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: /Bảng điều phối quản lý/i }),
  ).toBeVisible();

  await page.goto("/inventory");
  await expect(
    page.getByRole("heading", { name: /^Tồn kho$/i }),
  ).toBeVisible();
  await expect(page.getByText(/Manager ·/i)).toBeVisible();
});

test("receiver gets inbound navigation and forbidden settings", async ({ page }) => {
  await seedWmsSession(page, ["RECEIVER"], "Receiver User");

  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: /Receiver workspace/i }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Nhập hàng/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Cài đặt/i })).toHaveCount(0);

  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { name: /Không có quyền truy cập/i }),
  ).toBeVisible();
});

test("printer can use print jobs but not purchases", async ({ page }) => {
  await seedWmsSession(page, ["PRINTER"], "Printer User");

  await page.goto("/print-jobs");
  await expect(
    page.getByRole("heading", { name: /^Lệnh in ly$/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Xác nhận in xong/i }),
  ).toBeVisible();

  await page.goto("/purchases");
  await expect(
    page.getByRole("heading", { name: /Không có quyền truy cập/i }),
  ).toBeVisible();
});

test("picker mobile drawer exposes picker routes", async ({ page }) => {
  await seedWmsSession(page, ["PICKER"], "Picker User");
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: /Picker workspace/i }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Mở menu/i }).click();
  await expect(page.getByRole("link", { name: /Chuyển kho/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Nhập hàng/i })).toHaveCount(0);
});
