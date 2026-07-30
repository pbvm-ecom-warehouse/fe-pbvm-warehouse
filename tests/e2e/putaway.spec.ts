import { expect, test, type Page } from "@playwright/test";

async function seedReceiver(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "wms-auth",
      JSON.stringify({
        state: {
          user: {
            id: "e2e-receiver",
            name: "Receiver User",
            roles: ["RECEIVER"],
            tenantId: "demo-tenant",
            type: "user",
          },
        },
        version: 2,
      }),
    );
  });
}

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

const task = {
  id: "task-1",
  grnId: "grn-1",
  status: "PENDING",
  items: [
    {
      itemId: "item-1",
      sku: "SKU-CAFE",
      quantity: 8,
      remainingQty: 5,
      lotId: "lot-1",
      lotNumber: "LOT-260728-001",
      packageSpec: {
        unit: "box",
        factor: 1,
        depthCm: 30,
        widthCm: 20,
        heightCm: 10,
        volumeCm3: 6000,
      },
    },
  ],
};

const receipt = {
  id: "grn-1",
  grnNumber: "GRN-001",
  purchaseOrderId: "po-1",
  status: "APPROVED",
  createdAt: "2026-07-28T00:00:00.000Z",
  updatedAt: "2026-07-28T00:00:00.000Z",
  items: [
    {
      itemId: "item-1",
      sku: "SKU-CAFE",
      itemName: "Cà phê rang",
      barcode: "8930001",
      type: "DRY",
      actualQty: 8,
      lotNumber: "LOT-260728-001",
      manufacturedDate: "2026-07-28",
      expiryDate: "2027-07-28",
      itemDepth: 30,
      itemWidth: 20,
      itemHeight: 10,
    },
  ],
};

function storageCell(id: string, code: string, bay: number) {
  return {
    id,
    rackId: "rack-1",
    shelfId: "shelf-1",
    level: 1,
    bay,
    code,
    barcode: code,
    status: "ACTIVE",
    innerDepth: 100,
    innerWidth: 80,
    innerHeight: 60,
    usableVolumeCm3: 480000,
    occupiedVolumeCm3: 0,
    fillPercent: 0,
    contents: [],
  };
}

test("receiver follows the 2D route and can put away into a compatible empty override cell", async ({
  page,
}) => {
  await seedReceiver(page);
  let confirmBody: Record<string, unknown> | undefined;

  await page.route("**/api/wms/putaway-tasks**", async (route) => {
    if (route.request().method() === "POST") {
      confirmBody = route.request().postDataJSON();
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: { ...task, status: "COMPLETED" },
          meta: { requestId: "putaway-confirm" },
        }),
      });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ data: [task], page: 1, limit: 100, total: 1 }),
    });
  });
  await page.route("**/api/wms/goods-receipt-notes/grn-1**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: receipt,
        meta: { requestId: "grn-detail" },
      }),
    });
  });
  await page.route("**/api/wms/putaway/suggestions**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          suggestions: [
            {
              shelfCode: "R01-T1",
              capacity: 80,
              cellId: "cell-1",
              cellCode: "R01-T1-B1",
              rackId: "rack-1",
              level: 1,
              bay: 1,
              fillPercent: 0,
              reason: "BEST_FIT_VOLUME",
              path,
            },
          ],
        },
        meta: { requestId: "putaway-suggestions" },
      }),
    });
  });
  await page.route("**/api/wms/location/layout**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          id: "single-warehouse-layout",
          revision: 1,
          updatedAt: "2026-07-28T00:00:00.000Z",
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
        meta: { requestId: "layout" },
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
            storageCell("cell-1", "R01-T1-B1", 1),
            storageCell("cell-2", "R01-T1-B2", 2),
          ],
          meta: { requestId: "rack-cells" },
        }),
      });
    },
  );

  await page.goto("/putaway-tasks");
  await expect(page.getByRole("heading", { name: "Cất hàng" })).toBeVisible();
  await expect(page.getByText("SKU-CAFE").first()).toBeVisible();
  await page.getByRole("button", { name: "Mở bản đồ" }).click();
  await expect(page.getByText("Hướng dẫn cất hàng")).toBeVisible();
  await page.getByRole("button", { name: /R01-T1-B1/i }).click();
  const openMapButton = page.getByRole("button", { name: "Mở bản đồ kho" });
  await expect(openMapButton).toBeEnabled();
  await openMapButton.click();

  const mapDialog = page.getByRole("dialog", {
    name: "Bản đồ đường đi trong kho",
  });
  await mapDialog.getByRole("button", { name: "Xem mặt kệ R01" }).click();

  const rackDialog = page.getByRole("dialog", { name: "Mặt kệ R01" });
  await expect(rackDialog.getByRole("button", { name: "2D" })).toBeVisible();
  await expect(rackDialog.getByText("R01-T1-B1").first()).toBeVisible();
  await rackDialog.getByRole("button", { name: /R01-T1-B2/i }).click();
  await expect(rackDialog.getByText("Trống · có thể cất").last()).toBeVisible();
  await rackDialog
    .getByRole("button", { name: "Chọn khoang và quét mã" })
    .click();
  const scanner = page.getByRole("dialog", { name: "Quét xác nhận vị trí" });
  await scanner.getByLabel("Mã vạch mặt hàng").fill("8930001");
  await expect(scanner.getByLabel("Mã khoang")).toHaveValue("R01-T1-B2");
  await scanner.getByLabel("Số thùng nguyên").fill("2");
  await scanner.getByRole("button", { name: "Xác nhận cất hàng" }).click();

  await expect(page.getByText("Đã lưu thùng hàng vào khoang.")).toBeVisible();
  expect(confirmBody).toMatchObject({
    itemBarcode: "8930001",
    cellBarcode: "R01-T1-B2",
    quantity: 2,
    lotId: "lot-1",
    suggestedCellId: "cell-1",
  });
});
test("receiver creates a receipt line with LOT-YYMMDD-SEQ", async ({
  page,
}) => {
  await seedReceiver(page);
  let createBody = "";
  const receivingOrder = {
    id: "po-1",
    poNumber: "PO-001",
    supplierName: "Công ty Minh Long",
    items: [
      {
        itemId: "item-1",
        itemName: "Cà phê rang",
        sku: "SKU-CAFE",
        unit: "thùng",
        expectedQty: 10,
        receivedQty: 0,
        remainingQty: 10,
        itemDepth: 30,
        itemWidth: 20,
        itemHeight: 10,
      },
    ],
  };

  await page.route("**/api/wms/goods-receipt-notes**", async (route) => {
    if (route.request().method() === "POST") {
      createBody = route.request().postData() ?? "";
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            id: "grn-created",
            grnNumber: "GRN-001",
            purchaseOrderId: "po-1",
            status: "DRAFT",
            items: [],
            createdAt: "2026-07-28T00:00:00.000Z",
            updatedAt: "2026-07-28T00:00:00.000Z",
          },
          meta: { requestId: "create-grn" },
        }),
      });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: [],
        page: 1,
        limit: 100,
        total: 0,
        meta: { requestId: "grn-list" },
      }),
    });
  });
  await page.route("**/api/wms/purchase-orders/receiving**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: { data: [receivingOrder], page: 1, limit: 100, total: 1 },
        meta: { requestId: "receiving-orders" },
      }),
    });
  });
  await page.route("**/api/wms/stock/items/item-1**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          id: "item-1",
          sku: "SKU-CAFE",
          name: "Cà phê rang",
          type: "DRY",
          unit: "thùng",
          isActive: true,
          isPerishable: false,
          createdAt: "2026-07-01T00:00:00.000Z",
          updatedAt: "2026-07-28T00:00:00.000Z",
        },
        meta: { requestId: "item-detail" },
      }),
    });
  });

  await page.goto("/goods-receipt-notes");
  await page.getByRole("button", { name: "Tạo phiếu nhập" }).click();
  const dialog = page.getByRole("dialog", { name: "Tạo phiếu nhập" });
  await dialog.getByRole("combobox", { name: "Đơn mua" }).click();
  await page.getByRole("option", { name: /PO-001/i }).click();
  await dialog.getByLabel("Ngày sản xuất phiếu nhập dòng 1").fill("2026-07-28");
  await dialog.getByLabel("SEQ số lô phiếu nhập dòng 1").fill("7");
  await expect(dialog.getByLabel("Mã lô phiếu nhập dòng 1")).toHaveValue(
    "LOT-260728-007",
  );
  await expect(dialog.getByLabel("Mã lô phiếu nhập dòng 1")).toHaveAttribute(
    "readonly",
  );
  await dialog.getByLabel("Ảnh minh chứng cho PO-001").setInputFiles({
    buffer: Buffer.from("receipt-evidence"),
    mimeType: "image/webp",
    name: "receipt.webp",
  });
  await dialog.getByRole("button", { name: "Tạo phiếu nhập" }).click();

  await expect(page.getByText("Đã tạo phiếu nhập")).toBeVisible();
  expect(createBody).toContain('name="purchaseOrderId"');
  expect(createBody).toContain("po-1");
  expect(createBody).toContain('"itemId":"item-1"');
  expect(createBody).toContain('"actualQty":10');
  expect(createBody).toContain('"lotNumber":"LOT-260728-007"');
  expect(createBody).toContain('filename="receipt.webp"');
});
