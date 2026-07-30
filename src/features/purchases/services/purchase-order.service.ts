import { apiClient } from "@/lib/api-client";
import { type ApiEnvelope, unwrapApiData } from "@/lib/api-contract";

export const PURCHASE_ORDER_STATUSES = [
  "CONFIRMED",
  "PARTIALLY_RECEIVED",
  "COMPLETED",
] as const;

export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];

export type PurchaseOrderItem = {
  itemId: string;
  sku: string;
  itemName?: string;
  expectedQty: number;
  unit: string;
  unitPrice: number;
  /** Kích thước 1 thùng — đọc live từ WarehouseItem, có thể undefined nếu item chưa khai. */
  itemDepth?: number;
  itemWidth?: number;
  itemHeight?: number;
};

export type PurchaseOrderSupplierSummary = {
  id?: string;
  code?: string;
  name?: string;
};

export type PurchaseOrder = {
  id: string;
  poNumber: string;
  supplierId: string;
  supplier?: PurchaseOrderSupplierSummary | null;
  supplierCode?: string | null;
  supplierName?: string | null;
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

export type CreatePurchaseOrderItemInput = {
  itemId: string;
  expectedQty: number;
  unit: string;
  unitPrice?: number;
};

export type CreatePurchaseOrderInput = {
  supplierId: string;
  expectedDate?: string;
  note?: string;
  items: CreatePurchaseOrderItemInput[];
};

type PurchaseOrderPayload = Omit<PurchaseOrder, "items"> & {
  items?: PurchaseOrderItem[] | null;
};

type PurchaseOrderListPayload = {
  data: PurchaseOrderPayload[];
  total: number;
  page: number;
  limit: number;
};

type PurchaseOrderListEnvelope = ApiEnvelope<
  PurchaseOrderListPayload | PurchaseOrderPayload[]
>;

function toOptionalString(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizePurchaseOrder(
  purchaseOrder: PurchaseOrderPayload,
): PurchaseOrder {
  return {
    ...purchaseOrder,
    items: purchaseOrder.items ?? [],
  };
}

function toPurchaseOrderListResult(
  payload:
    | PurchaseOrderListEnvelope
    | PurchaseOrderListPayload
    | PurchaseOrderPayload[],
): PurchaseOrderListResult {
  const data = unwrapApiData(payload);

  if (Array.isArray(data)) {
    return {
      data: data.map(normalizePurchaseOrder),
      limit: data.length,
      page: 1,
      total: data.length,
    };
  }

  return {
    data: data.data.map(normalizePurchaseOrder),
    limit: data.limit,
    page: data.page,
    total: data.total,
  };
}

export function normalizePurchaseOrderListResponse(
  payload:
    | PurchaseOrderListEnvelope
    | PurchaseOrderListPayload
    | PurchaseOrderPayload[],
) {
  return toPurchaseOrderListResult(payload);
}

export async function listPurchaseOrders(input: QueryPurchaseOrdersInput = {}) {
  const response = await apiClient.get<
    | PurchaseOrderListEnvelope
    | PurchaseOrderListPayload
    | PurchaseOrderPayload[]
  >("/purchase-orders", {
    params: {
      limit: input.limit,
      page: input.page,
      status: input.status && input.status !== "ALL" ? input.status : undefined,
      supplierId: toOptionalString(input.supplierId),
    },
  });

  return toPurchaseOrderListResult(response.data);
}

export async function getPurchaseOrder(purchaseOrderId: string) {
  const response = await apiClient.get<
    ApiEnvelope<PurchaseOrderPayload> | PurchaseOrderPayload
  >(`/purchase-orders/${encodeURIComponent(purchaseOrderId)}`);

  return normalizePurchaseOrder(unwrapApiData(response.data));
}

export async function createPurchaseOrder(input: CreatePurchaseOrderInput) {
  // BE dùng ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }) — sku KHÔNG
  // được gửi trong từng item, BE tự denormalize từ WarehouseItem theo itemId.
  const payload = {
    supplierId: input.supplierId,
    expectedDate: input.expectedDate,
    note: input.note,
    items: input.items.map((item) => ({
      itemId: item.itemId,
      expectedQty: item.expectedQty,
      unit: item.unit,
      unitPrice: item.unitPrice,
    })),
  };
  const response = await apiClient.post<
    ApiEnvelope<PurchaseOrderPayload> | PurchaseOrderPayload
  >("/purchase-orders", payload);

  return normalizePurchaseOrder(unwrapApiData(response.data));
}

export type ReceivingPurchaseOrderItem = {
  itemId: string;
  itemName: string;
  sku: string;
  unit: string;
  expectedQty: number;
  receivedQty: number;
  remainingQty: number;
  itemDepth?: number;
  itemWidth?: number;
  itemHeight?: number;
};

export type ReceivingPurchaseOrder = {
  id: string;
  poNumber: string;
  supplierName: string;
  expectedDate?: string;
  items: ReceivingPurchaseOrderItem[];
};

export type ReceivingPurchaseOrderListResult = {
  data: ReceivingPurchaseOrder[];
  total: number;
  page: number;
  limit: number;
};

export async function listReceivingPurchaseOrders(
  input: Pick<QueryPurchaseOrdersInput, "page" | "limit"> = {},
): Promise<ReceivingPurchaseOrderListResult> {
  const response = await apiClient.get<
    | ApiEnvelope<ReceivingPurchaseOrderListResult>
    | ReceivingPurchaseOrderListResult
  >("/purchase-orders/receiving", {
    params: { limit: input.limit, page: input.page },
  });
  const data = unwrapApiData(response.data);
  return Array.isArray(data)
    ? { data, total: data.length, page: 1, limit: data.length }
    : data;
}
