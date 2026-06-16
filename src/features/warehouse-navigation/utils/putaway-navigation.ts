import type { PutawaySuggestion, WarehouseShelf } from "@/types/api";

export type PutawaySuggestionInput = {
  sku: string;
  quantity: number;
  warehouseId: string;
};

export const fallbackShelves: WarehouseShelf[] = [
  {
    id: "central-a1-s01",
    warehouseId: "central",
    warehouseCode: "CENTRAL",
    zoneCode: "A",
    zoneName: "Zone A",
    rackCode: "A1",
    rackName: "Rack A1",
    code: "A1-S01",
    barcode: "A1-S01",
    x: 72,
    y: 78,
    width: 132,
    height: 64,
  },
  {
    id: "central-a1-s02",
    warehouseId: "central",
    warehouseCode: "CENTRAL",
    zoneCode: "A",
    zoneName: "Zone A",
    rackCode: "A1",
    rackName: "Rack A1",
    code: "A1-S02",
    barcode: "A1-S02",
    x: 72,
    y: 160,
    width: 132,
    height: 64,
  },
  {
    id: "central-b2-s01",
    warehouseId: "central",
    warehouseCode: "CENTRAL",
    zoneCode: "B",
    zoneName: "Zone B",
    rackCode: "B2",
    rackName: "Rack B2",
    code: "B2-S01",
    barcode: "B2-S01",
    x: 284,
    y: 78,
    width: 132,
    height: 64,
  },
  {
    id: "central-staging",
    warehouseId: "central",
    warehouseCode: "CENTRAL",
    zoneCode: "STG",
    zoneName: "Receiving",
    rackCode: "STG",
    rackName: "Staging",
    code: "STG-01",
    barcode: "STG-01",
    x: 284,
    y: 240,
    width: 132,
    height: 52,
    isStaging: true,
  },
];

const shelfCapacityByCode: Record<string, number> = {
  "A1-S01": 60,
  "A1-S02": 120,
  "B2-S01": 260,
};

export function buildNavigationPath(shelf: WarehouseShelf) {
  return [shelf.warehouseCode, shelf.zoneName, shelf.rackName, shelf.code];
}

export function fallbackPutawaySuggestions({
  sku,
  quantity,
  warehouseId,
}: PutawaySuggestionInput): PutawaySuggestion[] {
  return fallbackShelves
    .filter((shelf) => !shelf.isStaging && shelf.warehouseId === warehouseId)
    .map((shelf) => {
      const capacity = shelfCapacityByCode[shelf.code] ?? 0;
      const sameSku = sku.toUpperCase().includes("CUP") && shelf.code === "A1-S02";

      return {
        shelf,
        capacity,
        reason: sameSku
          ? "same SKU cluster + best-fit capacity"
          : "best-fit by remaining volume",
        advisory: true,
        pathLabel: buildNavigationPath(shelf).join(" / "),
      };
    })
    .filter((suggestion) => suggestion.capacity >= quantity)
    .sort((left, right) => {
      const sameSkuScore = Number(right.reason.includes("same SKU")) -
        Number(left.reason.includes("same SKU"));

      if (sameSkuScore !== 0) {
        return sameSkuScore;
      }

      return left.capacity - right.capacity;
    });
}

export function selectSuggestedShelf(suggestions: PutawaySuggestion[]) {
  return suggestions[0] ?? null;
}
