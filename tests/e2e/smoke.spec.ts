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

test("admin edits a product from row actions", async ({ page }) => {
  await seedWmsSession(page, ["ADMIN"], "Admin User");
  const item = {
    altBarcodes: ["8938501234567"],
    altUnits: [{ factor: 24, unit: "thùng" }],
    attributes: [{ code: "COL", name: "Màu", value: "Đỏ" }],
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
  await page
    .getByRole("row", { name: /CUP-500ML-RED/i })
    .getByRole("button", { name: /^Sửa$/i })
    .click();
  await expect(page.getByRole("dialog", { name: /CUP-500ML-RED/i })).toBeVisible();
  await expect(page.getByText(/unit:/i)).toHaveCount(0);
  await expect(page.getByText(/factor:/i)).toHaveCount(0);
  await expect(page.getByLabel("Hệ số")).toHaveValue("24");
  await expect(page.getByLabel("Tên", { exact: true })).toHaveValue("Màu");
  await expect(page.getByLabel("Giá trị")).toHaveValue("Đỏ");
  await page.getByLabel("Tên mặt hàng").fill("Ly nhựa 500ml đỏ");
  await page.getByRole("button", { name: /^Lưu mặt hàng$/i }).click();
  await expect(page.getByText(/Đã cập nhật mặt hàng/i)).toBeVisible();
  expect(patchBody).toMatchObject({ name: "Ly nhựa 500ml đỏ" });
  expect(patchBody).not.toMatchObject({ sku: "CUP-500ML-RED" });

  await page
    .getByRole("row", { name: /CUP-500ML-RED/i })
    .getByRole("button", { name: /^Ngưng dùng$/i })
    .click();
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
  await expect(page.getByRole("link", { name: /Cất hàng/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Nhập hàng/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Cài đặt/i })).toHaveCount(0);

  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { name: /Không có quyền truy cập/i }),
  ).toBeVisible();
});

test("manager opens purchases when purchase order items are missing", async ({ page }) => {
  await seedWmsSession(page, ["MANAGER"], "Manager User");
  let purchaseOrderPostBody: unknown;
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

  await page.route("**/api/wms/supplier?**", async (route) => {
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
  await page.route("**/api/wms/stock/items**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          {
            altBarcodes: [],
            altUnits: [],
            attributes: [],
            barcode: "8938501234567",
            createdAt: "2026-07-01T00:00:00.000Z",
            id: "item-1",
            isActive: true,
            isPerishable: false,
            name: "Ly nhựa 500ml",
            sku: "CUP-500ML-RED",
            type: "CUP_BLANK",
            unit: "cái",
            updatedAt: "2026-07-01T00:00:00.000Z",
          },
        ],
        limit: 200,
        page: 1,
        total: 1,
      }),
    });
  });
  await page.route("**/api/wms/purchase-orders**", async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (method === "POST") {
      purchaseOrderPostBody = route.request().postDataJSON();
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            ...purchaseOrderWithoutItems,
            id: "po-created",
            items: [
              {
                expectedQty: 12,
                itemId: "item-1",
                sku: "CUP-500ML-RED",
                unit: "cái",
                unitPrice: 1500,
              },
            ],
            poNumber: "PO-NEW",
          },
          meta: { requestId: "po-create" },
        }),
      });
      return;
    }

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
  await page.getByRole("button", { name: /^Tạo đơn mua$/i }).click();
  const dialog = page.getByRole("dialog", { name: /^Tạo đơn mua$/i });
  await dialog.getByRole("combobox").nth(0).click();
  await page.getByText(/NCC-001/i).last().click();
  await dialog.getByRole("combobox").nth(1).click();
  await page.getByText(/^Kho A$/i).last().click();
  await dialog
    .getByRole("combobox", { name: /Mặt hàng dòng 1/i })
    .click();
  await page.getByText(/CUP-500ML-RED/i).click();
  await dialog.getByLabel(/Số lượng dòng 1/i).fill("12");
  await dialog.getByLabel(/Đơn giá dòng 1/i).fill("1500");
  await dialog.getByRole("button", { name: /^Tạo đơn mua$/i }).click();
  await expect(page.getByText(/Đã tạo đơn mua/i)).toBeVisible();
  expect(purchaseOrderPostBody).toMatchObject({
    items: [
      {
        expectedQty: 12,
        itemId: "item-1",
        sku: "CUP-500ML-RED",
        unit: "cái",
        unitPrice: 1500,
      },
    ],
  });
});

test("admin edits and removes supplier items from row actions", async ({ page }) => {
  await seedWmsSession(page, ["ADMIN"], "Admin User");
  const supplier = {
    address: "123 Lê Văn Lương, Q7",
    code: "NCC-002",
    contactName: "Nguyễn Văn B",
    createdAt: "2026-07-01T00:00:00.000Z",
    email: "contact@example.com",
    id: "sup-1",
    name: "Công ty TNHH ABCD",
    phone: "090123456",
    status: "ACTIVE",
    taxCode: "030012345",
    updatedAt: "2026-07-01T00:00:00.000Z",
  };
  let supplierItem = {
    id: "si-1",
    isActive: true,
    itemId: "item-1",
    leadTimeDays: 3,
    minOrderQty: 50,
    purchasePrice: 15000,
    supplierId: "sup-1",
    supplierItemCode: "NCC-CUP-500",
    updatedAt: "2026-07-01T00:00:00.000Z",
  };
  const patchBodies: unknown[] = [];

  await page.route("**/api/wms/supplier/items/**", async (route) => {
    const method = route.request().method();

    if (method === "PATCH") {
      const patchBody = route.request().postDataJSON();
      patchBodies.push(patchBody);
      supplierItem = { ...supplierItem, ...patchBody };
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: supplierItem,
          meta: { requestId: "supplier-item-update" },
        }),
      });
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: [supplierItem],
        meta: { requestId: "supplier-item-list" },
      }),
    });
  });
  await page.route(/\/api\/wms\/supplier(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: [supplier],
        limit: 20,
        page: 1,
        total: 1,
      }),
    });
  });

  await page.goto("/suppliers");
  await page
    .getByRole("row", { name: /NCC-002/i })
    .getByRole("button", { name: /^Sửa$/i })
    .click();
  const supplierDialog = page.getByRole("dialog", {
    name: /Công ty TNHH ABCD/i,
  });
  await expect(supplierDialog).toBeVisible();
  await expect(supplierDialog.getByText("Mặt hàng NCC", { exact: true })).toBeVisible();
  await expect(supplierDialog.getByRole("row", { name: /item-1/i })).toBeVisible();

  await supplierDialog
    .getByRole("row", { name: /item-1/i })
    .getByRole("button", { name: /^Sửa$/i })
    .click();
  const editDialog = page.getByRole("dialog", { name: /Sửa mặt hàng NCC/i });
  await expect(editDialog).toBeVisible();
  await editDialog.getByLabel("Giá nhập").fill("17000");
  await editDialog.getByRole("button", { name: /^Lưu mặt hàng$/i }).click();
  await expect(page.getByText(/Đã cập nhật mặt hàng NCC/i)).toBeVisible();
  expect(patchBodies[0]).toMatchObject({ purchasePrice: 17000 });

  await page
    .getByRole("row", { name: /item-1/i })
    .getByRole("button", { name: /^Xóa$/i })
    .click();
  await page
    .getByRole("dialog", { name: /Xóa mặt hàng NCC/i })
    .getByRole("button", { name: /^Xóa$/i })
    .click();
  await expect(page.getByText(/Đã xóa mặt hàng NCC/i)).toBeVisible();
  expect(patchBodies[1]).toMatchObject({ isActive: false });
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

test("admin manages warehouse list and layout canvas", async ({ page }) => {
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

  await page.goto("/warehouses");
  await expect(page.getByRole("heading", { name: /^Kho$/i })).toBeVisible();
  await expect(page.getByText("Danh sách kho", { exact: true })).toBeVisible();
  await expect(page.getByRole("row", { name: /Kho trung tâm/i })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Sơ đồ kho Kho trung tâm/i }),
  ).toBeVisible();
  await expect(page.getByText("Chưa có API lưu sơ đồ")).toBeVisible();
  await expect(page.getByRole("button", { name: /Khu vực/i })).toBeVisible();
  expect(layoutCalled).toBe(true);

  await page.getByRole("button", { name: /Khu vực/i }).click();
  await expect(page.getByRole("button", { name: /Lưu bản nháp/i })).toBeDisabled();
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
  await page.route("**/api/wms/warehouse/*/layout**", async (route) => {
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "NOT_FOUND", message: "missing" } }),
    });
  });

  await page.goto("/warehouse-navigation");
  await expect(
    page.getByRole("heading", { name: "Cất hàng" }),
  ).toBeVisible();
  await page.getByRole("row", { name: /CUP-BLANK-500/i }).click();
  await expect(page.getByText("A1-S02").first()).toBeVisible();
  await page.getByRole("button", { name: /A1-S02/i }).click();
  await expect(page.getByLabel("Mã vị trí")).toHaveValue("A1-S02");
  await page.getByRole("button", { name: /^Xác nhận$/i }).click();
  await expect(page.getByText(/Đã xác nhận dòng cất hàng/i)).toBeVisible();
});

test("picker sees picking location and confirms goods issue line", async ({
  page,
}) => {
  await seedWmsSession(page, ["PICKER"], "Picker User");
  const goodsIssue = {
    id: "gi-1",
    items: [
      {
        itemId: "item-1",
        quantity: 12,
        remainingQty: 12,
        sku: "CUP-500ML-RED",
        unit: "cái",
      },
    ],
    orderId: "ORD-1",
    status: "PENDING",
    warehouseId: "central",
  };

  await page.route("**/api/wms/goods-issues**", async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (method === "POST") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: { ...goodsIssue, status: "CONFIRMED" },
          meta: { requestId: "goods-issue-confirm" },
        }),
      });
      return;
    }

    if (url.includes("/goods-issues/gi-1/items/item-1/suggestions")) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            {
              lotId: "lot-1",
              lotNumber: "LOT-A",
              quantity: 12,
              shelfCode: "A1-S02",
              shelfId: "shelf-1",
            },
          ],
          meta: { requestId: "pick-suggestions" },
        }),
      });
      return;
    }

    if (url.includes("/goods-issues/gi-1")) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: goodsIssue,
          meta: { requestId: "goods-issue-detail" },
        }),
      });
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: [goodsIssue],
        meta: { requestId: "goods-issue-list" },
      }),
    });
  });
  await page.route("**/api/wms/warehouse/*/layout**", async (route) => {
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "NOT_FOUND", message: "missing" } }),
    });
  });

  await page.goto("/goods-issues");
  await expect(page.getByRole("heading", { name: "Xuất kho" })).toBeVisible();
  await page.getByRole("row", { name: /CUP-500ML-RED/i }).click();
  await expect(page.getByText("A1-S02").first()).toBeVisible();
  await page.getByRole("button", { name: /A1-S02/i }).click();
  await expect(page.getByLabel("Mã vị trí")).toHaveValue("A1-S02");
  await expect(page.getByLabel("Mã lô")).toHaveValue("lot-1");
  await page.getByRole("button", { name: /^Xác nhận$/i }).click();
  await expect(page.getByText(/Đã xác nhận dòng xuất kho/i)).toBeVisible();
});

