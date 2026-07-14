import { buildLayoutRoute } from "@/features/warehouse-layout/utils/warehouse-layout";
import type {
  PutawaySuggestion,
  ShelfContentItem,
  WarehouseRoute,
  WarehouseLayout,
  WarehouseRoutePoint,
  WarehouseShelf,
} from "@/types/api";

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

export type RackFootprint = {
  id: string;
  rackCode: string;
  rackName: string;
  warehouseCode: string;
  zoneCode: string;
  zoneName: string;
  shelfCount: number;
  x: number;
  y: number;
  width: number;
  height: number;
  center: {
    x: number;
    y: number;
  };
  shelves: WarehouseShelf[];
};

export type VisualShelfBoxPlacement = {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  rotationDeg: number;
  label: string;
  estimated: boolean;
};

export const GATE_ROUTE_POINT: WarehouseRoutePoint = {
  code: "GATE-01",
  label: "Cổng vào",
  x: 34,
  y: 318,
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

function clampPercent(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function buildNavigationPath(shelf: WarehouseShelf) {
  return [shelf.warehouseCode, shelf.zoneName, shelf.rackName, shelf.code];
}

export function getShelfCenter(shelf: WarehouseShelf): WarehouseRoutePoint {
  return {
    code: shelf.code,
    label: shelf.code,
    x: shelf.x + shelf.width / 2,
    y: shelf.y + shelf.height / 2,
  };
}

export function buildRouteToShelf(shelf: WarehouseShelf): WarehouseRoute {
  const target = getShelfCenter(shelf);
  const aislePoint: WarehouseRoutePoint = {
    code: `AISLE-${shelf.rackCode}`,
    label: `Lối ${shelf.rackName}`,
    x: target.x,
    y: Math.max(GATE_ROUTE_POINT.y - 34, target.y + shelf.height),
  };

  return {
    from: GATE_ROUTE_POINT,
    to: target,
    waypoints: [GATE_ROUTE_POINT, aislePoint, target],
    distanceMeters: Math.max(
      1,
      Math.round(
        (Math.abs(GATE_ROUTE_POINT.x - aislePoint.x) +
          Math.abs(GATE_ROUTE_POINT.y - aislePoint.y) +
          Math.abs(aislePoint.x - target.x) +
          Math.abs(aislePoint.y - target.y)) /
          8,
      ),
    ),
    instructions: [
      `Bắt đầu tại ${GATE_ROUTE_POINT.label}`,
      `Đi theo lối ${shelf.rackName}`,
      `Dừng tại shelf ${shelf.code}`,
    ],
  };
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

export function getRackFootprints(shelves: WarehouseShelf[]) {
  return groupShelvesByRack(shelves).map((group): RackFootprint => {
    const left = Math.min(...group.shelves.map((shelf) => shelf.x));
    const top = Math.min(...group.shelves.map((shelf) => shelf.y));
    const right = Math.max(
      ...group.shelves.map((shelf) => shelf.x + shelf.width),
    );
    const bottom = Math.max(
      ...group.shelves.map((shelf) => shelf.y + shelf.height),
    );
    const width = right - left;
    const height = bottom - top;

    return {
      id: group.id,
      rackCode: group.rackCode,
      rackName: group.rackName,
      warehouseCode: group.warehouseCode,
      zoneCode: group.zoneCode,
      zoneName: group.zoneName,
      shelfCount: group.shelves.length,
      x: left,
      y: top,
      width,
      height,
      center: {
        x: left + width / 2,
        y: top + height / 2,
      },
      shelves: group.shelves,
    };
  });
}

export function describeShelfGranularity(shelf: WarehouseShelf) {
  if (shelf.isStaging) {
    return "Khu nhận tạm chỉ dùng sau khi nhập hàng, không phải vị trí cất hàng cuối.";
  }

  return "Hiện vị trí kệ là đơn vị nhỏ nhất có mã vạch";
}

export function normalizeShelfBoxPlacement(
  item: ShelfContentItem,
  index: number,
): VisualShelfBoxPlacement {
  if (item.placement) {
    const x = clampPercent(item.placement.x, 0, 96);
    const y = clampPercent(item.placement.y, 0, 92);
    const width = clampPercent(item.placement.width, 4, 100 - x);
    const height = clampPercent(item.placement.height, 6, 100 - y);

    return {
      x,
      y,
      z: item.placement.z ?? 0,
      width,
      height,
      depth: clampPercent(item.placement.depth ?? item.dimensions?.depthCm ?? 12, 4, 28),
      rotationDeg: item.placement.rotationDeg ?? 0,
      label: item.placement.label ?? item.sku,
      estimated: false,
    };
  }

  const column = index % 3;
  const row = Math.floor(index / 3);
  const width = 26;
  const height = 24;
  const x = 5 + column * 31;
  const y = 10 + row * 30;

  return {
    x: clampPercent(x, 0, 100 - width),
    y: clampPercent(y, 0, 100 - height),
    z: 0,
    width,
    height,
    depth: clampPercent(item.dimensions?.depthCm ?? 10, 4, 24),
    rotationDeg: 0,
    label: item.sku,
    estimated: true,
  };
}

function parseShelfLevel(code: string, fallback: number) {
  const match = code.match(/(?:S|T)(\d+)$/i);
  const parsed = match ? Number.parseInt(match[1], 10) : Number.NaN;

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function layoutToWarehouseShelves(layout: WarehouseLayout) {
  const zonesById = new Map(layout.zones.map((zone) => [zone.id, zone]));

  return layout.racks.flatMap((rack): WarehouseShelf[] => {
    const zone = zonesById.get(rack.zoneId);
    const zoneCode = zone?.code ?? rack.zoneId;
    const zoneName = zone?.name ?? zoneCode;
    const levelCount = Math.max(1, rack.levelCount);

    return rack.shelfCodes.map((code, index) => {
      const level = parseShelfLevel(code, index + 1);
      const visualTop = rack.yM + (levelCount - level) * (rack.depthM + 0.2);

      return {
        id: `${layout.warehouseId}-${rack.id}-${code}`,
        barcode: code,
        code,
        fillFactor: undefined,
        height: rack.depthM,
        innerDepth: Math.round(rack.depthM * 100),
        innerHeight: undefined,
        innerWidth: Math.round((rack.widthM * 100) / Math.max(1, rack.bayCount)),
        isStaging: false,
        level,
        rackCode: rack.code,
        rackName: rack.name,
        warehouseCode: layout.warehouseId,
        warehouseId: layout.warehouseId,
        width: rack.widthM,
        x: rack.xM,
        y: visualTop,
        zoneCode,
        zoneName,
      };
    });
  });
}

export function buildLayoutPutawaySuggestions({
  layout,
  suggestions,
}: {
  layout: WarehouseLayout;
  suggestions: Array<{ capacity: number; shelfCode: string }>;
}): PutawaySuggestion[] {
  const shelvesByCode = new Map(
    layoutToWarehouseShelves(layout).map((shelf) => [shelf.code, shelf]),
  );

  return suggestions.flatMap((suggestion): PutawaySuggestion[] => {
    const shelf = shelvesByCode.get(suggestion.shelfCode);
    const rack = shelf
      ? layout.racks.find((item) => item.code === shelf.rackCode)
      : undefined;

    if (!shelf) {
      return [];
    }

    const route = rack ? buildLayoutRoute(layout, rack.code, shelf.code) : null;

    return [
      {
        advisory: true,
        capacity: suggestion.capacity,
        pathLabel: buildNavigationPath(shelf).join(" / "),
        reason: "Gợi ý từ WMS theo sức chứa còn lại",
        ...(route ? { route } : {}),
        shelf,
      },
    ];
  });
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
          : "Vừa sức chứa còn lại của vị trí kệ",
        advisory: true,
        pathLabel: buildNavigationPath(shelf).join(" / "),
        route: buildRouteToShelf(shelf),
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

