import { apiClient } from "@/lib/api-client";
import { type ApiEnvelope, unwrapApiData } from "@/lib/api-contract";
import type { NavigationPath } from "./putaway-navigation.service";

export type StorageCellContent = {
  id: string;
  sku: string;
  itemName: string;
  unit: string;
  quantity: number;
  packageFactor?: number | null;
  packageVolumeCm3Snapshot?: number | null;
  lotNumber?: string | null;
  expiryDate?: string | null;
};

export type StorageCellView = {
  id: string;
  rackId: string;
  shelfId: string;
  level: number;
  bay: number;
  code: string;
  barcode: string;
  status: "ACTIVE" | "BLOCKED";
  innerDepth: number;
  innerWidth: number;
  innerHeight: number;
  usableVolumeCm3: number;
  occupiedVolumeCm3: number;
  fillPercent: number;
  contents: StorageCellContent[];
};

export async function listRackCells(rackId: string) {
  const response = await apiClient.get<
    ApiEnvelope<StorageCellView[]> | StorageCellView[]
  >(`/location/racks/${encodeURIComponent(rackId)}/cells`);
  return unwrapApiData(response.data);
}

export async function getNavigationPath(targetRackId: string) {
  const response = await apiClient.get<
    ApiEnvelope<NavigationPath> | NavigationPath
  >("/location/navigation", { params: { targetRackId } });
  return unwrapApiData(response.data);
}
