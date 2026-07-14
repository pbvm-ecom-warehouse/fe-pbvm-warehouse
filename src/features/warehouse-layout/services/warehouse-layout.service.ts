import { apiClient } from "@/lib/api-client";
import {
  throwIfMissingBackendEndpoint,
  type ApiEnvelope,
  unwrapApiData,
} from "@/lib/api-contract";
import type { ShelfContentItem, WarehouseLayout } from "@/types/api";

export async function getWarehouseLayout(
  warehouseId: string,
  status: "draft" | "published",
): Promise<WarehouseLayout | null> {
  try {
    const response = await apiClient.get<
      ApiEnvelope<WarehouseLayout | null> | WarehouseLayout | null
    >(`/warehouse/${encodeURIComponent(warehouseId)}/layout`, {
      params: { status },
    });

    return unwrapApiData(response.data);
  } catch (error) {
    throwIfMissingBackendEndpoint(
      error,
      `GET /api/wms/warehouse/${warehouseId}/layout?status=${status}`,
    );
    throw error;
  }
}

export async function saveWarehouseLayoutDraft(
  layout: WarehouseLayout,
): Promise<WarehouseLayout> {
  try {
    const response = await apiClient.put<
      ApiEnvelope<WarehouseLayout> | WarehouseLayout
    >(`/warehouse/${encodeURIComponent(layout.warehouseId)}/layout/draft`, layout);

    return unwrapApiData(response.data);
  } catch (error) {
    throwIfMissingBackendEndpoint(
      error,
      `PUT /api/wms/warehouse/${layout.warehouseId}/layout/draft`,
    );
    throw error;
  }
}

export async function publishWarehouseLayout(
  warehouseId: string,
  draftRevision: number,
): Promise<WarehouseLayout> {
  try {
    const response = await apiClient.post<
      ApiEnvelope<WarehouseLayout> | WarehouseLayout
    >(`/warehouse/${encodeURIComponent(warehouseId)}/layout/publish`, {
      draftRevision,
    });

    return unwrapApiData(response.data);
  } catch (error) {
    throwIfMissingBackendEndpoint(
      error,
      `POST /api/wms/warehouse/${warehouseId}/layout/publish`,
    );
    throw error;
  }
}

export async function listShelfContents({
  shelfCode,
  warehouseId,
}: {
  shelfCode: string;
  warehouseId: string;
}) {
  try {
    const response = await apiClient.get<
      ApiEnvelope<ShelfContentItem[]> | ShelfContentItem[]
    >(`/warehouse/shelves/${encodeURIComponent(shelfCode)}/contents`, {
      params: { warehouseId },
    });

    return unwrapApiData(response.data);
  } catch (error) {
    throwIfMissingBackendEndpoint(
      error,
      `GET /api/wms/warehouse/shelves/${shelfCode}/contents`,
    );
    throw error;
  }
}