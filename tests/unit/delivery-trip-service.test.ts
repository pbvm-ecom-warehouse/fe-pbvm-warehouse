import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api-client";
import {
  createDeliveryTrip,
  completeReturnHandoff,
  deliverTripShipment,
  getDeliveryTrip,
  listDeliveryIncidents,
  listDeliveryTrips,
  markDeliveryTripReady,
  normalizeDeliveryTripListResponse,
  optimizeDeliveryTripRoute,
  recordFailedDeliveryAttempt,
  reportDeliveryIncident,
  requestDeliveryOtp,
  resolveDeliveryIncident,
  scanReturnPackage,
  scanDeliveryTripPackage,
  settleDeliveryTripCash,
  startDeliveryTrip,
  updateDeliveryTripRoute,
} from "@/features/shipping/services/delivery-trip.service";

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
  },
}));

const mockedGet = vi.mocked(apiClient.get);
const mockedPatch = vi.mocked(apiClient.patch);
const mockedPost = vi.mocked(apiClient.post);

const trip = {
  assignedShipperId: "shipper-1",
  cashCollectedAmount: 0,
  cashSettledAmount: 0,
  createdAt: "2026-07-30T00:00:00.000Z",
  id: "trip-1",
  status: "DRAFT" as const,
  statusHistory: [],
  stops: [
    { routeOrder: 1, shipmentId: "shipment-1" },
    { routeOrder: 2, shipmentId: "shipment-2" },
  ],
  tripNumber: "TRIP-20260730-0001",
  updatedAt: "2026-07-30T00:00:00.000Z",
};

describe("delivery trip service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes list payloads and calls list/detail endpoints", async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        data: [trip],
        limit: 20,
        page: 1,
        total: 1,
      },
    });
    mockedGet.mockResolvedValueOnce({ data: trip });

    expect(
      normalizeDeliveryTripListResponse({
        data: [trip],
        limit: 20,
        page: 1,
        total: 1,
      }),
    ).toEqual({
      data: [trip],
      limit: 20,
      page: 1,
      total: 1,
    });

    await listDeliveryTrips({ limit: 20, page: 1, status: "DRAFT" });
    await getDeliveryTrip("trip-1");

    expect(mockedGet).toHaveBeenCalledWith("/delivery-trips", {
      params: { limit: 20, page: 1, status: "DRAFT" },
    });
    expect(mockedGet).toHaveBeenCalledWith("/delivery-trips/trip-1");
  });

  it("calls manager trip planning endpoints with exact contract bodies", async () => {
    mockedPost.mockResolvedValue({ data: trip });
    mockedPatch.mockResolvedValue({ data: trip });

    await createDeliveryTrip({
      assignedShipperId: "shipper-1",
      shipmentIds: ["shipment-1", "shipment-2"],
    });
    await updateDeliveryTripRoute("trip-1", ["shipment-2", "shipment-1"]);
    await optimizeDeliveryTripRoute("trip-1");
    await markDeliveryTripReady("trip-1");

    expect(mockedPost).toHaveBeenCalledWith("/delivery-trips", {
      assignedShipperId: "shipper-1",
      shipmentIds: ["shipment-1", "shipment-2"],
    });
    expect(mockedPatch).toHaveBeenCalledWith("/delivery-trips/trip-1/route", {
      shipmentIds: ["shipment-2", "shipment-1"],
    });
    expect(mockedPost).toHaveBeenCalledWith(
      "/delivery-trips/trip-1/route/optimize",
    );
    expect(mockedPost).toHaveBeenCalledWith("/delivery-trips/trip-1/ready");
  });

  it("calls shipper loading endpoints without exposing internal payloads", async () => {
    mockedPost.mockResolvedValue({ data: trip });

    await scanDeliveryTripPackage("trip-1", "PKG-20260730-0001");
    await startDeliveryTrip("trip-1");

    expect(mockedPost).toHaveBeenCalledWith(
      "/delivery-trips/trip-1/packages/scan",
      { barcode: "PKG-20260730-0001" },
    );
    expect(mockedPost).toHaveBeenCalledWith("/delivery-trips/trip-1/start");
  });

  it("calls OTP, POD, COD and failed-attempt endpoints with safe payloads", async () => {
    mockedPost.mockResolvedValue({ data: trip });

    await requestDeliveryOtp("trip-1", "shipment-1");
    await deliverTripShipment("trip-1", "shipment-1", {
      codCollectionMethod: "CASH",
      images: [new File(["pod"], "pod.png", { type: "image/png" })],
      otp: "123456",
    });
    await recordFailedDeliveryAttempt(
      "trip-1",
      "shipment-1",
      "Khách không nghe máy",
    );

    expect(mockedPost).toHaveBeenCalledWith(
      "/delivery-trips/trip-1/shipments/shipment-1/delivery-otp",
    );
    const deliverBody = mockedPost.mock.calls.find(([url]) =>
      String(url).endsWith("/deliver"),
    )?.[1] as FormData;
    expect(deliverBody.get("otp")).toBe("123456");
    expect(deliverBody.get("codCollectionMethod")).toBe("CASH");
    expect(deliverBody.getAll("images")).toHaveLength(1);
    expect(mockedPost).toHaveBeenCalledWith(
      "/delivery-trips/trip-1/shipments/shipment-1/deliver",
      expect.any(FormData),
    );
    expect(mockedPost).toHaveBeenCalledWith(
      "/delivery-trips/trip-1/shipments/shipment-1/fail-attempt",
      { reason: "Khách không nghe máy" },
    );
  });

  it("calls return handoff and exact cash settlement endpoints", async () => {
    mockedPost.mockResolvedValue({ data: trip });

    await scanReturnPackage("trip-1", "shipment-1", "PKG-001");
    await completeReturnHandoff("trip-1", "shipment-1");
    await settleDeliveryTripCash("trip-1", 320000);

    expect(mockedPost).toHaveBeenCalledWith(
      "/delivery-trips/trip-1/shipments/shipment-1/return/packages/scan",
      { barcode: "PKG-001" },
    );
    expect(mockedPost).toHaveBeenCalledWith(
      "/delivery-trips/trip-1/shipments/shipment-1/return/handoff",
    );
    expect(mockedPost).toHaveBeenCalledWith(
      "/delivery-trips/trip-1/settle-cash",
      { amount: 320000 },
    );
  });

  it("calls incident report, list and manager resolution endpoints", async () => {
    const incident = {
      description: "Xe bị hỏng giữa đường",
      id: "incident-1",
      incidentNumber: "INC-20260730-0001",
      reportedAt: "2026-07-30T02:00:00.000Z",
      reportedBy: "shipper-1",
      status: "OPEN" as const,
      tripId: "trip-1",
      type: "VEHICLE_BREAKDOWN" as const,
    };
    mockedPost.mockResolvedValueOnce({ data: incident });
    mockedGet.mockResolvedValueOnce({ data: [incident] });
    mockedPatch.mockResolvedValueOnce({ data: incident });

    await reportDeliveryIncident("trip-1", {
      description: "Xe bị hỏng giữa đường",
      shipmentId: "shipment-1",
      type: "VEHICLE_BREAKDOWN",
    });
    await listDeliveryIncidents("trip-1");
    await resolveDeliveryIncident("trip-1", "incident-1", {
      action: "RESCUE",
      note: "Điều Shipper thay thế",
      rescueShipperId: "shipper-2",
    });

    expect(mockedPost).toHaveBeenCalledWith(
      "/delivery-trips/trip-1/incidents",
      {
        description: "Xe bị hỏng giữa đường",
        shipmentId: "shipment-1",
        type: "VEHICLE_BREAKDOWN",
      },
    );
    expect(mockedGet).toHaveBeenCalledWith("/delivery-trips/trip-1/incidents");
    expect(mockedPatch).toHaveBeenCalledWith(
      "/delivery-trips/trip-1/incidents/incident-1/resolve",
      {
        action: "RESCUE",
        note: "Điều Shipper thay thế",
        rescueShipperId: "shipper-2",
      },
    );
  });
});
