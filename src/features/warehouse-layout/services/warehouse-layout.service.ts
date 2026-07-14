import { MissingBackendEndpointError } from "@/lib/api-contract";
import type { WarehouseLayout } from "@/types/api";

function missingWarehouseLayoutEndpoint(endpoint: string): never {
  throw new MissingBackendEndpointError({ endpoint });
}

export async function getWarehouseLayout(
  warehouseId: string,
  status: "draft" | "published",
): Promise<WarehouseLayout | null> {
  return missingWarehouseLayoutEndpoint(
    `GET /api/wms/warehouses/${warehouseId}/layout?status=${status}`,
  );
}

export async function saveWarehouseLayoutDraft(
  layout: WarehouseLayout,
): Promise<WarehouseLayout> {
  return missingWarehouseLayoutEndpoint(
    `PUT /api/wms/warehouses/${layout.warehouseId}/layout/draft`,
  );
}

export async function publishWarehouseLayout(
  warehouseId: string,
  draftRevision: number,
): Promise<WarehouseLayout> {
  return missingWarehouseLayoutEndpoint(
    `POST /api/wms/warehouses/${warehouseId}/layout/publish revision ${draftRevision}`,
  );
}
