import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api-client";
import {
  createDeliveryTrip,
  getDeliveryTrip,
  listDeliveryTrips,
  markDeliveryTripReady,
  normalizeDeliveryTripListResponse,
  optimizeDeliveryTripRoute,
  scanDeliveryTripPackage,
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
});
