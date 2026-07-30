import { apiClient } from "@/lib/api-client";
import { type ApiEnvelope, unwrapApiData } from "@/lib/api-contract";
import { normalizeApiList, type ApiListLike } from "@/lib/api-list";

export const DELIVERY_TRIP_STATUSES = [
  "DRAFT",
  "READY",
  "LOADING",
  "IN_TRANSIT",
  "PAUSED",
  "AWAITING_SETTLEMENT",
  "COMPLETED",
  "CANCELLED",
] as const;

export type DeliveryTripStatus = (typeof DELIVERY_TRIP_STATUSES)[number];

export type DeliveryTripStop = {
  shipmentId: string;
  routeOrder: number;
};

export type DeliveryTripStatusHistoryEntry = {
  status: DeliveryTripStatus;
  at: string;
  by: string;
  note?: string;
};

export type DeliveryTrip = {
  id: string;
  tripNumber: string;
  assignedShipperId: string;
  stops: DeliveryTripStop[];
  status: DeliveryTripStatus;
  statusHistory: DeliveryTripStatusHistoryEntry[];
  startedAt?: string;
  completedAt?: string;
  cashCollectedAmount: number;
  cashSettledAmount: number;
  settledAt?: string;
  settledBy?: string;
  createdAt: string;
  updatedAt: string;
};

export type QueryDeliveryTripsInput = {
  status?: DeliveryTripStatus | "ALL";
  page?: number;
  limit?: number;
};

export type CreateDeliveryTripInput = {
  assignedShipperId: string;
  shipmentIds: string[];
};

function tripPath(tripId: string) {
  return `/delivery-trips/${encodeURIComponent(tripId)}`;
}

export function normalizeDeliveryTripListResponse(
  payload: ApiListLike<DeliveryTrip>,
) {
  return normalizeApiList(payload);
}

export async function listDeliveryTrips(input: QueryDeliveryTripsInput = {}) {
  const response = await apiClient.get<ApiListLike<DeliveryTrip>>(
    "/delivery-trips",
    {
      params: {
        limit: input.limit,
        page: input.page,
        status:
          input.status && input.status !== "ALL" ? input.status : undefined,
      },
    },
  );
  return normalizeDeliveryTripListResponse(response.data);
}

export async function getDeliveryTrip(tripId: string) {
  const response = await apiClient.get<
    ApiEnvelope<DeliveryTrip> | DeliveryTrip
  >(tripPath(tripId));
  return unwrapApiData(response.data);
}

export async function createDeliveryTrip(input: CreateDeliveryTripInput) {
  const response = await apiClient.post<
    ApiEnvelope<DeliveryTrip> | DeliveryTrip
  >("/delivery-trips", input);
  return unwrapApiData(response.data);
}

export async function updateDeliveryTripRoute(
  tripId: string,
  shipmentIds: string[],
) {
  const response = await apiClient.patch<
    ApiEnvelope<DeliveryTrip> | DeliveryTrip
  >(`${tripPath(tripId)}/route`, { shipmentIds });
  return unwrapApiData(response.data);
}

export async function optimizeDeliveryTripRoute(tripId: string) {
  const response = await apiClient.post<
    ApiEnvelope<DeliveryTrip> | DeliveryTrip
  >(`${tripPath(tripId)}/route/optimize`);
  return unwrapApiData(response.data);
}

export async function markDeliveryTripReady(tripId: string) {
  const response = await apiClient.post<
    ApiEnvelope<DeliveryTrip> | DeliveryTrip
  >(`${tripPath(tripId)}/ready`);
  return unwrapApiData(response.data);
}

export async function scanDeliveryTripPackage(tripId: string, barcode: string) {
  const response = await apiClient.post<
    ApiEnvelope<DeliveryTrip> | DeliveryTrip
  >(`${tripPath(tripId)}/packages/scan`, { barcode });
  return unwrapApiData(response.data);
}

export async function startDeliveryTrip(tripId: string) {
  const response = await apiClient.post<
    ApiEnvelope<DeliveryTrip> | DeliveryTrip
  >(`${tripPath(tripId)}/start`);
  return unwrapApiData(response.data);
}
