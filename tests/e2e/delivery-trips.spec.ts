import { expect, test, type Page, type Route } from "@playwright/test";

async function seedSession(
  page: Page,
  role: "MANAGER" | "SHIPPER",
  name: string,
) {
  await page.addInitScript(
    ({ name, role }) => {
      window.localStorage.setItem(
        "wms-auth",
        JSON.stringify({
          state: {
            user: {
              id: `e2e-${role.toLowerCase()}`,
              name,
              roles: [role],
              tenantId: "demo-tenant",
              type: "user",
            },
          },
          version: 2,
        }),
      );
    },
    { name, role },
  );
}

function envelope(data: unknown, total?: number) {
  return JSON.stringify({
    data,
    meta: {
      pagination:
        typeof total === "number"
          ? { page: 1, pageSize: 20, total }
          : undefined,
      requestId: "delivery-trip-e2e",
    },
  });
}

function shipment(
  id: string,
  orderCode: string,
  packageBarcode: string,
  loadedTripId?: string,
  activeTripId?: string,
) {
  return {
    activeTripId,
    assignedShipperId: "e2e-shipper",
    attempts: 0,
    codAmount: 0,
    goodsIssueId: `issue-${id}`,
    id,
    orderCode,
    orderId: `order-${id}`,
    packages: [
      {
        allocations: [{ itemId: "item-1", quantity: 12, sku: "CUP-500" }],
        barcode: packageBarcode,
        createdAt: "2026-07-30T00:00:00.000Z",
        createdBy: "e2e-shipper",
        loadedTripId,
      },
    ],
    paymentMethod: "ONLINE",
    recipient: {
      address: {
        district: id === "shipment-1" ? "Quận 7" : "Quận 1",
        line: id === "shipment-1" ? "12 Nguyễn Văn Linh" : "21 Lê Lợi",
      },
      name: `Khách ${id}`,
      phone: "0901000000",
    },
    shipmentNumber:
      id === "shipment-1" ? "SHP-20260730-0001" : "SHP-20260730-0002",
    shipmentStatus: "READY",
    statusHistory: [],
  };
}

async function fulfillShipmentRoute(
  route: Route,
  rows: ReturnType<typeof shipment>[],
) {
  const pathname = new URL(route.request().url()).pathname;
  const detail = rows.find((row) => pathname.endsWith(`/${row.id}`));
  await route.fulfill({
    body: envelope(detail ?? rows, detail ? undefined : rows.length),
    contentType: "application/json",
  });
}

test("manager creates, reorders, optimizes and confirms a delivery trip", async ({
  page,
}) => {
  await seedSession(page, "MANAGER", "Manager User");
  const shipments = [
    shipment("shipment-1", "ORD-001", "PKG-001"),
    shipment("shipment-2", "ORD-002", "PKG-002"),
  ];
  let createBody: unknown;
  let routeBody: unknown;
  let optimizeCalled = false;
  let readyCalled = false;
  let trip:
    | {
        assignedShipperId: string;
        cashCollectedAmount: number;
        cashSettledAmount: number;
        createdAt: string;
        id: string;
        status: "DRAFT" | "READY";
        statusHistory: unknown[];
        stops: Array<{ routeOrder: number; shipmentId: string }>;
        tripNumber: string;
        updatedAt: string;
      }
    | undefined;

  await page.route("**/api/wms/users**", async (route) => {
    await route.fulfill({
      body: envelope(
        [
          {
            id: "e2e-shipper",
            mustChangePassword: false,
            name: "Shipper User",
            role: "SHIPPER",
            status: "ACTIVE",
            username: "shipper",
          },
        ],
        1,
      ),
      contentType: "application/json",
    });
  });
  await page.route("**/api/wms/shipments**", (route) =>
    fulfillShipmentRoute(route, shipments),
  );
  await page.route("**/api/wms/delivery-trips**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (request.method() === "POST" && pathname.endsWith("/delivery-trips")) {
      createBody = request.postDataJSON();
      trip = {
        assignedShipperId: "e2e-shipper",
        cashCollectedAmount: 0,
        cashSettledAmount: 0,
        createdAt: "2026-07-30T01:00:00.000Z",
        id: "trip-1",
        status: "DRAFT",
        statusHistory: [],
        stops: [
          { routeOrder: 1, shipmentId: "shipment-1" },
          { routeOrder: 2, shipmentId: "shipment-2" },
        ],
        tripNumber: "TRIP-20260730-0001",
        updatedAt: "2026-07-30T01:00:00.000Z",
      };
      await route.fulfill({
        body: envelope(trip),
        contentType: "application/json",
      });
      return;
    }

    if (request.method() === "PATCH" && pathname.endsWith("/route")) {
      routeBody = request.postDataJSON();
      const ids = (routeBody as { shipmentIds: string[] }).shipmentIds;
      trip!.stops = ids.map((shipmentId, index) => ({
        routeOrder: index + 1,
        shipmentId,
      }));
      await route.fulfill({
        body: envelope(trip),
        contentType: "application/json",
      });
      return;
    }

    if (request.method() === "POST" && pathname.endsWith("/route/optimize")) {
      optimizeCalled = true;
      await route.fulfill({
        body: envelope(trip),
        contentType: "application/json",
      });
      return;
    }

    if (request.method() === "POST" && pathname.endsWith("/ready")) {
      readyCalled = true;
      trip!.status = "READY";
      await route.fulfill({
        body: envelope(trip),
        contentType: "application/json",
      });
      return;
    }

    const isDetail = pathname.endsWith("/trip-1");
    await route.fulfill({
      body: envelope(isDetail ? trip : trip ? [trip] : [], trip ? 1 : 0),
      contentType: "application/json",
    });
  });

  await page.goto("/shipping");
  await page.getByRole("tab", { name: "Chuyến giao" }).click();
  await page.getByRole("button", { name: "Tạo chuyến giao" }).click();
  const createDialog = page.getByRole("dialog", { name: "Tạo chuyến giao" });
  await createDialog
    .getByRole("combobox", { name: "Shipper phụ trách" })
    .click();
  await page.getByRole("option", { name: "Shipper User" }).click();
  await createDialog.getByLabel("Chọn SHP-20260730-0001").click();
  await createDialog.getByLabel("Chọn SHP-20260730-0002").click();
  await createDialog
    .getByRole("button", { name: /Tạo chuyến \(2 điểm\)/ })
    .click();

  await expect(page.getByText(/Đã tạo chuyến giao/i)).toBeVisible();
  expect(createBody).toEqual({
    assignedShipperId: "e2e-shipper",
    shipmentIds: ["shipment-1", "shipment-2"],
  });

  const tripDialog = page.getByRole("dialog", {
    name: "Chi tiết chuyến giao",
  });
  await tripDialog.getByLabel("Đưa điểm 1 xuống").click();
  await expect(page.getByText(/Đã lưu thứ tự điểm giao/i)).toBeVisible();
  expect(routeBody).toEqual({
    shipmentIds: ["shipment-2", "shipment-1"],
  });

  await tripDialog.getByRole("button", { name: "Tối ưu lộ trình" }).click();
  await expect(page.getByText(/Đã tối ưu lộ trình/i)).toBeVisible();
  await tripDialog.getByRole("button", { name: "Chốt chuyến" }).click();
  await expect(page.getByText(/Shipper có thể quét kiện/i)).toBeVisible();
  expect(optimizeCalled).toBe(true);
  expect(readyCalled).toBe(true);
});

test("shipper must scan every package before starting the owned trip", async ({
  page,
}) => {
  await seedSession(page, "SHIPPER", "Shipper User");
  await page.setViewportSize({ width: 390, height: 844 });
  let loadedTripId: string | undefined;
  let scanBody: unknown;
  let startCalled = false;
  let tripStatus: "READY" | "LOADING" | "IN_TRANSIT" = "READY";
  const trip = () => ({
    assignedShipperId: "e2e-shipper",
    cashCollectedAmount: 0,
    cashSettledAmount: 0,
    createdAt: "2026-07-30T01:00:00.000Z",
    id: "trip-1",
    status: tripStatus,
    statusHistory: [],
    stops: [{ routeOrder: 1, shipmentId: "shipment-1" }],
    tripNumber: "TRIP-20260730-0001",
    updatedAt: "2026-07-30T01:00:00.000Z",
  });

  await page.route("**/api/wms/shipments**", (route) =>
    fulfillShipmentRoute(route, [
      shipment("shipment-1", "ORD-001", "PKG-001", loadedTripId, "trip-1"),
    ]),
  );
  await page.route("**/api/wms/delivery-trips**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (request.method() === "POST" && pathname.endsWith("/packages/scan")) {
      scanBody = request.postDataJSON();
      loadedTripId = "trip-1";
      tripStatus = "LOADING";
      await route.fulfill({
        body: envelope(trip()),
        contentType: "application/json",
      });
      return;
    }

    if (request.method() === "POST" && pathname.endsWith("/start")) {
      startCalled = true;
      tripStatus = "IN_TRANSIT";
      await route.fulfill({
        body: envelope(trip()),
        contentType: "application/json",
      });
      return;
    }

    await route.fulfill({
      body: envelope(pathname.endsWith("/trip-1") ? trip() : [trip()], 1),
      contentType: "application/json",
    });
  });

  await page.goto("/shipping");
  await page.getByRole("tab", { name: "Chuyến giao" }).click();
  await expect(
    page.getByRole("button", { name: "Tạo chuyến giao" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Xem chi tiết" }).click();
  const tripDialog = page.getByRole("dialog", {
    name: "Chi tiết chuyến giao",
  });
  const startButton = tripDialog.getByRole("button", {
    name: "Bắt đầu chuyến giao",
  });
  await expect(startButton).toBeDisabled();
  await expect(tripDialog.getByText("0/1 kiện đã quét")).toBeVisible();
  await tripDialog.getByLabel("Barcode kiện hàng").fill("PKG-001");
  await tripDialog.getByRole("button", { name: "Xác nhận kiện" }).click();
  await expect(
    page.getByText(/Đã quét và chất kiện đúng chuyến/i),
  ).toBeVisible();
  await expect(tripDialog.getByText("1/1 kiện đã quét")).toBeVisible();
  await expect(startButton).toBeEnabled();
  await startButton.click();
  await expect(page.getByText(/Đã bắt đầu chuyến giao/i)).toBeVisible();

  expect(scanBody).toEqual({ barcode: "PKG-001" });
  expect(startCalled).toBe(true);
  const box = await tripDialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
});
