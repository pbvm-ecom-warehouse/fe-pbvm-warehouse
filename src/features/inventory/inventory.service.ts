import { apiClient } from "@/lib/api-client";
import type {
  ApiListResponse,
  InventoryValuePoint,
  StockLedgerRow,
  StockMovement,
} from "@/types/api";

export async function listStockLedger() {
  const response =
    await apiClient.get<ApiListResponse<StockLedgerRow>>("/inventory/ledger");
  return response.data;
}

export async function listStockMovements() {
  const response = await apiClient.get<ApiListResponse<StockMovement>>(
    "/inventory/movements",
  );
  return response.data;
}

export async function listInventoryValueSeries() {
  const response = await apiClient.get<ApiListResponse<InventoryValuePoint>>(
    "/reports/inventory-value-series",
  );
  return response.data;
}
