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

function warehouseLayoutFixture(status: "DRAFT" | "PUBLISHED" = "PUBLISHED") {
  return {
    warehouseId: "central",
    revision: 1,
    status,
    canvas: { widthM: 40, heightM: 24, gridM: 0.5 },
    zones: [
      {
        id: "zone-a",
        code: "A",
        name: "Zone A",
        xM: 1,
        yM: 1,
        widthM: 16,
        heightM: 22,
        rotation: 0,
      },
      {
        id: "zone-b",
        code: "B",
        name: "Zone B",
        xM: 23,
        yM: 1,
        widthM: 16,
        heightM: 22,
        rotation: 0,
      },
    ],
    racks: [
      {
        id: "rack-a1",
        zoneId: "zone-a",
        code: "A1",
        name: "Rack A1",
        xM: 3,
        yM: 3,
        widthM: 10,
        depthM: 1.5,
        rotation: 0,
        levelCount: 3,
        bayCount: 3,
        shelfCodes: ["A1-S01", "A1-S02", "A1-S03"],
        accessPoint: { xM: 8, yM: 6 },
      },
      {
        id: "rack-b1",
        zoneId: "zone-b",
        code: "B1",
        name: "Rack B1",
        xM: 25,
        yM: 3,
        widthM: 10,
        depthM: 1.5,
        rotation: 0,
        levelCount: 2,
        bayCount: 3,
        shelfCodes: ["B1-S01", "B1-S02"],
        accessPoint: { xM: 30, yM: 6 },
      },
      {
        id: "rack-b2",
        zoneId: "zone-b",
        code: "B2",
        name: "Rack B2",
        xM: 25,
        yM: 11,
        widthM: 10,
        depthM: 1.5,
        rotation: 0,
        levelCount: 1,
        bayCount: 3,
        shelfCodes: ["B2-S01"],
        accessPoint: { xM: 30, yM: 10 },
      },
    ],
    aisles: [
      {
        id: "main-01",
        code: "MAIN-01",
        type: "MAIN",
        xM: 18,
        yM: 0,
        widthM: 4,
        heightM: 24,
      },
      {
        id: "aisle-a1",
        code: "AISLE-A1",
        type: "RACK",
        xM: 1,
        yM: 6,
        widthM: 16,
        heightM: 2,
      },
      {
        id: "aisle-b1",
        code: "AISLE-B1",
        type: "RACK",
        xM: 23,
        yM: 6,
        widthM: 16,
        heightM: 2,
      },
    ],
    gates: [
      {
        id: "gate-01",
        code: "GATE-01",
        label: "Cổng vào",
        xM: 20,
        yM: 24,
      },
    ],
  };
}

test("manager sees management dashboard and inventory route", async ({ page }) => {
  await seedWmsSession(page, ["MANAGER"], "Manager User");

  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: /Bảng điều phối quản lý/i }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Xuất kho/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Chuyển kho/i })).toHaveCount(0);

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

test("admin sees settings health and WMS user action forms", async ({ page }) => {
  await seedWmsSession(page, ["ADMIN"], "Admin User");
  await page.route("**/api/wms/health", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: { status: "ok", db: "up", redis: "up" },
        meta: { requestId: "e2e-health" },
      }),
    });
  });
  await page.route(/\/api\/wms\/?$/, async (route) => {
    await route.fulfill({
      contentType: "text/plain",
      body: "Hello World!",
    });
  });

  await page.goto("/settings");

  await expect(page.getByText("Trạng thái hệ thống", { exact: true })).toBeVisible();
  await expect(page.getByText("Kết nối WMS", { exact: true })).toBeVisible();
  await expect(page.getByText("Quản trị user WMS")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Tạo nhân viên/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Reset mật khẩu/i }),
  ).toBeVisible();
});

test("manager sees settings API status without admin mutation controls", async ({
  page,
}) => {
  await seedWmsSession(page, ["MANAGER"], "Manager User");
  await page.route("**/api/wms/health", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: { status: "ok", db: "up", redis: "up" },
        meta: { requestId: "e2e-health" },
      }),
    });
  });
  await page.route(/\/api\/wms\/?$/, async (route) => {
    await route.fulfill({
      contentType: "text/plain",
      body: "Hello World!",
    });
  });

  await page.goto("/settings");

  await expect(page.getByText("Trạng thái hệ thống", { exact: true })).toBeVisible();
  await expect(page.getByText("Kết nối WMS", { exact: true })).toBeVisible();
  await expect(page.getByText("Quản trị user WMS")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Tạo nhân viên/i }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Reset mật khẩu/i }),
  ).toHaveCount(0);
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
  await expect(page.getByRole("link", { name: /Xuất kho/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Chuyển kho/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Nhập hàng/i })).toHaveCount(0);
});

test("admin saves and publishes a warehouse floor plan", async ({ page }) => {
  await seedWmsSession(page, ["ADMIN"], "Admin User");
  let draft = warehouseLayoutFixture("DRAFT");

  await page.route("**/api/wms/warehouses/central/layout**", async (route) => {
    const method = route.request().method();

    if (method === "PUT") {
      const payload = route.request().postDataJSON();
      draft = {
        ...draft,
        ...payload,
        revision: 2,
        status: "DRAFT",
      };
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ data: draft, meta: { requestId: "layout-save" } }),
      });
      return;
    }

    if (method === "POST") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: { ...draft, status: "PUBLISHED" },
          meta: { requestId: "layout-publish" },
        }),
      });
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: draft,
        meta: { requestId: "layout-draft" },
      }),
    });
  });

  await page.goto("/warehouses");
  await expect(
    page.getByRole("heading", { name: /Bố trí mặt bằng kho/i }),
  ).toBeVisible();

  await page.getByRole("button", { name: /Mở Rack A1/i }).click();
  await page.getByLabel("Số khoang").fill("4");
  await page.getByTestId("sync-rack-configuration").click();
  await expect(page.getByTestId("apply-rack-configuration")).toBeDisabled();
  await page.getByTestId("rack-scope-warehouse").click();
  await expect(page.getByTestId("apply-rack-configuration")).toContainText("2");
  await page.getByTestId("apply-rack-configuration").click();

  await page.getByRole("button", { name: /Mở Rack B1/i }).click();
  await expect(page.getByLabel("Số khoang")).toHaveValue("4");
  await page.getByRole("button", { name: /Hoàn tác/i }).click();
  await expect(page.getByLabel("Số khoang")).toHaveValue("3");

  await page.getByRole("button", { name: /Mở Rack A1/i }).click();
  await page.getByTestId("sync-rack-configuration").click();
  await page.getByTestId("rack-scope-warehouse").click();
  await page.getByTestId("apply-rack-configuration").click();
  await page.getByLabel("Tên").fill("Rack A1 cập nhật");
  await page.getByRole("button", { name: /Lưu draft/i }).click();
  await expect(page.getByText("Revision 2", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /^Publish$/i }).click();
  await expect(page.getByText(/Đã publish layout revision 2/i)).toBeVisible();
});

test("receiver sees put-away route and shelf contents on warehouse navigation", async ({
  page,
}) => {
  await seedWmsSession(page, ["RECEIVER"], "Receiver User");

  await page.route("**/api/wms/warehouses/central/layout**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: warehouseLayoutFixture(),
        meta: { requestId: "e2e-layout" },
      }),
    });
  });

  await page.route("**/api/wms/putaway/suggestions**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          {
            shelf: {
              id: "central-a1-s02",
              warehouseId: "central",
              warehouseCode: "CENTRAL",
              zoneCode: "A",
              zoneName: "Zone A",
              rackCode: "A1",
              rackName: "Rack A1",
              level: 2,
              code: "A1-S02",
              barcode: "A1-S02",
              x: 72,
              y: 160,
              width: 132,
              height: 46,
              innerDepth: 52,
              innerWidth: 118,
              innerHeight: 38,
              fillFactor: 0.76,
            },
            capacity: 132,
            reason: "same SKU cluster + gần staging + đủ chỗ",
            advisory: true,
            pathLabel: "CENTRAL / Zone A / Rack A1 / A1-S02",
            route: {
              from: { code: "GATE-01", label: "Cổng vào", x: 34, y: 318 },
              to: { code: "A1-S02", label: "A1-S02", x: 138, y: 183 },
              waypoints: [
                { code: "GATE-01", label: "Cổng vào", x: 34, y: 318 },
                { code: "AISLE-A1", label: "Lối Rack A1", x: 138, y: 250 },
                { code: "A1-S02", label: "A1-S02", x: 138, y: 183 },
              ],
              distanceMeters: 28,
              estimatedSeconds: 70,
              instructions: ["Bắt đầu tại cổng", "Đi tới Rack A1", "Dừng ở A1-S02"],
            },
          },
        ],
        meta: { requestId: "e2e-putaway" },
      }),
    });
  });

  await page.route("**/api/wms/warehouse/shelves/*/contents**", async (route) => {
    const url = route.request().url();
    const isTargetShelf = url.includes("/A1-S02/");

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: isTargetShelf
          ? [
              {
                id: "stock-1",
                sku: "CUP-BLANK-500",
                itemName: "Ly trắng 500ml",
                quantity: 24,
                unit: "cái",
                containerType: "box",
                placement: {
                  x: 8,
                  y: 14,
                  width: 34,
                  height: 32,
                  depth: 12,
                  label: "LOT-A",
                },
                status: "AVAILABLE",
              },
            ]
          : [],
        meta: { requestId: "e2e-contents" },
      }),
    });
  });

  await page.goto("/warehouse-navigation");
  await page.getByRole("button", { name: /Tính gợi ý/i }).click();

  await expect(page.getByText("GATE-01").first()).toBeVisible();
  await expect(page.getByText("A1-S02").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Mở Rack A1/i })).toBeVisible();

  await page.getByRole("button", { name: /Mở Rack A1/i }).click();

  await expect(page.getByRole("heading", { name: /Rack A1/i })).toBeVisible();
  await expect(page.getByText("LOT-A")).toBeVisible();
  await expect(page.getByText("CUP-BLANK-500").first()).toBeVisible();
  await expect(page.getByText("24 cái")).toBeVisible();
});
