import { expect, test, type Page } from "@playwright/test";

type SeedRole =
  | "ADMIN"
  | "MANAGER"
  | "SHIPPER"
  | "RECEIVER"
  | "PRINTER"
  | "COUNTER";

async function seedWmsSession(
  page: Page,
  roles: SeedRole[],
  name = "Role User",
) {
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
            },
          },
          version: 2,
        }),
      );
    },
    { name, roles },
  );
}

test("manager sees management dashboard and reports route", async ({
  page,
}) => {
  await seedWmsSession(page, ["MANAGER"], "Manager User");

  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: /Bảng điều phối quản lý/i }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Xuất kho/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Chuyển kho/i })).toHaveCount(0);

  await page.goto("/reports");
  await expect(
    page.getByRole("heading", { name: /^Báo cáo kho$/i }),
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: /^Tồn kho$/i })).toBeVisible();
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
        body: JSON.stringify({
          data: {},
          meta: { requestId: "product-delete" },
        }),
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
  await expect(
    page.getByRole("heading", { name: /^Sản phẩm$/i }),
  ).toBeVisible();
  await page
    .getByRole("row", { name: /CUP-500ML-RED/i })
    .getByRole("button", { name: /^Xem chi tiết$/i })
    .click();
  const detailDialog = page.getByRole("dialog", {
    name: /Chi tiết mặt hàng/i,
  });
  await expect(detailDialog).toBeVisible();
  await expect(detailDialog.getByText("SKU được tạo")).toBeVisible();
  await expect(detailDialog.getByText("CUP-500ML-RED")).toBeVisible();
  await expect(detailDialog.getByText(/EAN-13/i)).toHaveCount(0);
  await detailDialog.getByRole("button", { name: /^Sửa mặt hàng$/i }).click();
  await expect(
    page.getByRole("dialog", { name: /CUP-500ML-RED/i }),
  ).toBeVisible();
  await expect(page.getByText(/unit:/i)).toHaveCount(0);
  await expect(page.getByText(/factor:/i)).toHaveCount(0);
  await expect(page.getByLabel("Hệ số")).toHaveValue("24");
  await page.getByLabel("Tên mặt hàng").fill("Ly nhựa 500ml đỏ");
  await page.getByRole("button", { name: /^Lưu mặt hàng$/i }).click();
  await expect(page.getByText(/Đã cập nhật mặt hàng/i)).toBeVisible();
  expect(patchBody).toMatchObject({ name: "Ly nhựa 500ml đỏ" });
  expect(patchBody).not.toHaveProperty("attributes");
  expect(patchBody).not.toHaveProperty("barcode");
  expect(patchBody).not.toHaveProperty("sku");
  expect(patchBody).not.toHaveProperty("type");

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

test("manager creates a template-driven warehouse item", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1280 });
  await seedWmsSession(page, ["MANAGER"], "Manager User");
  const optionByKey = {
    CAPACITY: {
      code: "500",
      id: "66a100000000000000000003",
      key: "CAPACITY",
      name: "500 ml",
    },
    COLOR: {
      code: "CLR",
      id: "66a100000000000000000004",
      key: "COLOR",
      name: "Trong suốt",
    },
    CUP_STYLE: {
      code: "HRT",
      id: "66a100000000000000000001",
      key: "CUP_STYLE",
      name: "Ly nắp tim",
    },
    MATERIAL: {
      code: "PET",
      id: "66a100000000000000000002",
      key: "MATERIAL",
      name: "Nhựa PET",
    },
  } as const;
  let createBody: Record<string, unknown> | undefined;

  await page.route(
    "**/api/wms/stock/item-types/CUP_BLANK/sku-template**",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            fields: [
              { key: "CUP_STYLE" },
              { key: "MATERIAL" },
              { key: "CAPACITY" },
              { key: "COLOR" },
            ],
            itemType: "CUP_BLANK",
            kind: "template",
            prefix: "CUP",
            templateId: "CUP_BLANK",
          },
          meta: { requestId: "template" },
        }),
      });
    },
  );
  await page.route("**/api/wms/stock/attribute-options**", async (route) => {
    const key = new URL(route.request().url()).searchParams.get(
      "key",
    ) as keyof typeof optionByKey;
    const option = optionByKey[key];
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: [{ ...option, isActive: true, sortOrder: 1 }],
        meta: { requestId: `options-${key}` },
      }),
    });
  });
  await page.route("**/api/wms/stock/items**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.endsWith("/sku-preview")) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: { sku: "CUP-HRT-PET-500-CLR" },
          meta: { requestId: "preview" },
        }),
      });
      return;
    }
    if (request.method() === "POST") {
      createBody = request.postDataJSON();
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            ...createBody,
            attributes: [],
            barcode: "2000000000015",
            createdAt: "2026-07-23T00:00:00.000Z",
            id: "item-new",
            isActive: true,
            sku: "CUP-HRT-PET-500-CLR",
            updatedAt: "2026-07-23T00:00:00.000Z",
          },
          meta: { requestId: "create" },
        }),
      });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ data: [], meta: { requestId: "list" } }),
    });
  });

  await page.goto("/products");
  await expect(page.getByRole("heading", { name: "Sản phẩm" })).toBeVisible();
  const scrollState = await page.evaluate(() => {
    const main = document.querySelector("main");
    return {
      bodyFitsViewport: document.body.scrollHeight <= window.innerHeight,
      documentFitsViewport:
        document.documentElement.scrollHeight <= window.innerHeight,
      mainOverflowY: main ? getComputedStyle(main).overflowY : "",
    };
  });
  expect(scrollState).toEqual({
    bodyFitsViewport: true,
    documentFitsViewport: true,
    mainOverflowY: "auto",
  });
  const itemPanel = page.getByRole("tabpanel", { name: /^Mặt hàng$/i });
  await itemPanel.getByRole("button", { name: /^Tạo mặt hàng$/i }).click();
  const createDialog = page.getByRole("dialog", { name: /^Tạo mặt hàng$/i });
  await expect(createDialog).toBeVisible();

  const skuFieldBoxes = await Promise.all(
    ["Kiểu ly", "Chất liệu", "Dung tích", "Màu sắc"].map((label) =>
      createDialog.getByRole("combobox", { name: label }).boundingBox(),
    ),
  );
  const skuFieldTopPositions = skuFieldBoxes.map((box) => box?.y ?? -1);
  expect(
    Math.max(...skuFieldTopPositions) - Math.min(...skuFieldTopPositions),
  ).toBeLessThan(4);

  await page.setViewportSize({ height: 844, width: 390 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await createDialog.getByLabel("Tên nội bộ").fill("Ly nắp tim PET 500ml");

  for (const [label, optionName] of [
    ["Kiểu ly", "Ly nắp tim (HRT)"],
    ["Chất liệu", "Nhựa PET (PET)"],
    ["Dung tích", "500 ml (500)"],
    ["Màu sắc", "Trong suốt (CLR)"],
  ]) {
    await createDialog.getByRole("combobox", { name: label }).click();
    await page.getByRole("option", { name: optionName }).click();
  }

  await expect(createDialog.getByText("CUP-HRT-PET-500-CLR")).toBeVisible();
  await expect(createDialog.getByText("Đã xác nhận cấu hình")).toBeVisible();
  await createDialog.getByRole("button", { name: /^Tạo mặt hàng$/i }).click();

  await expect(
    createDialog.getByRole("heading", { name: /Đã tạo mặt hàng/i }),
  ).toBeVisible();
  await expect(createDialog.getByText("2000000000015")).toBeVisible();
  await expect(
    createDialog.getByRole("img", {
      name: "Mã vạch nội bộ 2000000000015",
    }),
  ).toBeVisible();
  expect(createBody).toMatchObject({
    attributeOptionIds: [
      optionByKey.CUP_STYLE.id,
      optionByKey.MATERIAL.id,
      optionByKey.CAPACITY.id,
      optionByKey.COLOR.id,
    ],
    name: "Ly nắp tim PET 500ml",
    templateId: "CUP_BLANK",
    type: "CUP_BLANK",
    unit: "cái",
  });
  expect(createBody).not.toHaveProperty("sku");
  expect(createBody).not.toHaveProperty("barcode");
  expect(createBody).not.toHaveProperty("attributes");
});
test("receiver gets inbound navigation and forbidden settings", async ({
  page,
}) => {
  await seedWmsSession(page, ["RECEIVER"], "Receiver User");

  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: /Khu vực nhận hàng/i }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Cất hàng/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Nhập hàng/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Hệ thống/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Nhân viên/i })).toHaveCount(0);

  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { name: /Không có quyền truy cập/i }),
  ).toBeVisible();
  await page.goto("/staff");
  await expect(
    page.getByRole("heading", { name: /Không có quyền truy cập/i }),
  ).toBeVisible();
});

test("counter proposes scrap only from a counted stock-count line", async ({
  page,
}) => {
  await seedWmsSession(page, ["COUNTER"], "Counter User");
  const stockCount = {
    id: "sc-1",
    stockCountNumber: "SC-20260730-0001",
    zoneId: null,
    status: "COMPLETED",
    createdBy: "manager-1",
    items: [
      {
        itemId: "item-1",
        sku: "CUP-RND-PP-700-WHT",
        shelfId: "shelf-1",
        lotId: null,
        systemQty: 10,
        actualQty: 10,
        delta: 0,
        reason: null,
        images: [],
      },
    ],
    createdAt: "2026-07-30T00:00:00.000Z",
    updatedAt: "2026-07-30T00:00:00.000Z",
  };
  let scrapRequestBody = "";

  await page.route("**/api/wms/stock-counts**", async (route) => {
    const request = route.request();
    if (request.method() === "POST" && request.url().endsWith("/scrap")) {
      scrapRequestBody = request.postData() ?? "";
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            id: "scrap-1",
            sourceStockCountId: "sc-1",
            status: "DRAFT",
            items: [],
          },
          meta: { requestId: "scrap-create" },
        }),
      });
      return;
    }

    const isDetail = /\/stock-counts\/sc-1(?:\?|$)/.test(request.url());
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        isDetail
          ? { data: stockCount, meta: { requestId: "count-detail" } }
          : {
              data: [stockCount],
              meta: {
                pagination: { page: 1, pageSize: 20, total: 1 },
                requestId: "count-list",
              },
            },
      ),
    });
  });
  await page.route("**/api/wms/scrap-notes**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: [],
        meta: { pagination: { page: 1, pageSize: 20, total: 0 } },
      }),
    });
  });

  await page.goto("/adjustments");
  await page.getByRole("button", { name: "Xem chi tiết" }).click();
  await page.getByRole("button", { name: "Đề xuất hủy" }).click();

  const dialog = page.getByRole("dialog", {
    name: "Đề xuất hủy từ dòng kiểm kê",
  });
  await expect(dialog.getByText("CUP-RND-PP-700-WHT")).toBeVisible();
  await expect(dialog.getByText("10")).toBeVisible();
  await dialog.getByLabel("Barcode SKU").fill("8938500000123");
  await dialog.getByLabel("Số lượng hủy").fill("2");
  await dialog.getByLabel("Lý do hủy").fill("Hai thùng bị vỡ");
  await dialog.getByRole("button", { name: "Gửi đề xuất hủy" }).click();

  await expect(dialog).toBeHidden();
  expect(scrapRequestBody).toContain("8938500000123");
  expect(scrapRequestBody).toContain("Hai thùng bị vỡ");
  expect(scrapRequestBody).toContain("shelf-1");

  await page
    .getByRole("dialog", { name: "Chi tiết phiếu kiểm kho" })
    .getByRole("button", { name: "Đóng" })
    .click();
  await page.getByRole("tab", { name: "Phiếu hủy" }).click();
  await expect(page.getByRole("button", { name: "Tạo phiếu hủy" })).toHaveCount(
    0,
  );
});

test("manager opens purchases when purchase order items are missing", async ({
  page,
}) => {
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
  await page.route(
    "**/api/wms/supplier/items/by-supplier/supplier-1",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            {
              id: "supplier-item-1",
              isActive: true,
              itemId: "item-1",
              minOrderQty: 12,
              purchasePrice: 1500,
              supplierId: "supplier-1",
            },
          ],
        }),
      });
    },
  );
  await page.route("**/api/wms/stock/items**", async (route) => {
    const item = {
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
    };
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        route.request().url().endsWith("/item-1")
          ? { data: item }
          : { data: [item], limit: 200, page: 1, total: 1 },
      ),
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
        data: new URL(url).pathname.endsWith("/po-no-items")
          ? purchaseOrderWithoutItems
          : [purchaseOrderWithoutItems],
        limit: 20,
        page: 1,
        total: 1,
        meta: { requestId: "purchase-order" },
      }),
    });
  });
  await page.route("**/api/wms/goods-receipt-notes**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ data: [], limit: 50, page: 1, total: 0 }),
    });
  });

  await page.goto("/purchase-orders");

  await expect(
    page.getByRole("heading", { name: /^Mua hàng$/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "PO-20260713-0002", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Chi tiết đơn mua" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Xem chi tiết đơn mua PO-20260713-0002" })
    .click();
  const detailDialog = page.getByRole("dialog", { name: "Chi tiết đơn mua" });
  await expect(detailDialog).toBeVisible();
  await expect(
    detailDialog.getByText("PO-20260713-0002", { exact: true }).first(),
  ).toBeVisible();
  await detailDialog.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: /^Tạo đơn mua$/i }).click();

  const dialog = page.getByRole("dialog", { name: /^Tạo đơn mua$/i });
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  const supplierSelect = dialog.getByRole("combobox", {
    name: "Nhà cung cấp",
  });
  const supplierTriggerBox = await supplierSelect.boundingBox();
  await supplierSelect.click();
  const supplierOptionsBox = await page
    .locator('[data-slot="select-content"][data-state="open"]')
    .boundingBox();
  expect(supplierTriggerBox).not.toBeNull();
  expect(supplierOptionsBox).not.toBeNull();
  expect(supplierOptionsBox!.y).toBeGreaterThanOrEqual(
    supplierTriggerBox!.y + supplierTriggerBox!.height - 1,
  );
  await page
    .getByText(/Công ty TNHH ABCD/i)
    .last()
    .click();
  await dialog.getByRole("combobox", { name: /Mặt hàng dòng 1/i }).click();
  await page.getByText(/Ly nhựa 500ml/i).click();
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

test("admin sees system health and staff list management", async ({ page }) => {
  await seedWmsSession(page, ["ADMIN"], "Admin User");
  await page.route("**/api/wms/users**", async (route) => {
    const detail = route.request().url().includes("/users/employee-id-1");
    const staff = {
      avatarUrl: "https://cdn.example.com/avatar.webp",
      createdAt: "2026-07-01T00:00:00.000Z",
      email: "administrator@example.com",
      id: "employee-id-1",
      mustChangePassword: false,
      name: "Administrator",
      role: "ADMIN",
      status: "ACTIVE",
      updatedAt: "2026-07-23T00:00:00.000Z",
      username: "admin_login",
    };
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: detail ? staff : [staff],
        meta: { requestId: detail ? "e2e-staff-detail" : "e2e-staff-list" },
      }),
    });
  });
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

  await expect(
    page.getByRole("heading", { name: /^Hệ thống$/i }),
  ).toBeVisible();
  await expect(
    page.getByText("Trạng thái hệ thống", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Kết nối WMS", { exact: true })).toBeVisible();
  await expect(page.getByText("Quản lý tài khoản WMS")).toHaveCount(0);

  await page.goto("/staff");

  await expect(
    page.getByRole("heading", { name: /^Nhân viên$/i }),
  ).toBeVisible();
  await expect(
    page.getByText("Danh sách nhân viên", { exact: true }),
  ).toBeVisible();
  const staffRow = page.getByRole("row", { name: /Administrator/i });
  await expect(staffRow).toBeVisible();
  await expect(
    staffRow.getByText("employee-id-1", { exact: true }),
  ).toHaveCount(0);
  await expect(staffRow.getByText("admin_login", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    staffRow.getByText("administrator@example.com", { exact: true }),
  ).toHaveCount(0);
  await staffRow
    .getByRole("button", { name: /Xem chi tiết Administrator/i })
    .click();
  const staffDetail = page.getByRole("dialog", { name: /Chi tiết nhân viên/i });
  await expect(
    staffDetail.getByText("employee-id-1", { exact: true }),
  ).toBeVisible();
  await expect(
    staffDetail.getByText("admin_login", { exact: true }),
  ).toBeVisible();
  await expect(
    staffDetail.getByText("administrator@example.com", { exact: true }),
  ).toBeVisible();
  await staffDetail.getByRole("button", { name: "Close" }).click();
  await expect(
    page.getByRole("button", { name: /^Tạo nhân viên$/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Sửa/i }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Khóa$/i }).first(),
  ).toBeVisible();

  await expect(page.getByText("Phạm vi truy cập")).toBeVisible();
  await expect(page.getByText("Toàn hệ thống")).toBeVisible();
  await page.getByRole("button", { name: "AU Admin", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: /Hồ sơ/i })).toBeVisible();
  await expect(
    page.getByRole("menuitem", { name: /Đổi mật khẩu/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("menuitem", { name: /Đăng xuất/i }),
  ).toBeVisible();
  await expect(page.getByRole("menuitem", { name: /Nhân viên/i })).toHaveCount(
    0,
  );
  await expect(page.getByRole("menuitem", { name: /Hệ thống/i })).toHaveCount(
    0,
  );
});

test("manager sees staff but cannot mutate ADMIN accounts", async ({
  page,
}) => {
  await seedWmsSession(page, ["MANAGER"], "Manager User");
  await page.route("**/api/wms/users**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          {
            id: "admin-1",
            mustChangePassword: false,
            name: "Administrator",
            role: "ADMIN",
            status: "ACTIVE",
            username: "admin",
          },
        ],
        meta: {
          pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
          requestId: "e2e-manager-staff-list",
        },
      }),
    });
  });
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

  await expect(
    page.getByRole("heading", { name: /^Hệ thống$/i }),
  ).toBeVisible();
  await expect(
    page.getByText("Trạng thái hệ thống", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Kết nối WMS", { exact: true })).toBeVisible();
  await expect(page.getByText("Quản lý tài khoản WMS")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Nhân viên/i })).toBeVisible();

  await page.goto("/staff");
  await expect(page.getByText("Administrator")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Tạo nhân viên/i }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Sửa/i })).toBeDisabled();
  await expect(page.getByRole("button", { name: /^Khóa$/i })).toBeDisabled();
  await expect(
    page.getByText("Chỉ Admin có thể thao tác tài khoản Admin."),
  ).toBeVisible();
});

test("printer can use print jobs but not purchases", async ({ page }) => {
  await seedWmsSession(page, ["PRINTER"], "Printer User");
  let lineStatus: "PENDING" | "CONSUMED" | "COMPLETED" = "PENDING";
  let putawayRemainingQty = 0;
  const printJob = () => ({
    createdAt: "2026-07-04T00:00:00.000Z",
    id: "pj-1",
    items: [
      {
        inputItemId: "blank-1",
        lineStatus,
        orderItemId: "order-item-1",
        outputBarcode: "2000000000015",
        outputItemId: "printed-1",
        putawayRemainingQty,
        quantity: 10,
        remainingQty: lineStatus === "COMPLETED" ? 0 : 10,
        reservedQty: 10,
        sku: "CUP-PRINTED-500-DSG042",
      },
    ],
    orderCode: "ORD-20260704-0001",
    orderId: "order-1",
    printJobNumber: "PRN-20260704-0001",
    stage: "PRODUCTION",
    status:
      lineStatus === "PENDING"
        ? "PENDING"
        : lineStatus === "CONSUMED"
          ? "IN_PROGRESS"
          : putawayRemainingQty > 0
            ? "PUTAWAY_PENDING"
            : "COMPLETED",
    updatedAt: "2026-07-04T00:00:00.000Z",
  });
  const postBodies: unknown[] = [];

  await page.route("**/api/wms/print-jobs**", async (route) => {
    const method = route.request().method();
    const url = route.request().url();

    if (method === "POST") {
      postBodies.push(route.request().postDataJSON());
      if (url.includes("/putaway")) {
        putawayRemainingQty = 0;
      } else if (url.includes("/complete")) {
        lineStatus = "COMPLETED";
        putawayRemainingQty = 10;
      } else {
        lineStatus = "CONSUMED";
      }
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
  const path = {
    distanceM: 8,
    points: [
      { xM: 0, yM: 2 },
      { xM: 8, yM: 5 },
    ],
    startGateCode: "GATE-01",
    targetRackId: "rack-1",
  };
  await page.route("**/api/wms/putaway/suggestions**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          suggestions: [
            {
              bay: 1,
              capacity: 80,
              cellCode: "R01-T1-B1",
              cellId: "cell-1",
              fillPercent: 0,
              level: 1,
              path,
              rackId: "rack-1",
              reason: "BEST_FIT_VOLUME",
              shelfCode: "R01-T1",
            },
          ],
        },
        meta: { requestId: "print-putaway-suggestions" },
      }),
    });
  });
  await page.route("**/api/wms/location/layout**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          aisles: [],
          canvas: { gridM: 1, heightM: 12, widthM: 20 },
          gates: [{ code: "GATE-01", id: "gate-1", xM: 0, yM: 2 }],
          id: "single-warehouse-layout",
          rackTemplate: {
            bayCount: 1,
            depthM: 1,
            heightM: 3,
            levelCount: 1,
            widthM: 4,
          },
          racks: [
            {
              accessPointXM: 8,
              accessPointYM: 5,
              code: "R01",
              id: "rack-1",
              name: "Kệ R01",
              rotation: 0,
              xM: 7,
              yM: 4,
              zoneId: "zone-1",
            },
          ],
          revision: 1,
          shelves: [],
          status: "PUBLISHED",
          updatedAt: "2026-07-04T00:00:00.000Z",
          zones: [],
        },
        meta: { requestId: "print-putaway-layout" },
      }),
    });
  });
  await page.route(
    "**/api/wms/location/racks/rack-1/cells**",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            {
              barcode: "R01-T1-B1",
              bay: 1,
              code: "R01-T1-B1",
              contents: [],
              fillPercent: 0,
              id: "cell-1",
              innerDepth: 100,
              innerHeight: 60,
              innerWidth: 80,
              level: 1,
              occupiedVolumeCm3: 0,
              rackId: "rack-1",
              shelfId: "shelf-1",
              status: "ACTIVE",
              usableVolumeCm3: 480000,
            },
          ],
          meta: { requestId: "print-putaway-cells" },
        }),
      });
    },
  );

  await page.goto("/print-jobs");
  await expect(page.getByRole("heading", { name: /^In ly$/i })).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: new RegExp(["Theo dõi", "lệnh in"].join(" "), "i"),
    }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Xem chi tiết" }).click();
  await page.getByRole("row", { name: /CUP-PRINTED-500-DSG042/i }).click();
  await page.getByLabel("Mã vạch mặt hàng").fill("2000000000015");
  await page.getByLabel("Mã vị trí").fill("A1-S02");
  await page.getByRole("button", { name: /^Tiêu thụ ly chưa in$/i }).click();
  await expect(
    page.getByText(/Đã ghi nhận tiêu thụ ly chưa in/i),
  ).toBeVisible();
  expect(postBodies[0]).toMatchObject({
    itemBarcode: "2000000000015",
    quantity: 10,
    shelfCode: "A1-S02",
  });

  await page
    .getByRole("button", { name: /^Đưa thành phẩm vào khu chờ$/i })
    .click();
  await expect(page.getByText(/Đã xác nhận in xong/i)).toBeVisible();
  expect(postBodies[1]).toMatchObject({
    quantity: 10,
  });
  expect(postBodies[1]).not.toHaveProperty("shelfCode");

  await expect(
    page.getByText("Hướng dẫn cất hàng", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /R01-T1-B1/i }).click();
  await expect(
    page.getByRole("button", { name: "Mở bản đồ kho" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Mở bản đồ kho" }).click();
  await page.getByRole("button", { name: "Xem mặt kệ R01" }).click();
  await page
    .getByRole("button", { name: /R01-T1-B1/i })
    .last()
    .click();
  await page.getByRole("button", { name: "Chọn khoang và quét mã" }).click();
  const scanner = page.getByRole("dialog", { name: "Quét xác nhận vị trí" });
  await scanner.getByLabel("Mã vạch mặt hàng").fill("2000000000015");
  await scanner.getByRole("button", { name: "Xác nhận cất hàng" }).click();
  await expect(page.getByText("Đã cất thành phẩm vào khoang.")).toBeVisible();
  expect(postBodies[2]).toMatchObject({
    cellBarcode: "R01-T1-B1",
    itemBarcode: "2000000000015",
    quantity: 10,
    suggestedCellId: "cell-1",
  });

  await page.goto("/purchase-orders");
  await expect(
    page.getByRole("heading", { name: /Không có quyền truy cập/i }),
  ).toBeVisible();
});

test("printer submits proof before completing a sample print", async ({
  page,
}) => {
  await seedWmsSession(page, ["PRINTER"], "Printer User");
  let completeBody: Record<string, unknown> | undefined;
  const printJob = {
    createdAt: "2026-07-04T00:00:00.000Z",
    id: "pj-sample-1",
    items: [
      {
        inputItemId: "blank-1",
        lineStatus: "CONSUMED",
        orderItemId: "order-item-1",
        outputBarcode: "2000000000015",
        outputItemId: "printed-1",
        putawayRemainingQty: 0,
        quantity: 1,
        remainingQty: 0,
        reservedQty: 1,
        sku: "CUP-PRINTED-500-DSG042",
      },
    ],
    orderCode: "ORD-20260704-0001",
    orderId: "order-1",
    printJobNumber: "PRN-20260704-0002",
    stage: "SAMPLE",
    status: "IN_PROGRESS",
    updatedAt: "2026-07-04T00:00:00.000Z",
  };

  await page.route("**/api/wms/print-jobs**", async (route) => {
    if (route.request().method() === "POST") {
      completeBody = route.request().postDataJSON();
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: route.request().url().includes("/print-jobs/pj-sample-1")
          ? printJob
          : [printJob],
        meta: { requestId: "print-job-sample" },
      }),
    });
  });

  await page.goto("/print-jobs");
  await page.getByRole("button", { name: "Xem chi tiết" }).click();
  await page.getByRole("row", { name: /CUP-PRINTED-500-DSG042/i }).click();
  await page
    .getByLabel("Đường dẫn ảnh minh chứng")
    .fill("https://cdn.example.com/proof/sample-1.jpg");
  await page.getByRole("button", { name: "Hoàn tất bản mẫu" }).click();

  expect(completeBody).toEqual({
    proofImage: "https://cdn.example.com/proof/sample-1.jpg",
    quantity: 1,
  });
});

test("manager can view print jobs without processing controls", async ({
  page,
}) => {
  await seedWmsSession(page, ["MANAGER"], "Manager User");
  const printJob = {
    createdAt: "2026-07-04T00:00:00.000Z",
    id: "pj-1",
    items: [
      {
        inputItemId: "blank-1",
        lineStatus: "PENDING",
        orderItemId: "order-item-1",
        outputBarcode: "2000000000015",
        outputItemId: "printed-1",
        putawayRemainingQty: 0,
        quantity: 10,
        remainingQty: 10,
        reservedQty: 10,
        sku: "CUP-PRINTED-500-DSG042",
      },
    ],
    orderCode: "ORD-20260704-0001",
    orderId: "order-1",
    printJobNumber: "PRN-20260704-0001",
    stage: "PRODUCTION",
    status: "PENDING",
    updatedAt: "2026-07-04T00:00:00.000Z",
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
  await page.getByRole("button", { name: "Xem chi tiết" }).click();
  await expect(
    page.getByRole("cell", { name: /^CUP-PRINTED-500-DSG042$/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Tiêu thụ ly chưa in$/i }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /^Xác nhận in xong$/i }),
  ).toHaveCount(0);
});

test("shipper mobile drawer exposes picking and delivery routes", async ({
  page,
}) => {
  await seedWmsSession(page, ["SHIPPER"], "Shipper User");
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: /Khu vực xuất kho và giao hàng/i }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Mở menu/i }).click();
  await expect(page.getByRole("link", { name: /Xuất kho/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Giao hàng/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Chuyển kho/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Nhập hàng/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Kiểm kê/i })).toHaveCount(0);
});

test("manager opens the canonical warehouse map editor", async ({ page }) => {
  await seedWmsSession(page, ["MANAGER"], "Manager User");
  let legacyWarehouseCalled = false;

  await page.route("**/api/wms/warehouse**", async (route) => {
    legacyWarehouseCalled = true;
    await route.abort();
  });
  await page.route("**/api/wms/location/layout", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          id: "single-warehouse-layout",
          revision: 7,
          updatedAt: "2026-07-27T10:00:00.000Z",
          canvas: { widthM: 40, heightM: 24, gridM: 0.5 },
          rackTemplate: {
            widthM: 10,
            depthM: 1.5,
            heightM: 3,
            levelCount: 3,
            bayCount: 3,
          },
          zones: [
            {
              code: "A",
              id: "zone-1",
              name: "Khu A",
              xM: 1,
              yM: 1,
              widthM: 16,
              heightM: 12,
              rotation: 0,
            },
          ],
          racks: [
            {
              code: "A1",
              id: "rack-1",
              name: "Kệ A1",
              zoneId: "zone-1",
              xM: 3,
              yM: 3,
              rotation: 0,
              accessPointXM: 8,
              accessPointYM: 6,
            },
          ],
          shelves: [
            {
              code: "A1-S01",
              id: "shelf-1",
              isStaging: false,
              level: 1,
              rackId: "rack-1",
            },
          ],
          aisles: [],
          gates: [],
        },
        meta: { requestId: "location-layout" },
      }),
    });
  });

  await page.goto("/locations/map");
  await expect(page).toHaveURL(/\/locations$/);
  await expect(
    page.getByRole("heading", { name: "Bản đồ kho 2D" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Khu vực" })).toBeVisible();
  await expect(page.getByLabel("Sơ đồ kho")).toBeVisible();
  await expect(page.getByText("Kích thước rack chuẩn")).toHaveCount(0);
  expect(legacyWarehouseCalled).toBe(false);
});

test("shipper claims an issue, follows the suggested cell and confirms picking", async ({
  page,
}) => {
  await seedWmsSession(page, ["SHIPPER"], "Shipper User");
  let claimed = false;
  let confirmBody: Record<string, unknown> | undefined;
  const path = {
    startGateCode: "GATE-01",
    targetRackId: "rack-1",
    points: [
      { xM: 0, yM: 2 },
      { xM: 4, yM: 2 },
      { xM: 8, yM: 5 },
    ],
    distanceM: 9,
  };
  let goodsIssue = {
    assignedAt: undefined as string | undefined,
    assignedShipperId: undefined as string | undefined,
    goodsIssueNumber: "GI-20260730-0001",
    id: "gi-1",
    items: [
      {
        itemId: "item-1",
        quantity: 24,
        remainingQty: 24,
        packageCount: 2,
        sku: "CUP-500ML-RED",
        unit: "cái",
      },
    ],
    orderCode: "ORD-1",
    orderId: "order-internal-1",
    status: "PENDING",
  };
  const cell = {
    id: "cell-1",
    rackId: "rack-1",
    shelfId: "shelf-1",
    level: 1,
    bay: 1,
    code: "R01-T1-B1",
    barcode: "R01-T1-B1",
    status: "ACTIVE",
    innerDepth: 100,
    innerWidth: 100,
    innerHeight: 100,
    usableVolumeCm3: 750000,
    occupiedVolumeCm3: 60000,
    fillPercent: 8,
    contents: [
      {
        id: "inventory-1",
        sku: "CUP-500ML-RED",
        itemName: "Ly nhựa 500ml",
        unit: "cái",
        quantity: 24,
        packageCount: 2,
        packageFactor: 12,
        lotNumber: "LOT-A",
      },
    ],
  };

  await page.route("**/api/wms/goods-issues**", async (route) => {
    const url = route.request().url();
    if (route.request().method() === "POST") {
      if (url.endsWith("/claim")) {
        claimed = true;
        goodsIssue = {
          ...goodsIssue,
          assignedShipperId: "e2e-shipper",
          assignedAt: "2026-07-30T01:00:00.000Z",
        };
      } else {
        confirmBody = route.request().postDataJSON();
        goodsIssue = { ...goodsIssue, status: "CONFIRMED" };
      }
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          meta: { requestId: "pick-e2e" },
          data: goodsIssue,
        }),
      });
      return;
    }
    if (url.includes("/items/item-1/suggestions")) {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          meta: { requestId: "pick-e2e" },
          data: [
            {
              shelfId: "shelf-1",
              shelfCode: "R01-T1",
              cellId: "cell-1",
              cellCode: "R01-T1-B1",
              rackId: "rack-1",
              level: 1,
              bay: 1,
              path,
              lotId: "lot-1",
              lotNumber: "LOT-A",
              quantity: 24,
              packageCount: 2,
              packageFactor: 12,
            },
          ],
        }),
      });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        meta: { requestId: "pick-e2e" },
        data: url.includes("/goods-issues/gi-1") ? goodsIssue : [goodsIssue],
      }),
    });
  });
  await page.route("**/api/wms/location/layout", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        meta: { requestId: "pick-e2e" },
        data: {
          id: "single-warehouse-layout",
          revision: 1,
          updatedAt: "2026-07-30T00:00:00.000Z",
          canvas: { widthM: 20, heightM: 12, gridM: 1 },
          rackTemplate: {
            widthM: 4,
            depthM: 1,
            heightM: 3,
            levelCount: 3,
            bayCount: 4,
          },
          zones: [],
          racks: [
            {
              id: "rack-1",
              zoneId: "zone-1",
              code: "R01",
              name: "Kệ R01",
              xM: 7,
              yM: 4,
              widthM: 4,
              depthM: 1,
              rotation: 0,
              accessPointXM: 8,
              accessPointYM: 5,
            },
          ],
          shelves: [],
          aisles: [
            {
              id: "aisle-1",
              code: "A01",
              xM: 0,
              yM: 2,
              widthM: 12,
              heightM: 2,
            },
          ],
          gates: [{ id: "gate-1", code: "GATE-01", xM: 0, yM: 2 }],
        },
      }),
    });
  });
  await page.route("**/api/wms/location/racks/rack-1/cells", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ data: [cell], meta: { requestId: "pick-cell" } }),
    });
  });
  await page.route("**/api/wms/location/navigation**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ data: path, meta: { requestId: "pick-path" } }),
    });
  });

  await page.goto("/goods-issues");
  await page.getByRole("button", { name: "Xem chi tiết" }).click();
  await page.getByRole("button", { name: "Nhận phiếu" }).click();
  await expect(page.getByText(/Đã nhận phiếu xuất/i)).toBeVisible();
  await page.getByRole("row", { name: /CUP-500ML-RED/i }).click();
  await expect(page.getByText("R01-T1-B1").first()).toBeVisible();
  await page.getByRole("button", { name: /R01-T1-B1.*Ưu tiên/i }).click();
  await expect(
    page.getByRole("button", { name: "Mở bản đồ kho" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Mở bản đồ kho" }).click();
  await page.getByRole("button", { name: "Xem mặt kệ R01" }).click();
  await page
    .getByRole("button", { name: /R01-T1-B1/i })
    .last()
    .click();
  await page.getByRole("button", { name: "Chọn khoang và quét mã" }).click();
  const scanner = page.getByRole("dialog", { name: "Quét xác nhận vị trí" });
  await scanner.getByLabel("Mã vạch mặt hàng").fill("2000000000015");
  await expect(scanner.getByLabel("Mã khoang")).toHaveValue("R01-T1-B1");
  await scanner.getByLabel("Số thùng nguyên").fill("2");
  await scanner.getByRole("button", { name: "Xác nhận lấy hàng" }).click();
  await expect(
    page.getByText(/Đã xác nhận lấy hàng đúng khoang/i),
  ).toBeVisible();
  expect(claimed).toBe(true);
  expect(confirmBody).toMatchObject({
    itemBarcode: "2000000000015",
    cellBarcode: "R01-T1-B1",
    quantity: 2,
    suggestedCellId: "cell-1",
    lotId: "lot-1",
  });
});
test("shipper closes picked goods into a WMS package", async ({ page }) => {
  await seedWmsSession(page, ["SHIPPER"], "Shipper User");
  let packageBody: Record<string, unknown> | undefined;
  const goodsIssue = {
    assignedShipperId: "e2e-shipper",
    goodsIssueNumber: "GI-20260721-0001",
    id: "issue-1",
    items: [
      {
        itemId: "item-1",
        quantity: 24,
        remainingQty: 0,
        sku: "CUP-500ML-RED",
      },
    ],
    orderCode: "ORD-001",
    orderId: "order-internal-1",
    status: "CONFIRMED",
  };
  let packages: Array<{
    allocations: Array<{ itemId: string; quantity: number; sku: string }>;
    barcode: string;
    createdAt: string;
    createdBy: string;
  }> = [];
  const shipment = () => ({
    activeTripId: undefined,
    assignedShipperId: "e2e-shipper",
    attempts: 0,
    codAmount: 320000,
    createdAt: "2026-07-21T00:00:00.000Z",
    goodsIssueId: "issue-1",
    id: "shipment-1",
    orderCode: "ORD-001",
    orderId: "order-internal-1",
    packages,
    paymentMethod: "COD",
    recipient: {
      address: { line: "12 Nguyễn Văn Linh", province: "Hồ Chí Minh" },
      name: "Nguyễn An",
      phone: "0901000000",
    },
    shipmentStatus: packages.length > 0 ? "READY" : "PENDING",
    shipmentNumber: "SHP-20260721-0001",
    statusHistory: [],
    updatedAt: "2026-07-21T00:00:00.000Z",
  });

  await page.route("**/api/wms/goods-issues**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: goodsIssue,
        meta: { requestId: "package-goods-issue" },
      }),
    });
  });
  await page.route("**/api/wms/shipments**", async (route) => {
    const request = route.request();
    const url = request.url();

    if (request.method() === "POST" && url.endsWith("/packages")) {
      packageBody = request.postDataJSON();
      packages = [
        {
          allocations: [
            { itemId: "item-1", quantity: 24, sku: "CUP-500ML-RED" },
          ],
          barcode: "PKG-20260721-0001",
          createdAt: "2026-07-21T01:00:00.000Z",
          createdBy: "e2e-shipper",
        },
      ];
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: shipment(),
          meta: { requestId: "package-create" },
        }),
      });
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: url.includes("/shipments/shipment-1") ? shipment() : [shipment()],
        meta: { requestId: "package-shipment" },
      }),
    });
  });

  await page.goto("/shipping");
  await expect(
    page.getByRole("heading", { name: /^Giao hàng$/i }),
  ).toBeVisible();
  await page.getByRole("row", { name: /ORD-001/i }).click();
  await page.getByRole("button", { name: /^Đóng kiện$/i }).click();
  const packageDialog = page.getByRole("dialog", {
    name: /^Đóng kiện hàng$/i,
  });
  await expect(packageDialog.getByLabel("Số lượng CUP-500ML-RED")).toHaveValue(
    "24",
  );
  await packageDialog
    .getByRole("button", { name: /Tạo kiện và barcode/i })
    .click();
  await expect(page.getByText(/Vận đơn sẵn sàng xếp chuyến/i)).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: "Mã vạch nội bộ PKG-20260721-0001",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Gán hãng|Cập nhật trạng thái/i }),
  ).toHaveCount(0);
  expect(packageBody).toEqual({
    allocations: [{ itemId: "item-1", quantity: 24 }],
  });
});

test("manager can inspect packages but cannot claim, pick or close them", async ({
  page,
}) => {
  await seedWmsSession(page, ["MANAGER"], "Manager User");
  const goodsIssue = {
    assignedShipperId: "shipper-1",
    goodsIssueNumber: "GI-20260721-0002",
    id: "issue-2",
    items: [
      {
        itemId: "item-1",
        quantity: 12,
        remainingQty: 0,
        sku: "CUP-500ML-WHT",
      },
    ],
    orderCode: "ORD-002",
    orderId: "order-2",
    status: "CONFIRMED",
  };
  await page.route("**/api/wms/shipments**", async (route) => {
    const isDetail = route.request().url().includes("/shipments/shipment-2");
    const shipment = {
      assignedShipperId: "shipper-1",
      attempts: 0,
      codAmount: 0,
      goodsIssueId: "issue-2",
      id: "shipment-2",
      orderCode: "ORD-002",
      orderId: "order-2",
      packages: [],
      paymentMethod: "ONLINE",
      recipient: {
        address: { line: "1 Lê Lợi" },
        name: "Khách hàng",
        phone: "0902000000",
      },
      shipmentNumber: "SHP-20260721-0002",
      shipmentStatus: "PENDING",
      statusHistory: [],
    };
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: isDetail ? shipment : [shipment],
        meta: { requestId: "manager-shipment" },
      }),
    });
  });
  await page.route("**/api/wms/goods-issues**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: goodsIssue,
        meta: { requestId: "manager-goods-issue" },
      }),
    });
  });

  await page.goto("/shipping");
  await page.getByRole("row", { name: /ORD-002/i }).click();
  await expect(page.getByText(/Manager và Admin chỉ xem/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /^Đóng kiện$/i })).toHaveCount(
    0,
  );
  await expect(page.getByRole("tab", { name: /Hãng vận chuyển/i })).toHaveCount(
    0,
  );
});

test("admin selects an item type before managing SKU values", async ({
  page,
}) => {
  await seedWmsSession(page, ["ADMIN"], "Admin User");

  for (const [type, fields] of [
    ["CUP_BLANK", [{ key: "MATERIAL" }, { key: "CAPACITY" }]],
    ["MATERIAL", [{ key: "MATERIAL" }]],
  ] as const) {
    await page.route(
      `**/api/wms/stock/item-types/${type}/sku-template**`,
      async (route) => {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              fields,
              itemType: type,
              kind: "template",
              prefix: type,
              templateId: type,
            },
            meta: { requestId: "template-" + type },
          }),
        });
      },
    );
  }
  await page.route(
    "**/api/wms/stock/item-types/PACKAGING/sku-template**",
    async (route) => {
      const categoryOptionId = new URL(route.request().url()).searchParams.get(
        "categoryOptionId",
      );
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: categoryOptionId
            ? {
                fields: [{ key: "SIZE" }],
                itemType: "PACKAGING",
                kind: "template",
                prefix: "PKG-LID",
                templateId: "PACKAGING_LID",
              }
            : {
                categoryKey: "PACKAGING_CATEGORY",
                kind: "category-options",
                options: [
                  {
                    code: "LID",
                    id: "packaging-lid",
                    isActive: true,
                    key: "PACKAGING_CATEGORY",
                    name: "Nắp ly",
                    sortOrder: 1,
                  },
                ],
              },
          meta: { requestId: "template-PACKAGING" },
        }),
      });
    },
  );
  await page.route("**/api/wms/stock/attribute-options**", async (route) => {
    const key = new URL(route.request().url()).searchParams.get("key");
    const optionByKey: Record<string, object[]> = {
      CAPACITY: [
        {
          code: "500",
          id: "capacity-500",
          isActive: false,
          key: "CAPACITY",
          name: "500 ml",
          sortOrder: 1,
        },
      ],
      MATERIAL: [
        {
          code: "PET",
          id: "material-pet",
          isActive: true,
          key: "MATERIAL",
          name: "Nhựa PET",
          sortOrder: 1,
        },
      ],
      PACKAGING_CATEGORY: [
        {
          code: "LID",
          id: "packaging-lid",
          isActive: true,
          key: "PACKAGING_CATEGORY",
          name: "Nắp ly",
          sortOrder: 1,
        },
      ],
      SIZE: [],
    };
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: optionByKey[key ?? ""] ?? [],
        meta: { requestId: `options-${key}` },
      }),
    });
  });
  await page.route("**/api/wms/stock/items**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ data: [], limit: 20, page: 1, total: 0 }),
    });
  });

  await page.goto("/products");
  await page.getByRole("tab", { name: /^Tạo thuộc tính SKU$/i }).click();
  const panel = page.getByRole("tabpanel", { name: /^Tạo thuộc tính SKU$/i });
  await expect(
    panel.getByRole("heading", { name: /Giá trị thuộc tính SKU/i }),
  ).toBeVisible();
  await panel.getByLabel("Nhóm thuộc tính").click();
  await page.getByRole("option", { name: "Dung tích" }).click();
  await panel.getByLabel("Tìm kiếm").fill("PET");
  await expect(
    panel.getByRole("row", { name: /Chất liệu.*Nhựa PET.*PET/i }),
  ).toBeVisible();
  await expect(panel.getByText("500 ml", { exact: true })).toHaveCount(0);

  await panel.getByLabel("Tìm kiếm").fill("");
  await panel.getByRole("combobox", { name: "Trạng thái" }).click();
  await page.getByRole("option", { name: "Ngừng dùng" }).click();
  await expect(
    panel.getByRole("row", { name: /Dung tích.*500 ml.*500/i }),
  ).toBeVisible();
  await expect(panel.getByText("Nhựa PET", { exact: true })).toHaveCount(0);

  await panel.getByLabel("Loại mặt hàng").click();
  await page.getByRole("option", { name: "Bao bì" }).click();
  await panel.getByLabel("Nhóm thuộc tính").click();
  await page.getByRole("option", { name: "Nhóm bao bì" }).click();
  await expect(panel.getByLabel("Tên giá trị")).toBeEnabled();
  await expect(panel.getByRole("textbox", { name: "Mã SKU" })).toBeEnabled();
});

test("supplier code suggestion stops after a manual edit", async ({ page }) => {
  await seedWmsSession(page, ["ADMIN"], "Admin User");
  await page.route(/\/api\/wms\/supplier(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ data: [], limit: 20, page: 1, total: 0 }),
    });
  });

  await page.goto("/suppliers");
  await page.getByRole("button", { name: /^Tạo nhà cung cấp$/i }).click();
  const dialog = page.getByRole("dialog", { name: /^Tạo nhà cung cấp$/i });
  await dialog.getByLabel("Tên NCC").fill("Công ty Minh Long");
  await expect(dialog.getByLabel("Mã NCC")).toHaveValue("CML");
  await dialog.getByLabel("Mã NCC").fill("MINHLONG");
  await dialog.getByLabel("Tên NCC").fill("Công ty Minh Long Việt Nam");
  await expect(dialog.getByLabel("Mã NCC")).toHaveValue("MINHLONG");
});
