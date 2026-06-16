import { apiClient } from "@/lib/api-client";
import { isApiEnvelope, type ApiEnvelope } from "@/lib/api-contract";
import type {
  ApiListResponse,
  InventoryValuePoint,
  StockLedgerRow,
  StockMovement,
} from "@/types/api";

function toListResponse<T>(
  payload: ApiEnvelope<T[]> | ApiListResponse<T> | T[],
): ApiListResponse<T> {
  if (Array.isArray(payload)) {
    const total = payload.length;
    return {
      data: payload,
      meta: {
        pagination: {
          page: 1,
          pageSize: total,
          total,
        },
      },
    };
  }

  if (isApiEnvelope<T[]>(payload)) {
    const total = payload.data.length;
    return {
      data: payload.data,
      meta: {
        pagination: payload.meta.pagination ?? {
          page: 1,
          pageSize: total,
          total,
        },
      },
    };
  }

  return payload;
}

export async function listStockLedger() {
  const response =
    await apiClient.get<ApiEnvelope<StockLedgerRow[]> | ApiListResponse<StockLedgerRow>>(
      "/inventory/ledger",
    );
  return toListResponse(response.data);
}

export async function listStockMovements() {
  const response = await apiClient.get<
    ApiEnvelope<StockMovement[]> | ApiListResponse<StockMovement>
  >("/inventory/movements");
  return toListResponse(response.data);
}

export async function listInventoryValueSeries() {
  const response = await apiClient.get<
    ApiEnvelope<InventoryValuePoint[]> | ApiListResponse<InventoryValuePoint>
  >("/reports/inventory-value-series");
  return toListResponse(response.data);
}
