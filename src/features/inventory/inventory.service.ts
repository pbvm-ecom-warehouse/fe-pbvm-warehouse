import { apiClient } from "@/lib/api-client";
import {
  isApiEnvelope,
  throwIfMissingBackendEndpoint,
  type ApiEnvelope,
} from "@/lib/api-contract";
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

async function withUnsupportedEndpointGuard<T>(
  request: () => Promise<ApiListResponse<T>>,
  endpoint: string,
) {
  try {
    return await request();
  } catch (error) {
    throwIfMissingBackendEndpoint(error, endpoint);
    throw error;
  }
}

export async function listStockLedger() {
  return withUnsupportedEndpointGuard(async () => {
    const response =
      await apiClient.get<ApiEnvelope<StockLedgerRow[]> | ApiListResponse<StockLedgerRow>>(
        "/inventory/ledger",
      );
    return toListResponse(response.data);
  }, "GET /api/wms/inventory/ledger");
}

export async function listStockMovements() {
  return withUnsupportedEndpointGuard(async () => {
    const response = await apiClient.get<
      ApiEnvelope<StockMovement[]> | ApiListResponse<StockMovement>
    >("/inventory/movements");
    return toListResponse(response.data);
  }, "GET /api/wms/inventory/movements");
}

export async function listInventoryValueSeries() {
  return withUnsupportedEndpointGuard(async () => {
    const response = await apiClient.get<
      ApiEnvelope<InventoryValuePoint[]> | ApiListResponse<InventoryValuePoint>
    >("/reports/inventory-value-series");
    return toListResponse(response.data);
  }, "GET /api/wms/reports/inventory-value-series");
}
