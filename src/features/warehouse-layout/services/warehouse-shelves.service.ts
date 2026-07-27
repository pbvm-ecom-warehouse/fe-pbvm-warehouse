import { apiClient } from "@/lib/api-client";
import { type ApiEnvelope, unwrapApiData } from "@/lib/api-contract";
import {
  listShelves,
  type WarehouseStructureShelf,
} from "@/features/warehouse-structure/services/warehouse-structure.service";
import type { ShelfContentItem } from "@/types/api";

type ShelfContentApiRow = {
  id: string;
  sku: string;
  itemName: string;
  unit: string;
  quantity: number;
  lotNumber: string | null;
  expiryDate: string | null;
};

export async function fetchShelvesForRacks(
  rackIds: string[],
): Promise<Map<string, WarehouseStructureShelf[]>> {
  const entries = await Promise.all(
    rackIds.map(
      async (rackId) => [rackId, await listShelves(rackId)] as const,
    ),
  );
  return new Map(entries);
}

export async function fetchShelfContents(
  shelfId: string,
): Promise<ShelfContentItem[]> {
  const response = await apiClient.get<
    ApiEnvelope<ShelfContentApiRow[]> | ShelfContentApiRow[]
  >(`/location/shelves/${encodeURIComponent(shelfId)}/contents`);
  const rows = unwrapApiData(response.data);

  return rows.map((row) => ({
    id: row.id,
    sku: row.sku,
    itemName: row.itemName,
    unit: row.unit,
    quantity: row.quantity,
    lotNumber: row.lotNumber,
    expiryDate: row.expiryDate,
  }));
}
