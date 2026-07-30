import { appendEvidenceImages } from "@/components/evidence-images/evidence-image-utils";
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

export type CodCollectionMethod = "CASH" | "ECOM_QR";

export const DELIVERY_INCIDENT_TYPES = [
  "VEHICLE_BREAKDOWN",
  "ACCIDENT",
  "PACKAGE_DAMAGE",
  "OTHER",
] as const;
export type DeliveryIncidentType = (typeof DELIVERY_INCIDENT_TYPES)[number];

export const DELIVERY_INCIDENT_RESOLUTION_ACTIONS = [
  "RESUME",
  "RESCUE",
  "RETURN_TO_WAREHOUSE",
] as const;
export type DeliveryIncidentResolutionAction =
  (typeof DELIVERY_INCIDENT_RESOLUTION_ACTIONS)[number];

export type DeliveryIncident = {
  id: string;
  incidentNumber: string;
  tripId: string;
  shipmentId?: string;
  type: DeliveryIncidentType;
  description: string;
  status: "OPEN" | "RESOLVED";
  reportedBy: string;
  reportedAt: string;
  resolutionAction?: DeliveryIncidentResolutionAction;
  resolutionNote?: string;
  resolvedBy?: string;
  resolvedAt?: string;
};

export type DeliveryOtpResponse = {
  expiresAt: string;
  resendAvailableAt: string;
};

export type DeliverTripShipmentInput = {
  otp: string;
  codCollectionMethod?: CodCollectionMethod;
  images: File[];
};

export type ReportDeliveryIncidentInput = {
  shipmentId?: string;
  type: DeliveryIncidentType;
  description: string;
};

export type ResolveDeliveryIncidentInput = {
  action: DeliveryIncidentResolutionAction;
  note?: string;
  rescueShipperId?: string;
};

function tripPath(tripId: string) {
  return `/delivery-trips/${encodeURIComponent(tripId)}`;
}

function tripShipmentPath(tripId: string, shipmentId: string) {
  return `${tripPath(tripId)}/shipments/${encodeURIComponent(shipmentId)}`;
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

export async function requestDeliveryOtp(tripId: string, shipmentId: string) {
  const response = await apiClient.post<
    ApiEnvelope<DeliveryOtpResponse> | DeliveryOtpResponse
  >(`${tripShipmentPath(tripId, shipmentId)}/delivery-otp`);
  return unwrapApiData(response.data);
}

export async function deliverTripShipment(
  tripId: string,
  shipmentId: string,
  input: DeliverTripShipmentInput,
) {
  const formData = new FormData();
  formData.append("otp", input.otp);
  if (input.codCollectionMethod) {
    formData.append("codCollectionMethod", input.codCollectionMethod);
  }
  appendEvidenceImages(formData, input.images);

  const response = await apiClient.post<
    ApiEnvelope<DeliveryTrip> | DeliveryTrip
  >(`${tripShipmentPath(tripId, shipmentId)}/deliver`, formData);
  return unwrapApiData(response.data);
}

export async function recordFailedDeliveryAttempt(
  tripId: string,
  shipmentId: string,
  reason: string,
) {
  const response = await apiClient.post<
    ApiEnvelope<DeliveryTrip> | DeliveryTrip
  >(`${tripShipmentPath(tripId, shipmentId)}/fail-attempt`, { reason });
  return unwrapApiData(response.data);
}

export async function scanReturnPackage(
  tripId: string,
  shipmentId: string,
  barcode: string,
) {
  const response = await apiClient.post<
    ApiEnvelope<DeliveryTrip> | DeliveryTrip
  >(`${tripShipmentPath(tripId, shipmentId)}/return/packages/scan`, {
    barcode,
  });
  return unwrapApiData(response.data);
}

export async function completeReturnHandoff(
  tripId: string,
  shipmentId: string,
) {
  const response = await apiClient.post<
    ApiEnvelope<DeliveryTrip> | DeliveryTrip
  >(`${tripShipmentPath(tripId, shipmentId)}/return/handoff`);
  return unwrapApiData(response.data);
}

export async function settleDeliveryTripCash(tripId: string, amount: number) {
  const response = await apiClient.post<
    ApiEnvelope<DeliveryTrip> | DeliveryTrip
  >(`${tripPath(tripId)}/settle-cash`, { amount });
  return unwrapApiData(response.data);
}

export async function reportDeliveryIncident(
  tripId: string,
  input: ReportDeliveryIncidentInput,
) {
  const response = await apiClient.post<
    ApiEnvelope<DeliveryIncident> | DeliveryIncident
  >(`${tripPath(tripId)}/incidents`, input);
  return unwrapApiData(response.data);
}

export async function listDeliveryIncidents(tripId: string) {
  const response = await apiClient.get<
    ApiEnvelope<DeliveryIncident[]> | DeliveryIncident[]
  >(`${tripPath(tripId)}/incidents`);
  return unwrapApiData(response.data);
}

export async function resolveDeliveryIncident(
  tripId: string,
  incidentId: string,
  input: ResolveDeliveryIncidentInput,
) {
  const response = await apiClient.patch<
    ApiEnvelope<DeliveryIncident> | DeliveryIncident
  >(
    `${tripPath(tripId)}/incidents/${encodeURIComponent(incidentId)}/resolve`,
    input,
  );
  return unwrapApiData(response.data);
}
