import { expect, test, type Page } from "@playwright/test";

type SeedRole =
  | "ADMIN"
  | "MANAGER"
  | "SHIPPER"
  | "RECEIVER"
  | "PICKER"
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

  await page.goto("/purchases");

  await expect(
    page.getByRole("heading", { name: /^Nhập hàng$/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "PO-20260713-0002", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: "Đơn mua" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Phiếu nhập" })).toBeVisible();
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
  const supplierSelect = dialog.getByRole("combobox").nth(0);
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
    .getByText(/NCC-001/i)
    .last()
    .click();
  await dialog.getByRole("combobox").nth(1).click();
  await page
    .getByText(/^Kho A$/i)
    .last()
    .click();
  await dialog.getByRole("combobox", { name: /Mặt hàng dòng 1/i }).click();
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

test("admin edits and removes supplier items from row actions", async ({
  page,
}) => {
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

  await page.route("**/api/wms/supplier/sup-1", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: supplier,
        meta: { requestId: "supplier-detail" },
      }),
    });
  });
  await page.route("**/api/wms/stock/items/item-1", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          createdAt: "2026-07-01T00:00:00.000Z",
          id: "item-1",
          isActive: true,
          isPerishable: false,
          name: "Ly nhựa 500 ml",
          sku: "SKU-001",
          type: "CUP_BLANK",
          unit: "cái",
          updatedAt: "2026-07-01T00:00:00.000Z",
        },
        meta: { requestId: "warehouse-item-detail" },
      }),
    });
  });
  await page.goto("/suppliers");
  await page
    .getByRole("row", { name: /NCC-002/i })
    .getByRole("button", { name: /Xem chi tiết nhà cung cấp/i })
    .click();
  const supplierDialog = page.getByRole("dialog", {
    name: /Công ty TNHH ABCD/i,
  });
  await expect(supplierDialog).toBeVisible();
  await expect(
    supplierDialog.getByText("Mặt hàng NCC", { exact: true }),
  ).toBeVisible();
  await expect(
    supplierDialog.getByRole("row", { name: /item-1/i }),
  ).toBeVisible();

  await supplierDialog
    .getByRole("row", { name: /item-1/i })
    .getByRole("button", { name: /Xem chi tiết mặt hàng NCC/i })
    .click();
  const editDialog = page.getByRole("dialog", {
    name: /Chi tiết mặt hàng NCC/i,
  });
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

test("manager manages the single-warehouse location structure", async ({
  page,
}) => {
  await seedWmsSession(page, ["MANAGER"], "Manager User");
  let legacyWarehouseCalled = false;

  await page.route("**/api/wms/warehouse**", async (route) => {
    legacyWarehouseCalled = true;
    await route.abort();
  });
  await page.route("**/api/wms/location/zones", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: [{ code: "A", id: "zone-1", name: "Khu A" }],
        meta: { requestId: "location-zones" },
      }),
    });
  });
  await page.route("**/api/wms/location/racks**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: [{ code: "A1", id: "rack-1", name: "Kệ A1", zoneId: "zone-1" }],
        meta: { requestId: "location-racks" },
      }),
    });
  });
  await page.route("**/api/wms/location/shelves**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          {
            code: "A1-S01",
            id: "shelf-1",
            isStaging: false,
            level: 1,
            rackId: "rack-1",
          },
        ],
        meta: { requestId: "location-shelves" },
      }),
    });
  });

  await page.goto("/locations");
  await expect(page.getByRole("heading", { name: "Vị trí kho" })).toBeVisible();
  await expect(page.getByText("Khu A")).toBeVisible();
  await expect(page.getByText("Kệ A1")).toBeVisible();
  await expect(page.getByText("A1-S01")).toBeVisible();
  expect(legacyWarehouseCalled).toBe(false);
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
  await expect(page.getByRole("heading", { name: "Cất hàng" })).toBeVisible();
  await page.getByRole("row", { name: /CUP-BLANK-500/i }).click();
  await expect(page.getByText("A1-S02").first()).toBeVisible();
  await page.getByRole("button", { name: /A1-S02/i }).click();
  await expect(page.getByLabel("Mã vị trí")).toHaveValue("A1-S02");
  await expect(page.getByLabel("Mã vạch mặt hàng")).toHaveValue("");
  await page.getByLabel("Mã vạch mặt hàng").fill("2000000000015");
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

  await page.goto("/goods-issues");
  await expect(page.getByRole("heading", { name: "Xuất kho" })).toBeVisible();
  await page.getByRole("row", { name: /CUP-500ML-RED/i }).click();
  await expect(page.getByText("A1-S02").first()).toBeVisible();
  await page.getByRole("button", { name: /A1-S02/i }).click();
  await expect(page.getByLabel("Mã vị trí")).toHaveValue("A1-S02");
  await expect(page.getByLabel("Mã vạch mặt hàng")).toHaveValue("");
  await page.getByLabel("Mã vạch mặt hàng").fill("2000000000015");
  await expect(page.getByLabel("Mã lô")).toHaveValue("lot-1");
  await page.getByRole("button", { name: /^Xác nhận$/i }).click();
  await expect(page.getByText(/Đã xác nhận dòng xuất kho/i)).toBeVisible();
});

test("shipper assigns a carrier and advances a shipment", async ({ page }) => {
  await seedWmsSession(page, ["SHIPPER"], "Shipper User");
  let shipmentStatus = "PENDING";
  let carrierId: string | undefined;
  let trackingNumber: string | undefined;
  const carrier = {
    code: "GHN",
    contactInfo: { phone: "1900636677" },
    id: "carrier-1",
    name: "Giao Hàng Nhanh",
    status: "ACTIVE",
  };
  const shipment = () => ({
    attempts: 0,
    carrierId,
    codAmount: 320000,
    createdAt: "2026-07-21T00:00:00.000Z",
    goodsIssueId: "issue-1",
    id: "shipment-1",
    orderId: "ORD-001",
    paymentMethod: "COD",
    recipient: {
      address: { line: "12 Nguyễn Văn Linh", province: "Hồ Chí Minh" },
      name: "Nguyễn An",
      phone: "0901000000",
    },
    shipmentStatus,
    statusHistory: [],
    trackingNumber,
    updatedAt: "2026-07-21T00:00:00.000Z",
  });

  await page.route("**/api/wms/carriers**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ data: [carrier] }),
    });
  });
  await page.route("**/api/wms/shipments**", async (route) => {
    const request = route.request();
    const url = request.url();

    if (request.method() === "PATCH") {
      if (url.endsWith("/assign")) {
        const payload = request.postDataJSON();
        carrierId = payload.carrierId;
        trackingNumber = payload.trackingNumber;
      } else {
        const multipartBody = request.postData() ?? "";
        const statusMatch = multipartBody.match(
          /name="status"\r?\n\r?\n([^\r\n]+)/,
        );
        shipmentStatus = statusMatch?.[1] ?? shipmentStatus;
      }
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ data: shipment() }),
      });
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: url.includes("/shipments/shipment-1") ? shipment() : [shipment()],
      }),
    });
  });

  await page.goto("/shipping");
  await expect(
    page.getByRole("heading", { name: /^Giao hàng$/i }),
  ).toBeVisible();
  await page.getByRole("row", { name: /ORD-001/i }).click();
  await page.getByRole("button", { name: /^Gán hãng và mã vận đơn$/i }).click();
  const assignDialog = page.getByRole("dialog", {
    name: /Gán hãng vận chuyển/i,
  });
  await assignDialog.getByRole("combobox", { name: "Hãng vận chuyển" }).click();
  await page.getByRole("option", { name: /Giao Hàng Nhanh.*GHN/i }).click();
  await assignDialog.getByLabel("Mã vận đơn").fill("GHN-0002");
  await assignDialog.getByRole("button", { name: /^Lưu gán hãng$/i }).click();
  await expect(page.getByText(/Đã gán hãng vận chuyển/i)).toBeVisible();

  await page.getByRole("button", { name: /^Cập nhật trạng thái$/i }).click();
  const statusDialog = page.getByRole("dialog", {
    name: /Cập nhật trạng thái giao hàng/i,
  });
  await statusDialog.getByRole("combobox", { name: "Trạng thái" }).click();
  await page.getByRole("option", { name: "Đã nhận hàng" }).click();
  await statusDialog.getByRole("button", { name: /^Lưu trạng thái$/i }).click();
  await expect(
    page.getByText(/Đã cập nhật trạng thái giao hàng/i),
  ).toBeVisible();
});

test("manager creates a carrier but cannot change shipment operations", async ({
  page,
}) => {
  await seedWmsSession(page, ["MANAGER"], "Manager User");
  const carrier = {
    code: "GHN",
    contactInfo: { phone: "1900636677" },
    id: "carrier-1",
    name: "Giao Hàng Nhanh",
    status: "ACTIVE",
  };
  await page.route("**/api/wms/shipments**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ data: [] }),
    });
  });
  await page.route("**/api/wms/carriers**", async (route) => {
    const request = route.request();
    const created = request.method() === "POST";
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: created
          ? { ...carrier, code: "JNT", name: "J&T Express" }
          : [carrier],
      }),
    });
  });

  await page.goto("/shipping");
  await expect(
    page.getByRole("button", { name: /^Gán hãng và mã vận đơn$/i }),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: /^Hãng vận chuyển$/i }).click();
  await page.getByRole("button", { name: /^Thêm hãng vận chuyển$/i }).click();
  const carrierDialog = page.getByRole("dialog", {
    name: /^Thêm hãng vận chuyển$/i,
  });
  await carrierDialog.getByLabel("Tên hãng").fill("J&T Express");
  await carrierDialog.getByLabel("Mã hãng").fill("JNT");
  await carrierDialog.getByRole("button", { name: /^Tạo hãng$/i }).click();
  await expect(page.getByText(/Đã thêm hãng vận chuyển/i)).toBeVisible();
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
  await page.getByRole("tab", { name: /^Tạo SKU$/i }).click();
  const panel = page.getByRole("tabpanel", { name: /^Tạo SKU$/i });
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
