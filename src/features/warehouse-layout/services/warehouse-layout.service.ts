import { apiClient } from "@/lib/api-client";
import { type ApiEnvelope, unwrapApiData } from "@/lib/api-contract";
import type { WarehouseLayout } from "@/types/api";

export async function getWarehouseLayout(
  warehouseId: string,
  status: "draft" | "published",
) {
  const response = await apiClient.get<
    ApiEnvelope<WarehouseLayout | null> | WarehouseLayout | null
  >(`/warehouses/${encodeURIComponent(warehouseId)}/layout`, {
    params: { status },
  });

  return unwrapApiData(response.data);
}

export async function saveWarehouseLayoutDraft(layout: WarehouseLayout) {
  const { warehouseId, revision, canvas, zones, racks, aisles, gates } = layout;
  const response = await apiClient.put<
    ApiEnvelope<WarehouseLayout> | WarehouseLayout
  >(`/warehouses/${encodeURIComponent(warehouseId)}/layout/draft`, {
    baseRevision: revision,
    canvas,
    zones,
    racks,
    aisles,
    gates,
  });

  return unwrapApiData(response.data);
}

export async function publishWarehouseLayout(
  warehouseId: string,
  draftRevision: number,
) {
  const response = await apiClient.post<
    ApiEnvelope<WarehouseLayout> | WarehouseLayout
  >(`/warehouses/${encodeURIComponent(warehouseId)}/layout/publish`, {
    draftRevision,
  });

  return unwrapApiData(response.data);
}
