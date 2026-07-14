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
  await expect(page.getByRole("link", { name: /Xuất kho/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Chuyển kho/i })).toHaveCount(0);

  await page.goto("/inventory");
  await expect(
    page.getByRole("heading", { name: /^Tồn kho$/i }),
  ).toBeVisible();
  await expect(
    page.getByText(/Tính năng tồn kho tổng hợp chưa sẵn sàng/i),
  ).toBeVisible();
});

test("admin edits a product from the item drawer", async ({ page }) => {
  await seedWmsSession(page, ["ADMIN"], "Admin User");
  const item = {
    altBarcodes: ["8938501234567"],
    altUnits: [{ quantity: 24, unit: "thùng" }],
    attributes: [{ color: "đỏ", size: "500ml" }],
    barcode: "8938501234567",
    createdAt: "2026-07-01T00:00:00.000Z",
    height: 12,
    id: "item-1",
    isActive: true,
    isPerishable: false,
    name: "Ly nhựa 500ml",
    sku: "CUP-500ML-RED",
    type: "CUP_BLANK",
    unit: "cái",
    updatedAt: "2026-07-01T00:00:00.000Z",
    width: 8,
  };
  let patchBody: unknown;
  let deleteCalled = false;

  await page.route("**/api/wms/stock/items**", async (route) => {
    const method = route.request().method();

    if (method === "PATCH") {
      patchBody = route.request().postDataJSON();
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: { ...item, name: "Ly nhựa 500ml đỏ" },
          meta: { requestId: "product-update" },
        }),
      });
      return;
    }

    if (method === "DELETE") {
      deleteCalled = true;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ data: {}, meta: { requestId: "product-delete" } }),
      });
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: [item],
        meta: { requestId: "product-list" },
      }),
    });
  });

  await page.goto("/products");
  await expect(page.getByRole("heading", { name: /^Sản phẩm$/i })).toBeVisible();
  await page.getByRole("row", { name: /CUP-500ML-RED/i }).click();
  await expect(page.getByRole("dialog", { name: /CUP-500ML-RED/i })).toBeVisible();
  await expect(page.getByLabel("Đơn vị phụ")).toHaveValue(
    "quantity: 24, unit: thùng",
  );
  await page.getByLabel("Tên mặt hàng").fill("Ly nhựa 500ml đỏ");
  await page.getByRole("button", { name: /^Lưu mặt hàng$/i }).click();
  await expect(page.getByText(/Đã cập nhật mặt hàng/i)).toBeVisible();
  expect(patchBody).toMatchObject({ name: "Ly nhựa 500ml đỏ" });

  await page.getByRole("button", { name: /^Ngưng dùng$/i }).click();
  await page
    .getByRole("dialog", { name: /Ngưng dùng mặt hàng/i })
    .getByRole("button", { name: /^Ngưng dùng$/i })
    .click();
  await expect(page.getByText(/Đã ngưng dùng mặt hàng/i)).toBeVisible();
  expect(deleteCalled).toBe(true);
});

test("receiver gets inbound navigation and forbidden settings", async ({ page }) => {
  await seedWmsSession(page, ["RECEIVER"], "Receiver User");

  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: /Khu vực nhận hàng/i }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Nhập hàng/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Cài đặt/i })).toHaveCount(0);

  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { name: /Không có quyền truy cập/i }),
  ).toBeVisible();
});

test("manager opens purchases when purchase order items are missing", async ({ page }) => {
  await seedWmsSession(page, ["MANAGER"], "Manager User");
  const purchaseOrderWithoutItems = {
    createdAt: "2026-07-13T00:00:00.000Z",
    expectedDate: "2026-07-18T00:00:00.000Z",
    id: "po-no-items",
    note: "Đơn mua backend trả thiếu dòng hàng",
    orderDate: "2026-07-13T00:00:00.000Z",
    poNumber: "PO-20260713-0002",
    status: "CONFIRMED",
    supplierId: "supplier-1",
    updatedAt: "2026-07-13T00:00:00.000Z",
    warehouseId: "wh-1",
  };

  await page.route("**/api/wms/suppliers**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          {
            code: "NCC-001",
            contactName: "Nguyễn Văn B",
            id: "supplier-1",
            name: "Công ty TNHH ABCD",
            status: "ACTIVE",
          },
        ],
        limit: 100,
        page: 1,
        total: 1,
      }),
    });
  });
  await page.route("**/api/wms/warehouse", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          {
            address: "Kho A",
            id: "wh-1",
            isActive: true,
            name: "Kho A",
          },
        ],
        meta: { requestId: "warehouse-list" },
      }),
    });
  });
  await page.route("**/api/wms/purchase-orders**", async (route) => {
    const url = route.request().url();

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: url.includes("/purchase-orders/po-no-items")
          ? purchaseOrderWithoutItems
          : [purchaseOrderWithoutItems],
        limit: 20,
        page: 1,
        total: 1,
      }),
    });
  });
  await page.route("**/api/wms/goods-receipt-notes**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ data: [], limit: 50, page: 1, total: 0 }),
    });
  });

  await page.goto("/purchases");

  await expect(page.getByRole("heading", { name: /^Nhập hàng$/i })).toBeVisible();
  await expect(page.getByRole("cell", { name: "PO-20260713-0002" })).toBeVisible();
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
  await expect(page.getByText("Quản lý tài khoản WMS")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Tạo nhân viên/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Đặt lại mật khẩu/i }),
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
  await expect(page.getByText("Quản lý tài khoản WMS")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Tạo nhân viên/i }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Đặt lại mật khẩu/i }),
  ).toHaveCount(0);
});

test("printer can use print jobs but not purchases", async ({ page }) => {
  await seedWmsSession(page, ["PRINTER"], "Printer User");
  let lineStatus: "PENDING" | "CONSUMED" | "COMPLETED" = "PENDING";
  const printJob = () => ({
    createdAt: "2026-07-04T00:00:00.000Z",
    id: "pj-1",
    items: [
      {
        inputItemId: "blank-1",
        lineStatus,
        outputItemId: "printed-1",
        quantity: 10,
        remainingQty: lineStatus === "COMPLETED" ? 0 : 10,
        reservedQty: 10,
        sku: "CUP-BLANK-500",
      },
    ],
    orderId: "order-1",
    status:
      lineStatus === "PENDING"
        ? "PENDING"
        : lineStatus === "CONSUMED"
          ? "IN_PROGRESS"
          : "COMPLETED",
    updatedAt: "2026-07-04T00:00:00.000Z",
    warehouseId: "central",
  });
  const postBodies: unknown[] = [];

  await page.route("**/api/wms/print-jobs**", async (route) => {
    const method = route.request().method();
    const url = route.request().url();

    if (method === "POST") {
      postBodies.push(route.request().postDataJSON());
      lineStatus = url.includes("/complete") ? "COMPLETED" : "CONSUMED";
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: printJob(),
          meta: { requestId: "print-job-mutate" },
        }),
      });
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: url.includes("/print-jobs/pj-1") ? printJob() : [printJob()],
        meta: { requestId: "print-job-list" },
      }),
    });
  });

  await page.goto("/print-jobs");
  await expect(page.getByRole("heading", { name: /^In ly$/i })).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: new RegExp(["Theo dõi", "lệnh in"].join(" "), "i"),
    }),
  ).toHaveCount(0);
  await page.getByRole("row", { name: /CUP-BLANK-500/i }).click();
  await page.getByLabel("Mã vị trí").fill("A1-S02");
  await page.getByRole("button", { name: /^Tiêu thụ ly chưa in$/i }).click();
  await expect(page.getByText(/Đã ghi nhận tiêu thụ ly chưa in/i)).toBeVisible();
  expect(postBodies[0]).toMatchObject({
    itemBarcode: "CUP-BLANK-500",
    quantity: 10,
    shelfCode: "A1-S02",
  });

  await page.getByLabel("Mã vị trí").fill("A1-S03");
  await page.getByRole("button", { name: /^Xác nhận in xong$/i }).click();
  await expect(page.getByText(/Đã xác nhận in xong/i)).toBeVisible();
  expect(postBodies[1]).toMatchObject({
    quantity: 10,
    shelfCode: "A1-S03",
  });

  await page.goto("/purchases");
  await expect(
    page.getByRole("heading", { name: /Không có quyền truy cập/i }),
  ).toBeVisible();
});

test("manager can view print jobs without processing controls", async ({ page }) => {
  await seedWmsSession(page, ["MANAGER"], "Manager User");
  const printJob = {
    createdAt: "2026-07-04T00:00:00.000Z",
    id: "pj-1",
    items: [
      {
        inputItemId: "blank-1",
        lineStatus: "PENDING",
        outputItemId: "printed-1",
        quantity: 10,
        remainingQty: 10,
        reservedQty: 10,
        sku: "CUP-BLANK-500",
      },
    ],
    orderId: "order-1",
    status: "PENDING",
    updatedAt: "2026-07-04T00:00:00.000Z",
    warehouseId: "central",
  };

  await page.route("**/api/wms/print-jobs**", async (route) => {
    const url = route.request().url();

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: url.includes("/print-jobs/pj-1") ? printJob : [printJob],
        meta: { requestId: "print-job-manager" },
      }),
    });
  });

  await page.goto("/print-jobs");
  await expect(page.getByRole("heading", { name: /^In ly$/i })).toBeVisible();
  await expect(
    page.getByRole("cell", { name: /^CUP-BLANK-500$/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Tiêu thụ ly chưa in$/i }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /^Xác nhận in xong$/i }),
  ).toHaveCount(0);
});

test("picker mobile drawer exposes picker routes", async ({ page }) => {
  await seedWmsSession(page, ["PICKER"], "Picker User");
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: /Khu vực soạn hàng/i }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Mở menu/i }).click();
  await expect(page.getByRole("link", { name: /Xuất kho/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Chuyển kho/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Nhập hàng/i })).toHaveCount(0);
});

test("admin manages warehouse layout and can switch to structure data", async ({ page }) => {
  await seedWmsSession(page, ["ADMIN"], "Admin User");
  let layoutCalled = false;

  await page.route("**/api/wms/warehouse/*/layout**", async (route) => {
    layoutCalled = true;
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "NOT_FOUND", message: "missing" } }),
    });
  });
  await page.route("**/api/wms/warehouse", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          {
            address: "Kho trung tâm",
            createdAt: "2026-07-01T00:00:00.000Z",
            id: "wh-1",
            isActive: true,
            name: "Kho trung tâm",
            updatedAt: "2026-07-01T00:00:00.000Z",
          },
        ],
        meta: { requestId: "warehouse-list" },
      }),
    });
  });
  await page.route("**/api/wms/warehouse/zones**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ data: [], meta: { requestId: "zones-list" } }),
    });
  });
  await page.route("**/api/wms/warehouse/racks**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ data: [], meta: { requestId: "racks-list" } }),
    });
  });
  await page.route("**/api/wms/warehouse/shelves**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ data: [], meta: { requestId: "shelves-list" } }),
    });
  });

  await page.goto("/warehouses");
  await expect(
    page.getByRole("heading", { name: /Bố trí mặt bằng kho/i }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Khu vực/i })).toBeVisible();
  expect(layoutCalled).toBe(true);

  await page.getByRole("tab", { name: /Dữ liệu kệ/i }).click();
  await expect(page.getByText("Danh sách kho", { exact: true })).toBeVisible();
});

test("receiver confirms put-away task through warehouse navigation", async ({
  page,
}) => {
  await seedWmsSession(page, ["RECEIVER"], "Receiver User");
  const putawayTask = {
    grnId: "grn-1",
    id: "task-1",
    items: [
      {
        itemId: "item-1",
        lotId: "lot-1",
        lotNumber: "LOT-A",
        quantity: 80,
        remainingQty: 80,
        sku: "CUP-BLANK-500",
        unit: "cái",
      },
    ],
    status: "PENDING",
    warehouseId: "central",
  };

  await page.route("**/api/wms/putaway-tasks**", async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    if (method === "POST") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: { ...putawayTask, status: "COMPLETED" },
          meta: { requestId: "putaway-confirm" },
        }),
      });
      return;
    }
    if (url.includes("/putaway-tasks/task-1")) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: putawayTask,
          meta: { requestId: "putaway-detail" },
        }),
      });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: [putawayTask],
        meta: { requestId: "putaway-list" },
      }),
    });
  });

  await page.route("**/api/wms/putaway/suggestions**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          suggestions: [{ capacity: 132, shelfCode: "A1-S02" }],
          warning: null,
        },
        meta: { requestId: "e2e-putaway" },
      }),
    });
  });

  await page.goto("/warehouse-navigation");
  await expect(
    page.getByRole("heading", { name: "Điều hướng kệ" }).last(),
  ).toBeVisible();
  await page.getByRole("row", { name: /CUP-BLANK-500/i }).click();
  await page.getByRole("button", { name: /Tìm vị trí/i }).click();
  await expect(page.getByText("A1-S02").first()).toBeVisible();
  await page.getByRole("button", { name: /A1-S02/i }).click();
  await expect(page.getByLabel("Mã vị trí")).toHaveValue("A1-S02");
  await page.getByRole("button", { name: /^Xác nhận$/i }).click();
  await expect(page.getByText(/Đã xác nhận dòng cất hàng/i)).toBeVisible();
});

