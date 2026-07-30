import { appendEvidenceImages } from "@/components/evidence-images/evidence-image-utils";
import { apiClient } from "@/lib/api-client";
import { normalizeApiList, type ApiListLike } from "@/lib/api-list";
import { type ApiEnvelope, unwrapApiData } from "@/lib/api-contract";

export const SHIPMENT_STATUSES = [
  "PENDING",
  "READY",
  "PICKED_UP",
  "IN_TRANSIT",
  "DELIVERED",
  "FAILED",
  "RETURNING",
  "RETURNED",
] as const;

export const CARRIER_STATUSES = ["ACTIVE", "INACTIVE"] as const;

export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];
export type CarrierStatus = (typeof CARRIER_STATUSES)[number];

export type Carrier = {
  id: string;
  name: string;
  code: string;
  status: CarrierStatus;
  contactInfo?: Record<string, unknown>;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ShipmentStatusHistoryEntry = {
  status: ShipmentStatus;
  at: string;
  by?: string;
  note?: string;
  images?: string[];
};

export type Shipment = {
  id: string;
  orderId: string;
  goodsIssueId: string;
  shipmentNumber?: string | null;
  orderCode?: string | null;
  carrierId?: string;
  assignedShipperId?: string;
  activeTripId?: string;
  trackingNumber?: string;
  shipmentStatus: ShipmentStatus;
  recipient: {
    name: string;
    phone: string;
    address: Record<string, unknown>;
  };
  paymentMethod: "COD" | "ONLINE";
  codAmount: number;
  codCollectionMethod?: "CASH" | "ECOM_QR";
  codCollectedAmount?: number;
  packages: ShipmentPackage[];
  attempts: number;
  failReason?: string;
  statusHistory: ShipmentStatusHistoryEntry[];
  shippedAt?: string;
  deliveredAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

type ShipmentPayload = Omit<Shipment, "packages" | "statusHistory"> & {
  packages?: ShipmentPackage[];
  statusHistory?: ShipmentStatusHistoryEntry[];
};

export type ShipmentPackageAllocation = {
  itemId: string;
  sku: string;
  quantity: number;
};

export type ShipmentPackage = {
  barcode: string;
  allocations: ShipmentPackageAllocation[];
  createdAt: string;
  createdBy: string;
  loadedTripId?: string;
  loadedAt?: string;
  returnedAt?: string;
  returnedBy?: string;
};

export type CreateShipmentPackageInput = {
  allocations: Array<{ itemId: string; quantity: number }>;
};

export type QueryShipmentsInput = {
  shipmentStatus?: ShipmentStatus | "ALL";
  orderId?: string;
  carrierId?: string;
  page?: number;
  limit?: number;
};

export type QueryCarriersInput = {
  status?: CarrierStatus | "ALL";
  page?: number;
  limit?: number;
};

export type CreateCarrierInput = {
  name: string;
  code: string;
  contactInfo?: Record<string, unknown>;
  note?: string;
};

export type UpdateCarrierInput = Partial<
  Pick<Carrier, "name" | "contactInfo" | "note" | "status">
>;

export type AssignShipmentCarrierInput = {
  carrierId: string;
  trackingNumber: string;
};

export type UpdateShipmentStatusInput = {
  status: ShipmentStatus;
  note?: string;
  failReason?: string;
  images?: File[];
};

function optionalText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeShipment(payload: ShipmentPayload): Shipment {
  return {
    ...payload,
    packages: payload.packages ?? [],
    statusHistory: payload.statusHistory ?? [],
  };
}

export function normalizeShipmentListResponse(
  payload: ApiListLike<ShipmentPayload>,
) {
  const result = normalizeApiList(payload);
  return {
    ...result,
    data: result.data.map(normalizeShipment),
  };
}

export function normalizeCarrierListResponse(payload: ApiListLike<Carrier>) {
  return normalizeApiList(payload);
}

export async function listShipments(input: QueryShipmentsInput = {}) {
  const response = await apiClient.get<ApiListLike<ShipmentPayload>>(
    "/shipments",
    {
      params: {
        carrierId: optionalText(input.carrierId),
        limit: input.limit,
        orderId: optionalText(input.orderId),
        page: input.page,
        shipmentStatus:
          input.shipmentStatus && input.shipmentStatus !== "ALL"
            ? input.shipmentStatus
            : undefined,
      },
    },
  );

  return normalizeShipmentListResponse(response.data);
}

export async function getShipment(shipmentId: string) {
  const response = await apiClient.get<
    ApiEnvelope<ShipmentPayload> | ShipmentPayload
  >(`/shipments/${encodeURIComponent(shipmentId)}`);

  return normalizeShipment(unwrapApiData(response.data));
}

export async function createShipmentPackage(
  shipmentId: string,
  input: CreateShipmentPackageInput,
) {
  const response = await apiClient.post<
    ApiEnvelope<ShipmentPayload> | ShipmentPayload
  >(`/shipments/${encodeURIComponent(shipmentId)}/packages`, input);
  return normalizeShipment(unwrapApiData(response.data));
}

export async function assignShipmentCarrier(
  shipmentId: string,
  input: AssignShipmentCarrierInput,
) {
  const response = await apiClient.patch<ApiEnvelope<Shipment> | Shipment>(
    `/shipments/${encodeURIComponent(shipmentId)}/assign`,
    input,
  );

  return unwrapApiData(response.data);
}

export async function updateShipmentStatus(
  shipmentId: string,
  input: UpdateShipmentStatusInput,
) {
  const formData = new FormData();
  formData.append("status", input.status);
  if (input.note) formData.append("note", input.note);
  if (input.failReason) formData.append("failReason", input.failReason);
  appendEvidenceImages(formData, input.images);

  const response = await apiClient.patch<ApiEnvelope<Shipment> | Shipment>(
    `/shipments/${encodeURIComponent(shipmentId)}/status`,
    formData,
  );

  return unwrapApiData(response.data);
}

export async function listCarriers(input: QueryCarriersInput = {}) {
  const response = await apiClient.get<ApiListLike<Carrier>>("/carriers", {
    params: {
      limit: input.limit,
      page: input.page,
      status: input.status && input.status !== "ALL" ? input.status : undefined,
    },
  });

  return normalizeCarrierListResponse(response.data);
}

export async function getCarrier(carrierId: string) {
  const response = await apiClient.get<ApiEnvelope<Carrier> | Carrier>(
    `/carriers/${encodeURIComponent(carrierId)}`,
  );

  return unwrapApiData(response.data);
}

export async function createCarrier(input: CreateCarrierInput) {
  const response = await apiClient.post<ApiEnvelope<Carrier> | Carrier>(
    "/carriers",
    input,
  );

  return unwrapApiData(response.data);
}

export async function updateCarrier(
  carrierId: string,
  input: UpdateCarrierInput,
) {
  const response = await apiClient.patch<ApiEnvelope<Carrier> | Carrier>(
    `/carriers/${encodeURIComponent(carrierId)}`,
    input,
  );

  return unwrapApiData(response.data);
}
