import type { PutawaySuggestion, WarehouseShelf } from "@/types/api";

export type PutawaySuggestionInput = {
  sku: string;
  quantity: number;
  warehouseId: string;
};

export type RackGroup = {
  id: string;
  rackCode: string;
  rackName: string;
  shelves: WarehouseShelf[];
  warehouseCode: string;
  zoneCode: string;
  zoneName: string;
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
    level: 1,
    code: "A1-S01",
    barcode: "A1-S01",
    x: 72,
    y: 214,
    width: 132,
    height: 46,
    innerDepth: 52,
    innerWidth: 118,
    innerHeight: 34,
    fillFactor: 0.72,
  },
  {
    id: "central-a1-s02",
    warehouseId: "central",
    warehouseCode: "CENTRAL",
    zoneCode: "A",
    zoneName: "Zone A",
    rackCode: "A1",
    rackName: "Rack A1",
    level: 2,
    code: "A1-S02",
    barcode: "A1-S02",
    x: 72,
    y: 160,
    width: 132,
    height: 46,
    innerDepth: 52,
    innerWidth: 118,
    innerHeight: 38,
    fillFactor: 0.76,
  },
  {
    id: "central-a1-s03",
    warehouseId: "central",
    warehouseCode: "CENTRAL",
    zoneCode: "A",
    zoneName: "Zone A",
    rackCode: "A1",
    rackName: "Rack A1",
    level: 3,
    code: "A1-S03",
    barcode: "A1-S03",
    x: 72,
    y: 106,
    width: 132,
    height: 46,
    innerDepth: 52,
    innerWidth: 118,
    innerHeight: 30,
    fillFactor: 0.68,
  },
  {
    id: "central-b1-s01",
    warehouseId: "central",
    warehouseCode: "CENTRAL",
    zoneCode: "B",
    zoneName: "Zone B",
    rackCode: "B1",
    rackName: "Rack B1",
    level: 1,
    code: "B1-S01",
    barcode: "B1-S01",
    x: 220,
    y: 214,
    width: 132,
    height: 46,
    innerDepth: 56,
    innerWidth: 122,
    innerHeight: 34,
    fillFactor: 0.74,
  },
  {
    id: "central-b1-s02",
    warehouseId: "central",
    warehouseCode: "CENTRAL",
    zoneCode: "B",
    zoneName: "Zone B",
    rackCode: "B1",
    rackName: "Rack B1",
    level: 2,
    code: "B1-S02",
    barcode: "B1-S02",
    x: 220,
    y: 160,
    width: 132,
    height: 46,
    innerDepth: 56,
    innerWidth: 122,
    innerHeight: 42,
    fillFactor: 0.78,
  },
  {
    id: "central-b2-s01",
    warehouseId: "central",
    warehouseCode: "CENTRAL",
    zoneCode: "B",
    zoneName: "Zone B",
    rackCode: "B2",
    rackName: "Rack B2",
    level: 1,
    code: "B2-S01",
    barcode: "B2-S01",
    x: 368,
    y: 214,
    width: 132,
    height: 46,
    innerDepth: 60,
    innerWidth: 126,
    innerHeight: 46,
    fillFactor: 0.8,
  },
  {
    id: "central-staging",
    warehouseId: "central",
    warehouseCode: "CENTRAL",
    zoneCode: "STG",
    zoneName: "Receiving",
    rackCode: "STG",
    rackName: "Staging",
    level: 0,
    code: "STG-01",
    barcode: "STG-01",
    x: 368,
    y: 274,
    width: 132,
    height: 42,
    isStaging: true,
  },
];

const shelfCapacityByCode: Record<string, number> = {
  "A1-S01": 48,
  "A1-S02": 132,
  "A1-S03": 42,
  "B1-S01": 96,
  "B1-S02": 180,
  "B2-S01": 260,
};

export function buildNavigationPath(shelf: WarehouseShelf) {
  return [shelf.warehouseCode, shelf.zoneName, shelf.rackName, shelf.code];
}

export function getShelfDimensionsLabel(shelf: WarehouseShelf) {
  if (!shelf.innerWidth || !shelf.innerDepth || !shelf.innerHeight) {
    return "Chưa khai kích thước lòng kệ";
  }

  return `${shelf.innerWidth} × ${shelf.innerDepth} × ${shelf.innerHeight} cm`;
}

export function getZoneCodes(shelves: WarehouseShelf[]) {
  return Array.from(
    new Set(
      shelves
        .filter((shelf) => !shelf.isStaging)
        .map((shelf) => shelf.zoneCode),
    ),
  ).sort();
}

export function getRackCodesForZone(
  shelves: WarehouseShelf[],
  zoneCode: string | "ALL",
) {
  return Array.from(
    new Set(
      shelves
        .filter(
          (shelf) =>
            !shelf.isStaging && (zoneCode === "ALL" || shelf.zoneCode === zoneCode),
        )
        .map((shelf) => shelf.rackCode),
    ),
  ).sort();
}

export function groupShelvesByRack(
  shelves: WarehouseShelf[],
  options?: {
    rackCode?: string | "ALL";
    zoneCode?: string | "ALL";
  },
) {
  const rackCode = options?.rackCode ?? "ALL";
  const zoneCode = options?.zoneCode ?? "ALL";
  const groups = new Map<string, RackGroup>();

  shelves
    .filter(
      (shelf) =>
        !shelf.isStaging &&
        (zoneCode === "ALL" || shelf.zoneCode === zoneCode) &&
        (rackCode === "ALL" || shelf.rackCode === rackCode),
    )
    .forEach((shelf) => {
      const id = `${shelf.zoneCode}:${shelf.rackCode}`;
      const current = groups.get(id);

      if (current) {
        current.shelves.push(shelf);
        return;
      }

      groups.set(id, {
        id,
        rackCode: shelf.rackCode,
        rackName: shelf.rackName,
        shelves: [shelf],
        warehouseCode: shelf.warehouseCode,
        zoneCode: shelf.zoneCode,
        zoneName: shelf.zoneName,
      });
    });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      shelves: group.shelves.sort((left, right) => right.level - left.level),
    }))
    .sort((left, right) =>
      `${left.zoneCode}-${left.rackCode}`.localeCompare(
        `${right.zoneCode}-${right.rackCode}`,
      ),
    );
}

export function describeShelfGranularity(shelf: WarehouseShelf) {
  if (shelf.isStaging) {
    return "Shelf staging chỉ là vị trí tạm sau GRN, không phải đích .";
  }

  return "Hiện shelf là barcode location nhỏ nhất";
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
      const sameSkuCluster =
        sku.toUpperCase().includes("CUP") && shelf.code === "A1-S02";

      return {
        shelf,
        capacity,
        reason: sameSkuCluster
          ? "same SKU cluster + gần staging + đủ chỗ"
          : "best-fit theo sức chứa còn lại của shelf",
        advisory: true,
        pathLabel: buildNavigationPath(shelf).join(" / "),
      };
    })
    .filter((suggestion) => suggestion.capacity >= quantity)
    .sort((left, right) => {
      const leftSameSku = Number(left.reason.includes("same SKU"));
      const rightSameSku = Number(right.reason.includes("same SKU"));

      if (leftSameSku !== rightSameSku) {
        return rightSameSku - leftSameSku;
      }

      return left.capacity - right.capacity;
    });
}

export function selectSuggestedShelf(suggestions: PutawaySuggestion[]) {
  return suggestions[0] ?? null;
}
