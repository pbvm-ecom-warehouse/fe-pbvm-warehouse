import { apiClient } from "@/lib/api-client";
import { type ApiEnvelope, unwrapApiData } from "@/lib/api-contract";

export type UnassignedInventoryRow = {
  id: string;
  itemId: string;
  sku: string;
  itemName: string;
  shelfId: string;
  shelfCode: string;
  lotId?: string | null;
  lotNumber?: string | null;
  quantity: number;
  packageCount: number;
  packageFactor?: number | null;
  packageVolumeCm3Snapshot?: number | null;
};

export type InventoryCellProgress = {
  assignedBaseQty: number;
  unassignedBaseQty: number;
  unassignedRows: number;
  assignedPercent: number;
  requiresCellScan: boolean;
};

export type AssignInventoryCellInput = {
  inventoryId: string;
  cellBarcode: string;
  packageCount: number;
  packageFactor: number;
  packageDepthCm: number;
  packageWidthCm: number;
  packageHeightCm: number;
  packageVolumeCm3: number;
};

export async function listUnassignedInventory() {
  const response = await apiClient.get<
    ApiEnvelope<UnassignedInventoryRow[]> | UnassignedInventoryRow[]
  >("/inventory-reconciliation/unassigned");
  return unwrapApiData(response.data);
}

export async function getInventoryCellProgress() {
  const response = await apiClient.get<
    ApiEnvelope<InventoryCellProgress> | InventoryCellProgress
  >("/inventory-reconciliation/progress");
  return unwrapApiData(response.data);
}

export async function assignInventoryCell(input: AssignInventoryCellInput) {
  const response = await apiClient.post<
    ApiEnvelope<InventoryCellProgress> | InventoryCellProgress
  >("/inventory-reconciliation/assign", input);
  return unwrapApiData(response.data);
}
