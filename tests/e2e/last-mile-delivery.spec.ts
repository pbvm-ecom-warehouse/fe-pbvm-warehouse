import { expect, test, type Page, type Route } from "@playwright/test";

type Role = "MANAGER" | "SHIPPER";

async function seedSession(page: Page, role: Role) {
  await page.addInitScript((role) => {
    window.localStorage.setItem(
      "wms-auth",
      JSON.stringify({
        state: {
          user: {
            id: `e2e-${role.toLowerCase()}`,
            name: `${role} User`,
            roles: [role],
            tenantId: "demo-tenant",
            type: "user",
          },
        },
        version: 2,
      }),
    );
  }, role);
}

function envelope(data: unknown, total?: number) {
  return JSON.stringify({
    data,
    meta: {
      pagination:
        typeof total === "number"
          ? { page: 1, pageSize: 20, total }
          : undefined,
      requestId: "last-mile-e2e",
    },
  });
}

function baseTrip(
  status:
    | "IN_TRANSIT"
    | "PAUSED"
    | "AWAITING_SETTLEMENT"
    | "COMPLETED" = "IN_TRANSIT",
) {
  return {
    assignedShipperId: "e2e-shipper",
    cashCollectedAmount: status === "AWAITING_SETTLEMENT" ? 320000 : 0,
    cashSettledAmount: 0,
    createdAt: "2026-07-30T01:00:00.000Z",
    id: "trip-1",
    startedAt: "2026-07-30T01:00:00.000Z",
    status,
    statusHistory: [],
    stops: [{ routeOrder: 1, shipmentId: "shipment-1" }],
    tripNumber: "TRIP-20260730-0001",
    updatedAt: "2026-07-30T01:00:00.000Z",
  };
}

function baseShipment(
  status: "IN_TRANSIT" | "DELIVERED" | "RETURNING" | "RETURNED" = "IN_TRANSIT",
) {
  return {
    activeTripId: "trip-1",
    assignedShipperId: "e2e-shipper",
    attempts: 0,
    codAmount: 320000,
    codCollectedAmount: status === "DELIVERED" ? 320000 : 0,
    codCollectionMethod: undefined as "CASH" | "ECOM_QR" | undefined,
    failReason: undefined as string | undefined,
    goodsIssueId: "issue-1",
    id: "shipment-1",
    orderCode: "ORD-20260730-0001",
    orderId: "order-1",
    packages: [
      {
        allocations: [{ itemId: "item-1", quantity: 12, sku: "CUP-500" }],
        barcode: "PKG-001",
        createdAt: "2026-07-30T00:00:00.000Z",
        createdBy: "e2e-shipper",
        loadedTripId: "trip-1",
        returnedAt: undefined as string | undefined,
        returnedBy: undefined as string | undefined,
      },
    ],
    paymentMethod: "COD",
    recipient: {
      address: { district: "Quận 7", line: "12 Nguyễn Văn Linh" },
      name: "Nguyễn An",
      phone: "0901000000",
    },
    shipmentNumber: "SHP-20260730-0001",
    shipmentStatus: status,
    statusHistory: [],
  };
}

async function fulfillEntityList(
  route: Route,
  entity: { id: string },
  resource: string,
) {
  const pathname = new URL(route.request().url()).pathname;
  const isDetail = pathname.endsWith(`/${resource}/${entity.id}`);
  await route.fulfill({
    body: envelope(isDetail ? entity : [entity], isDetail ? undefined : 1),
    contentType: "application/json",
  });
}

async function openTrip(page: Page) {
  await page.goto("/shipping");
  await page.getByRole("tab", { name: "Chuyến giao" }).click();
  await page.getByRole("button", { name: "Xem chi tiết" }).click();
  return page.getByRole("dialog", { name: "Chi tiết chuyến giao" });
}

test("shipper delivers with notification OTP, POD and CASH without OTP exposure", async ({
  page,
}) => {
  await seedSession(page, "SHIPPER");
  let trip = baseTrip();
  let shipment = baseShipment();
  let otpRequested = false;
  let deliverBody = "";

  await page.route("**/api/wms/shipments**", (route) =>
    fulfillEntityList(route, shipment, "shipments"),
  );
  await page.route("**/api/wms/delivery-trips**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (pathname.endsWith("/incidents") && request.method() === "GET") {
      await route.fulfill({
        body: envelope([]),
        contentType: "application/json",
      });
      return;
    }
    if (pathname.endsWith("/delivery-otp") && request.method() === "POST") {
      otpRequested = true;
      await route.fulfill({
        body: envelope({
          expiresAt: "2026-07-30T03:10:00.000Z",
          resendAvailableAt: "2026-07-30T03:01:00.000Z",
        }),
        contentType: "application/json",
      });
      return;
    }
    if (pathname.endsWith("/deliver") && request.method() === "POST") {
      deliverBody = request.postData() ?? "";
      shipment = {
        ...shipment,
        codCollectedAmount: 320000,
        codCollectionMethod: "CASH",
        shipmentStatus: "DELIVERED",
      };
      trip = {
        ...trip,
        cashCollectedAmount: 320000,
        status: "AWAITING_SETTLEMENT",
      };
      await route.fulfill({
        body: envelope(trip),
        contentType: "application/json",
      });
      return;
    }

    await fulfillEntityList(route, trip, "delivery-trips");
  });

  const tripDialog = await openTrip(page);
  await tripDialog.getByRole("button", { name: "Giao hàng" }).click();
  const deliveryDialog = page.getByRole("dialog", {
    name: "Xác nhận giao hàng",
  });
  await deliveryDialog.getByRole("button", { name: "Gửi OTP" }).click();
  await expect(
    page.getByText(/OTP đã được gửi qua kênh thông báo/i),
  ).toBeVisible();
  await deliveryDialog.getByLabel("OTP khách cung cấp").fill("123456");
  await deliveryDialog
    .getByRole("combobox", { name: "Phương thức thu COD" })
    .click();
  await page.getByRole("option", { name: "Tiền mặt" }).click();
  await deliveryDialog
    .getByLabel("Ảnh bằng chứng giao hàng (POD)")
    .setInputFiles({
      buffer: Buffer.from("pod"),
      mimeType: "image/png",
      name: "pod.png",
    });
  await deliveryDialog
    .getByRole("button", { name: "Xác nhận giao thành công" })
    .click();

  await expect(
    page.getByText(/Đã xác minh OTP, lưu POD và hoàn tất điểm giao/i),
  ).toBeVisible();
  await expect(tripDialog.getByText("Đã có POD")).toBeVisible();
  expect(otpRequested).toBe(true);
  expect(deliverBody).toContain('name="otp"');
  expect(deliverBody).toContain("123456");
  expect(deliverBody).toContain('name="codCollectionMethod"');
  expect(deliverBody).toContain("CASH");
  expect(deliverBody).toContain('name="images"');
  await expect(page.getByText(/response không trả OTP/i)).toHaveCount(0);
});

test("third failed attempt forces return scan and Receiver handoff", async ({
  page,
}) => {
  await seedSession(page, "SHIPPER");
  let trip = baseTrip();
  let shipment = { ...baseShipment(), attempts: 2 };
  let failedBody: unknown;
  let returnScanBody: unknown;
  let handoffCalled = false;

  await page.route("**/api/wms/shipments**", (route) =>
    fulfillEntityList(route, shipment, "shipments"),
  );
  await page.route("**/api/wms/delivery-trips**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (pathname.endsWith("/incidents") && request.method() === "GET") {
      await route.fulfill({
        body: envelope([]),
        contentType: "application/json",
      });
      return;
    }
    if (pathname.endsWith("/fail-attempt") && request.method() === "POST") {
      failedBody = request.postDataJSON();
      shipment = {
        ...shipment,
        attempts: 3,
        failReason: "Khách không nghe máy",
        shipmentStatus: "RETURNING",
      };
      await route.fulfill({
        body: envelope(trip),
        contentType: "application/json",
      });
      return;
    }
    if (
      pathname.endsWith("/return/packages/scan") &&
      request.method() === "POST"
    ) {
      returnScanBody = request.postDataJSON();
      shipment = {
        ...shipment,
        packages: shipment.packages.map((packageInfo) => ({
          ...packageInfo,
          returnedAt: "2026-07-30T04:00:00.000Z",
          returnedBy: "e2e-shipper",
        })),
      };
      await route.fulfill({
        body: envelope(trip),
        contentType: "application/json",
      });
      return;
    }
    if (pathname.endsWith("/return/handoff") && request.method() === "POST") {
      handoffCalled = true;
      shipment = { ...shipment, shipmentStatus: "RETURNED" };
      trip = { ...trip, status: "COMPLETED" };
      await route.fulfill({
        body: envelope(trip),
        contentType: "application/json",
      });
      return;
    }

    await fulfillEntityList(route, trip, "delivery-trips");
  });

  const tripDialog = await openTrip(page);
  await tripDialog.getByRole("button", { name: "Giao thất bại" }).click();
  const failedDialog = page.getByRole("dialog", {
    name: "Ghi nhận giao thất bại",
  });
  await expect(failedDialog.getByText(/lần 3\/3/i)).toBeVisible();
  await failedDialog.getByLabel("Lý do").fill("Khách không nghe máy");
  await failedDialog.getByRole("button", { name: "Ghi nhận lần giao" }).click();
  await expect(page.getByText(/chuyển sang hoàn về kho/i)).toBeVisible();

  await tripDialog.getByRole("button", { name: "Bàn giao hàng hoàn" }).click();
  const returnDialog = page.getByRole("dialog", {
    name: "Bàn giao hàng hoàn về kho",
  });
  await returnDialog.getByLabel("Barcode kiện hoàn").fill("PKG-001");
  await returnDialog.getByRole("button", { name: "Xác nhận kiện" }).click();
  await expect(page.getByText(/Đã xác nhận kiện hoàn/i)).toBeVisible();
  await expect(returnDialog.getByText(/Đã quét 1\/1 kiện hoàn/i)).toBeVisible();
  await returnDialog
    .getByRole("button", { name: "Bàn giao đủ kiện cho Receiver" })
    .click();
  await expect(
    page.getByText(/phiếu hoàn đã chuyển cho Receiver/i),
  ).toBeVisible();

  expect(failedBody).toEqual({ reason: "Khách không nghe máy" });
  expect(returnScanBody).toEqual({ barcode: "PKG-001" });
  expect(handoffCalled).toBe(true);
});

test("shipper reports an incident without unsupported images", async ({
  page,
}) => {
  await seedSession(page, "SHIPPER");
  let trip = baseTrip();
  const shipment = baseShipment();
  let reportBody: unknown;
  const incidents: Array<Record<string, unknown>> = [];

  await page.route("**/api/wms/shipments**", (route) =>
    fulfillEntityList(route, shipment, "shipments"),
  );
  await page.route("**/api/wms/delivery-trips**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith("/incidents") && request.method() === "POST") {
      reportBody = request.postDataJSON();
      const incident = {
        description: "Xe hỏng giữa đường",
        id: "incident-1",
        incidentNumber: "INC-20260730-0001",
        reportedAt: "2026-07-30T04:00:00.000Z",
        reportedBy: "e2e-shipper",
        status: "OPEN",
        tripId: "trip-1",
        type: "VEHICLE_BREAKDOWN",
      };
      incidents.push(incident);
      trip = { ...trip, status: "PAUSED" };
      await route.fulfill({
        body: envelope(incident),
        contentType: "application/json",
      });
      return;
    }
    if (pathname.endsWith("/incidents") && request.method() === "GET") {
      await route.fulfill({
        body: envelope(incidents),
        contentType: "application/json",
      });
      return;
    }
    await fulfillEntityList(route, trip, "delivery-trips");
  });

  const tripDialog = await openTrip(page);
  await tripDialog.getByRole("button", { name: "Báo sự cố" }).click();
  const incidentDialog = page.getByRole("dialog", {
    name: "Báo sự cố chuyến giao",
  });
  await expect(incidentDialog.locator('input[type="file"]')).toHaveCount(0);
  await incidentDialog.getByLabel("Mô tả").fill("Xe hỏng giữa đường");
  await incidentDialog
    .getByRole("button", { name: "Báo sự cố và tạm dừng" })
    .click();

  await expect(page.getByText(/Đã báo sự cố và tạm dừng/i)).toBeVisible();
  await expect(tripDialog.getByText("INC-20260730-0001")).toBeVisible();
  expect(reportBody).toEqual({
    description: "Xe hỏng giữa đường",
    type: "VEHICLE_BREAKDOWN",
  });
});

test("manager resolves rescue and settles the exact collected cash", async ({
  page,
}) => {
  await seedSession(page, "MANAGER");
  let trip = baseTrip("PAUSED");
  const shipment = baseShipment();
  let incident = {
    description: "Xe hỏng giữa đường",
    id: "incident-1",
    incidentNumber: "INC-20260730-0001",
    reportedAt: "2026-07-30T04:00:00.000Z",
    reportedBy: "e2e-shipper",
    status: "OPEN",
    tripId: "trip-1",
    type: "VEHICLE_BREAKDOWN",
  };
  let resolveBody: unknown;

  await page.route("**/api/wms/users**", async (route) => {
    await route.fulfill({
      body: envelope(
        [
          {
            id: "e2e-shipper",
            mustChangePassword: false,
            name: "Shipper hiện tại",
            role: "SHIPPER",
            status: "ACTIVE",
            username: "shipper-current",
          },
          {
            id: "shipper-rescue",
            mustChangePassword: false,
            name: "Shipper cứu hộ",
            role: "SHIPPER",
            status: "ACTIVE",
            username: "shipper-rescue",
          },
        ],
        2,
      ),
      contentType: "application/json",
    });
  });
  await page.route("**/api/wms/shipments**", (route) =>
    fulfillEntityList(route, shipment, "shipments"),
  );
  await page.route("**/api/wms/delivery-trips**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (
      pathname.endsWith("/incidents/incident-1/resolve") &&
      request.method() === "PATCH"
    ) {
      resolveBody = request.postDataJSON();
      incident = {
        ...incident,
        status: "RESOLVED",
      };
      trip = { ...trip, assignedShipperId: "shipper-rescue" };
      await route.fulfill({
        body: envelope(incident),
        contentType: "application/json",
      });
      return;
    }
    if (pathname.endsWith("/incidents") && request.method() === "GET") {
      await route.fulfill({
        body: envelope([incident]),
        contentType: "application/json",
      });
      return;
    }
    await fulfillEntityList(route, trip, "delivery-trips");
  });

  const tripDialog = await openTrip(page);
  await tripDialog.getByRole("button", { name: "Xử lý sự cố" }).click();
  const resolveDialog = page.getByRole("dialog", { name: "Xử lý sự cố" });
  await resolveDialog
    .getByRole("combobox", { name: "Phương án xử lý" })
    .click();
  await page.getByRole("option", { name: "Điều Shipper cứu hộ" }).click();
  await resolveDialog.getByRole("combobox", { name: "Shipper cứu hộ" }).click();
  await page.getByRole("option", { name: "Shipper cứu hộ" }).click();
  await resolveDialog.getByLabel("Ghi chú").fill("Đổi người giao");
  await resolveDialog.getByRole("button", { name: "Xác nhận xử lý" }).click();
  await expect(page.getByText(/Đã xử lý sự cố/i)).toBeVisible();
  expect(resolveBody).toEqual({
    action: "RESCUE",
    note: "Đổi người giao",
    rescueShipperId: "shipper-rescue",
  });

  await tripDialog.getByRole("button", { name: "Đóng" }).click();
  trip = {
    ...baseTrip("AWAITING_SETTLEMENT"),
    assignedShipperId: "shipper-rescue",
  };
  let settlementBody: unknown;
  await page.unroute("**/api/wms/delivery-trips**");
  await page.route("**/api/wms/delivery-trips**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith("/settle-cash") && request.method() === "POST") {
      settlementBody = request.postDataJSON();
      trip = {
        ...trip,
        cashSettledAmount: 320000,
        status: "COMPLETED",
      };
      await route.fulfill({
        body: envelope(trip),
        contentType: "application/json",
      });
      return;
    }
    if (pathname.endsWith("/incidents")) {
      await route.fulfill({
        body: envelope([]),
        contentType: "application/json",
      });
      return;
    }
    await fulfillEntityList(route, trip, "delivery-trips");
  });
  await page.getByRole("button", { name: "Làm mới" }).click();
  await page.getByRole("button", { name: "Xem chi tiết" }).click();
  const settlementDialog = page.getByRole("dialog", {
    name: "Chi tiết chuyến giao",
  });
  await settlementDialog.getByLabel("Số tiền nhận bàn giao").fill("320000");
  await settlementDialog
    .getByRole("button", { name: "Xác nhận đối soát" })
    .click();
  await expect(page.getByText(/Đã đối soát đủ tiền mặt/i)).toBeVisible();
  expect(settlementBody).toEqual({ amount: 320000 });
});
