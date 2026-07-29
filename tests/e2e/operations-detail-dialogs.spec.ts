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
    id: "goods-issue-internal-1",
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
    orderId: goodsIssue.orderId,
    paymentMethod: "ONLINE",
    recipient: {
      address: { line: "12 Nguyễn Văn Linh" },
      name: "Nguyễn An",
      phone: "0901000000",
    },
    shipmentStatus: "PENDING",
    statusHistory: [],
  };
  const goodsReturn = {
    createdAt: "2026-07-30T00:00:00.000Z",
    createdBy: "receiver-1",
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
    updatedAt: "2026-07-30T00:00:00.000Z",
    zoneId: null,
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
    orderId: goodsIssue.orderId,
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
  await page.route("**/api/wms/scrap-notes**", async (route) => {
    await route.fulfill({
      body: envelope([], 0),
      contentType: "application/json",
    });
  });
  await page.route("**/api/wms/print-jobs**", (route) =>
    fulfillEntity(route, printJob),
  );
}

const screens = [
  {
    dialogName: "Chi tiết phiếu xuất kho",
    path: "/goods-issues",
  },
  {
    dialogName: "Chi tiết vận đơn",
    path: "/shipping",
  },
  {
    dialogName: "Chi tiết phiếu hoàn hàng",
    path: "/goods-returns",
  },
  {
    dialogName: "Chi tiết phiếu kiểm kho",
    path: "/adjustments",
  },
  {
    dialogName: "Chi tiết đơn in ly",
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
      const trigger = page
        .getByRole("button", { name: "Xem chi tiết" })
        .first();
      await expect(trigger).toBeVisible();
      await trigger.click();

      const dialog = page.getByRole("dialog", { name: screen.dialogName });
      await expect(dialog).toBeVisible();
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
