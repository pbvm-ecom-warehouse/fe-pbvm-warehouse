import { apiClient } from "@/lib/api-client";
import { normalizeApiList, type ApiListLike } from "@/lib/api-list";
import { type ApiEnvelope, unwrapApiData } from "@/lib/api-contract";

export const STOCK_COUNT_STATUSES = [
  "DRAFT",
  "IN_PROGRESS",
  "COMPLETED",
  "APPROVED",
] as const;

export type StockCountStatus = (typeof STOCK_COUNT_STATUSES)[number];

export type StockCountItem = {
  itemId: string;
  sku: string;
  shelfId: string;
  lotId?: string | null;
  systemQty: number;
  actualQty?: number | null;
  delta?: number | null;
  reason?: string | null;
};

export type StockCount = {
  id: string;
  warehouseId: string;
  zoneId?: string | null;
  status: StockCountStatus;
  note?: string;
  createdBy: string;
  countedBy?: string | null;
  approvedBy?: string | null;
  approveReason?: string;
  items: StockCountItem[];
  createdAt: string;
  updatedAt: string;
};

export type QueryStockCountsInput = {
  status?: StockCountStatus | "ALL";
  warehouseId?: string;
  page?: number;
  limit?: number;
};

export type CreateStockCountInput = {
  warehouseId: string;
  zoneId?: string;
  note?: string;
};

export type CountStockCountItemInput = {
  shelfId: string;
  lotId?: string;
  actualQty: number;
  reason?: string;
};

export type ApproveStockCountInput = {
  reason?: string;
};

function optionalText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function normalizeStockCountListResponse(
  payload: ApiListLike<StockCount>,
) {
  return normalizeApiList(payload);
}

export async function listStockCounts(input: QueryStockCountsInput = {}) {
  const response = await apiClient.get<ApiListLike<StockCount>>(
    "/stock-counts",
    {
      params: {
        limit: input.limit,
        page: input.page,
        status:
          input.status && input.status !== "ALL" ? input.status : undefined,
        warehouseId: optionalText(input.warehouseId),
      },
    },
  );

  return normalizeStockCountListResponse(response.data);
}

export async function getStockCount(stockCountId: string) {
  const response = await apiClient.get<ApiEnvelope<StockCount> | StockCount>(
    `/stock-counts/${encodeURIComponent(stockCountId)}`,
  );

  return unwrapApiData(response.data);
}

export async function createStockCount(input: CreateStockCountInput) {
  const response = await apiClient.post<ApiEnvelope<StockCount> | StockCount>(
    "/stock-counts",
    input,
  );

  return unwrapApiData(response.data);
}

export async function countStockCountItem({
  input,
  itemId,
  stockCountId,
}: {
  input: CountStockCountItemInput;
  itemId: string;
  stockCountId: string;
}) {
  const response = await apiClient.post<ApiEnvelope<StockCount> | StockCount>(
    `/stock-counts/${encodeURIComponent(stockCountId)}/items/${encodeURIComponent(itemId)}/count`,
    input,
  );

  return unwrapApiData(response.data);
}

export async function approveStockCount(
  stockCountId: string,
  input: ApproveStockCountInput = {},
) {
  const response = await apiClient.post<ApiEnvelope<StockCount> | StockCount>(
    `/stock-counts/${encodeURIComponent(stockCountId)}/approve`,
    input,
  );

  return unwrapApiData(response.data);
}
