import { apiClient } from "@/lib/api-client";
import { type ApiEnvelope, unwrapApiData } from "@/lib/api-contract";

export const PURCHASE_ORDER_STATUSES = [
  "DRAFT",
  "CONFIRMED",
  "SENT",
  "PARTIALLY_RECEIVED",
  "COMPLETED",
  "CANCELLED",
] as const;

export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];

export type PurchaseOrderItem = {
  itemId: string;
  sku: string;
  expectedQty: number;
  unit: string;
  unitPrice: number;
};

export type PurchaseOrder = {
  id: string;
  poNumber: string;
  supplierId: string;
  warehouseId: string;
  status: PurchaseOrderStatus;
  orderDate: string;
  expectedDate?: string;
  note?: string;
  items: PurchaseOrderItem[];
  createdAt: string;
  updatedAt: string;
};

export type QueryPurchaseOrdersInput = {
  status?: PurchaseOrderStatus | "ALL";
  supplierId?: string;
  page?: number;
  limit?: number;
};

export type PurchaseOrderListResult = {
  data: PurchaseOrder[];
  total: number;
  page: number;
  limit: number;
};

export type CreatePurchaseOrderInput = {
  supplierId: string;
  warehouseId: string;
  expectedDate?: string;
  note?: string;
  items: PurchaseOrderItem[];
};

type PurchaseOrderListPayload = {
  data: PurchaseOrder[];
  total: number;
  page: number;
  limit: number;
};

type PurchaseOrderListEnvelope = ApiEnvelope<
  PurchaseOrderListPayload | PurchaseOrder[]
>;

function toOptionalString(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function toPurchaseOrderListResult(
  payload:
    | PurchaseOrderListEnvelope
    | PurchaseOrderListPayload
    | PurchaseOrder[],
): PurchaseOrderListResult {
  const data = unwrapApiData(payload);

  if (Array.isArray(data)) {
    return {
      data,
      limit: data.length,
      page: 1,
      total: data.length,
    };
  }

  return {
    data: data.data,
    limit: data.limit,
    page: data.page,
    total: data.total,
  };
}

export function normalizePurchaseOrderListResponse(
  payload:
    | PurchaseOrderListEnvelope
    | PurchaseOrderListPayload
    | PurchaseOrder[],
) {
  return toPurchaseOrderListResult(payload);
}

export async function listPurchaseOrders(
  input: QueryPurchaseOrdersInput = {},
) {
  const response = await apiClient.get<
    PurchaseOrderListEnvelope | PurchaseOrderListPayload | PurchaseOrder[]
  >("/purchase-orders", {
    params: {
      limit: input.limit,
      page: input.page,
      status:
        input.status && input.status !== "ALL" ? input.status : undefined,
      supplierId: toOptionalString(input.supplierId),
    },
  });

  return toPurchaseOrderListResult(response.data);
}

export async function getPurchaseOrder(purchaseOrderId: string) {
  const response = await apiClient.get<ApiEnvelope<PurchaseOrder> | PurchaseOrder>(
    `/purchase-orders/${encodeURIComponent(purchaseOrderId)}`,
  );

  return unwrapApiData(response.data);
}

export async function createPurchaseOrder(input: CreatePurchaseOrderInput) {
  const response = await apiClient.post<ApiEnvelope<PurchaseOrder> | PurchaseOrder>(
    "/purchase-orders",
    input,
  );

  return unwrapApiData(response.data);
}
