import { expect, test, type Page, type Route } from "@playwright/test";

async function seedAdminSession(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "wms-auth",
      JSON.stringify({
        state: {
          user: {
            id: "e2e-admin",
            name: "Admin E2E",
            roles: ["ADMIN"],
            tenantId: "demo-tenant",
            type: "user",
          },
        },
        version: 2,
      }),
    );
  });
}

function envelope(data: unknown, total?: number) {
  return JSON.stringify({
    data,
    meta: {
      pagination:
        typeof total === "number"
          ? { page: 1, pageSize: 20, total }
          : undefined,
      requestId: "operations-dialog-e2e",
    },
  });
}

async function fulfillEntity(route: Route, entity: { id: string }) {
  const isDetail = new URL(route.request().url()).pathname.endsWith(
    `/${entity.id}`,
  );
  await route.fulfill({
    body: envelope(isDetail ? entity : [entity], isDetail ? undefined : 1),
    contentType: "application/json",
  });
}

async function mockOperationsApi(page: Page) {
  const goodsIssue = {
    goodsIssueNumber: "GI-20260730-0001",
    id: "goods-issue-internal-1",
    orderCode: "ORD-20260730-0001",
    orderId: "order-internal-1",
    status: "PENDING",
    items: [
      {
        itemId: "goods-issue-item-1",
        packageCount: 2,
        quantity: 24,
        remainingQty: 24,
        sku: "CUP-BLANK-500",
        unit: "cái",
      },
    ],
  };
  const shipment = {
    attempts: 0,
    codAmount: 0,
    goodsIssueId: goodsIssue.id,
    id: "shipment-internal-1",
    orderCode: goodsIssue.orderCode,
    orderId: goodsIssue.orderId,
    paymentMethod: "ONLINE",
    recipient: {
      address: { line: "12 Nguyễn Văn Linh" },
      name: "Nguyễn An",
      phone: "0901000000",
    },
    shipmentStatus: "PENDING",
    shipmentNumber: "SHP-20260730-0001",
    statusHistory: [],
  };
  const goodsReturn = {
    createdAt: "2026-07-30T00:00:00.000Z",
    createdBy: "receiver-1",
    goodsReturnNumber: "RET-20260730-0001",
    id: "goods-return-internal-1",
    items: [
      {
        condition: null,
        images: [],
        itemId: "return-item-1",
        lotId: null,
        quantity: 1,
        scrapNoteId: null,
        shelfId: null,
        sku: "CUP-BLANK-500",
      },
    ],
    orderCode: goodsIssue.orderCode,
    orderId: goodsIssue.orderId,
    status: "DRAFT",
    updatedAt: "2026-07-30T00:00:00.000Z",
  };
  const stockCount = {
    createdAt: "2026-07-30T00:00:00.000Z",
    createdBy: "manager-1",
    id: "stock-count-internal-1",
    items: [
      {
        actualQty: 10,
        delta: 0,
        images: [],
        itemId: "stock-count-item-1",
        lotId: null,
        reason: null,
        shelfId: "SHELF-A-01",
        sku: "CUP-BLANK-500",
        systemQty: 10,
      },
    ],
    status: "COMPLETED",
    stockCountNumber: "SC-20260730-0001",
    updatedAt: "2026-07-30T00:00:00.000Z",
    zoneId: null,
  };
  const scrapNote = {
    createdAt: "2026-07-30T00:00:00.000Z",
    createdBy: "counter-1",
    id: "scrap-note-internal-1",
    items: [
      {
        images: [],
        itemId: "stock-count-item-1",
        lotId: null,
        quantity: 2,
        reason: "Hư hỏng",
        shelfId: "SHELF-A-01",
        sku: "CUP-BLANK-500",
      },
    ],
    scrapNoteNumber: "SCR-20260730-0001",
    sourceStockCountId: stockCount.id,
    status: "DRAFT",
    updatedAt: "2026-07-30T00:00:00.000Z",
  };
  const printJob = {
    createdAt: "2026-07-30T00:00:00.000Z",
    id: "print-job-internal-1",
    items: [
      {
        inputItemId: "blank-item-1",
        lineStatus: "PENDING",
        outputItemId: "printed-item-1",
        quantity: 10,
        remainingQty: 10,
        reservedQty: 10,
        sku: "CUP-BLANK-500",
      },
    ],
    orderCode: goodsIssue.orderCode,
    orderId: goodsIssue.orderId,
    printJobNumber: "PRN-20260730-0001",
    status: "PENDING",
    updatedAt: "2026-07-30T00:00:00.000Z",
  };

  await page.route("**/api/wms/goods-issues**", (route) =>
    fulfillEntity(route, goodsIssue),
  );
  await page.route("**/api/wms/shipments**", (route) =>
    fulfillEntity(route, shipment),
  );
  await page.route("**/api/wms/goods-returns**", (route) =>
    fulfillEntity(route, goodsReturn),
  );
  await page.route("**/api/wms/stock-counts**", (route) =>
    fulfillEntity(route, stockCount),
  );
  await page.route("**/api/wms/scrap-notes**", (route) =>
    fulfillEntity(route, scrapNote),
  );
  await page.route("**/api/wms/print-jobs**", (route) =>
    fulfillEntity(route, printJob),
  );
}

const screens = [
  {
    businessCodes: ["GI-20260730-0001", "ORD-20260730-0001"],
    dialogName: "Chi tiết phiếu xuất kho",
    internalIds: ["goods-issue-internal-1", "order-internal-1"],
    path: "/goods-issues",
  },
  {
    businessCodes: ["SHP-20260730-0001", "ORD-20260730-0001"],
    dialogName: "Chi tiết vận đơn",
    internalIds: ["shipment-internal-1", "order-internal-1"],
    path: "/shipping",
  },
  {
    businessCodes: ["RET-20260730-0001", "ORD-20260730-0001"],
    dialogName: "Chi tiết phiếu hoàn hàng",
    internalIds: ["goods-return-internal-1", "order-internal-1"],
    path: "/goods-returns",
  },
  {
    businessCodes: ["SC-20260730-0001"],
    dialogName: "Chi tiết phiếu kiểm kho",
    internalIds: ["stock-count-internal-1"],
    path: "/adjustments",
  },
  {
    businessCodes: ["SCR-20260730-0001", "SC-20260730-0001"],
    dialogName: "Chi tiết phiếu hủy hàng",
    internalIds: ["scrap-note-internal-1", "stock-count-internal-1"],
    path: "/adjustments",
    tabName: "Phiếu hủy",
  },
  {
    businessCodes: ["PRN-20260730-0001", "ORD-20260730-0001"],
    dialogName: "Chi tiết đơn in ly",
    internalIds: ["print-job-internal-1", "order-internal-1"],
    path: "/print-jobs",
  },
] as const;

for (const viewport of [
  { height: 844, width: 390 },
  { height: 1024, width: 768 },
  { height: 900, width: 1440 },
]) {
  test(`operation detail dialogs fit ${viewport.width}px viewport and reset on close`, async ({
    page,
  }, testInfo) => {
    await seedAdminSession(page);
    await mockOperationsApi(page);
    await page.setViewportSize(viewport);

    for (const screen of screens) {
      await page.goto(screen.path);
      if ("tabName" in screen) {
        await page.getByRole("tab", { name: screen.tabName }).click();
      }
      for (const code of screen.businessCodes.slice(0, 1)) {
        await expect(
          page.getByText(code, { exact: false }).first(),
        ).toBeVisible();
      }
      for (const internalId of screen.internalIds) {
        await expect(page.getByText(internalId, { exact: false })).toHaveCount(
          0,
        );
      }
      const trigger = page
        .getByRole("button", { name: "Xem chi tiết" })
        .first();
      await expect(trigger).toBeVisible();
      await trigger.click();

      const dialog = page.getByRole("dialog", { name: screen.dialogName });
      await expect(dialog).toBeVisible();
      for (const code of screen.businessCodes) {
        await expect(
          dialog.getByText(code, { exact: false }).first(),
        ).toBeVisible();
      }
      for (const internalId of screen.internalIds) {
        await expect(
          dialog.getByText(internalId, { exact: false }),
        ).toHaveCount(0);
      }
      const dialogBox = await dialog.boundingBox();
      expect(dialogBox).not.toBeNull();
      expect(dialogBox!.height).toBeLessThanOrEqual(viewport.height);
      expect(dialogBox!.width).toBeLessThanOrEqual(viewport.width);
      await expect(
        dialog.locator('[data-slot="entity-detail-body"]'),
      ).toHaveCSS("overflow-y", "auto");

      if (viewport.width === 1440 || screen.path === "/goods-issues") {
        await page.screenshot({
          fullPage: true,
          path: testInfo.outputPath(
            `${screen.path.slice(1)}-${viewport.width}.png`,
          ),
        });
      }

      await dialog.getByRole("button", { name: "Đóng" }).click();
      await expect(dialog).toBeHidden();
      await expect(trigger).toBeFocused();
    }
  });
}
