import type {
  WarehouseLayout,
  WarehouseLayoutAisle,
  WarehouseLayoutRack,
  WarehouseLayoutZone,
  WarehouseRoute,
} from "@/types/api";

export type LayoutRect = {
  xM: number;
  yM: number;
  widthM: number;
  heightM: number;
};

export type RackConfigurationScope = "ZONE" | "WAREHOUSE";

export const fallbackWarehouseLayout: WarehouseLayout = {
  warehouseId: "central",
  revision: 1,
  status: "PUBLISHED",
  canvas: { widthM: 40, heightM: 24, gridM: 0.5 },
  zones: [
    {
      id: "zone-a",
      code: "A",
      name: "Zone A",
      xM: 1,
      yM: 1,
      widthM: 16,
      heightM: 22,
      rotation: 0,
    },
    {
      id: "zone-b",
      code: "B",
      name: "Zone B",
      xM: 23,
      yM: 1,
      widthM: 16,
      heightM: 22,
      rotation: 0,
    },
  ],
  racks: [
    {
      id: "rack-a1",
      zoneId: "zone-a",
      code: "A1",
      name: "Rack A1",
      xM: 3,
      yM: 3,
      widthM: 10,
      depthM: 1.5,
      rotation: 0,
      levelCount: 3,
      bayCount: 3,
      shelfCodes: ["A1-S01", "A1-S02", "A1-S03"],
      accessPoint: { xM: 8, yM: 6 },
    },
    {
      id: "rack-b1",
      zoneId: "zone-b",
      code: "B1",
      name: "Rack B1",
      xM: 25,
      yM: 3,
      widthM: 10,
      depthM: 1.5,
      rotation: 0,
      levelCount: 2,
      bayCount: 3,
      shelfCodes: ["B1-S01", "B1-S02"],
      accessPoint: { xM: 30, yM: 6 },
    },
    {
      id: "rack-b2",
      zoneId: "zone-b",
      code: "B2",
      name: "Rack B2",
      xM: 25,
      yM: 11,
      widthM: 10,
      depthM: 1.5,
      rotation: 0,
      levelCount: 1,
      bayCount: 3,
      shelfCodes: ["B2-S01"],
      accessPoint: { xM: 30, yM: 10 },
    },
  ],
  aisles: [
    {
      id: "main-01",
      code: "MAIN-01",
      type: "MAIN",
      xM: 18,
      yM: 0,
      widthM: 4,
      heightM: 24,
    },
    {
      id: "aisle-a1",
      code: "AISLE-A1",
      type: "RACK",
      xM: 1,
      yM: 6,
      widthM: 16,
      heightM: 2,
    },
    {
      id: "aisle-b1",
      code: "AISLE-B1",
      type: "RACK",
      xM: 23,
      yM: 6,
      widthM: 16,
      heightM: 2,
    },
    {
      id: "aisle-b2",
      code: "AISLE-B2",
      type: "RACK",
      xM: 23,
      yM: 9,
      widthM: 16,
      heightM: 2,
    },
  ],
  gates: [
    {
      id: "gate-01",
      code: "GATE-01",
      label: "Cổng vào",
      xM: 20,
      yM: 24,
    },
  ],
};

export function cloneWarehouseLayout(layout: WarehouseLayout): WarehouseLayout {
  return structuredClone(layout);
}

function buildShelfCodes(code: string, levelCount: number) {
  return Array.from(
    { length: levelCount },
    (_, index) => `${code}-S${String(index + 1).padStart(2, "0")}`,
  );
}

export function createDefaultWarehouseRack(
  zone: WarehouseLayoutZone,
  rackCount: number,
  id: string,
): WarehouseLayoutRack {
  const code = `R${rackCount + 1}`;
  const levelCount = 3;

  return {
    id,
    zoneId: zone.id,
    code,
    name: `Rack ${code}`,
    xM: zone.xM + 1,
    yM: zone.yM + 2 + rackCount * 2,
    widthM: 5,
    depthM: 1.5,
    rotation: 0,
    levelCount,
    bayCount: 1,
    shelfCodes: buildShelfCodes(code, levelCount),
    accessPoint: { xM: zone.xM + 3.5, yM: zone.yM + 4 },
  };
}

export function applyRackConfiguration(
  layout: WarehouseLayout,
  sourceRackId: string,
  scope: RackConfigurationScope,
): WarehouseLayout {
  const next = cloneWarehouseLayout(layout);
  const source = next.racks.find((rack) => rack.id === sourceRackId);

  if (!source) {
    return next;
  }

  next.racks = next.racks.map((rack) => {
    const isTarget =
      rack.id !== source.id &&
      (scope === "WAREHOUSE" || rack.zoneId === source.zoneId);

    if (!isTarget) {
      return rack;
    }

    return {
      ...rack,
      widthM: source.widthM,
      depthM: source.depthM,
      levelCount: source.levelCount,
      bayCount: source.bayCount,
      rotation: source.rotation,
      shelfCodes: buildShelfCodes(rack.code, source.levelCount),
    };
  });

  return next;
}

export function snapToGrid(value: number, gridM: number) {
  return Math.round(value / gridM) * gridM;
}

export function getZoneRect(zone: WarehouseLayoutZone): LayoutRect {
  return {
    xM: zone.xM,
    yM: zone.yM,
    widthM: zone.rotation === 90 ? zone.heightM : zone.widthM,
    heightM: zone.rotation === 90 ? zone.widthM : zone.heightM,
  };
}

export function getRackRect(rack: WarehouseLayoutRack): LayoutRect {
  return {
    xM: rack.xM,
    yM: rack.yM,
    widthM: rack.rotation === 90 ? rack.depthM : rack.widthM,
    heightM: rack.rotation === 90 ? rack.widthM : rack.depthM,
  };
}

export function getAisleRect(aisle: WarehouseLayoutAisle): LayoutRect {
  return {
    xM: aisle.xM,
    yM: aisle.yM,
    widthM: aisle.widthM,
    heightM: aisle.heightM,
  };
}

export function isRectInside(inner: LayoutRect, outer: LayoutRect) {
  return (
    inner.xM >= outer.xM &&
    inner.yM >= outer.yM &&
    inner.xM + inner.widthM <= outer.xM + outer.widthM &&
    inner.yM + inner.heightM <= outer.yM + outer.heightM
  );
}

export function doRectsOverlap(left: LayoutRect, right: LayoutRect) {
  return !(
    left.xM + left.widthM <= right.xM ||
    right.xM + right.widthM <= left.xM ||
    left.yM + left.heightM <= right.yM ||
    right.yM + right.heightM <= left.yM
  );
}

export function findLayoutRackForShelf(
  layout: WarehouseLayout,
  shelfCode: string | null,
) {
  return (
    layout.racks.find((rack) => shelfCode && rack.shelfCodes.includes(shelfCode)) ??
    null
  );
}

export function buildLayoutRoute(
  layout: WarehouseLayout,
  rackCode: string,
  shelfCode: string,
): WarehouseRoute | null {
  const gate = layout.gates[0];
  const rack = layout.racks.find((item) => item.code === rackCode);
  const mainAisle = layout.aisles.find((aisle) => aisle.type === "MAIN");

  if (!gate || !rack || !mainAisle) {
    return null;
  }

  const mainCenter = {
    x: mainAisle.xM + mainAisle.widthM / 2,
    y: mainAisle.yM + mainAisle.heightM / 2,
  };
  const mainVertical = mainAisle.heightM >= mainAisle.widthM;
  const crossPoint = mainVertical
    ? { x: mainCenter.x, y: rack.accessPoint.yM }
    : { x: rack.accessPoint.xM, y: mainCenter.y };
  const from = { code: gate.code, label: gate.label, x: gate.xM, y: gate.yM };
  const to = {
    code: shelfCode,
    label: shelfCode,
    x: rack.accessPoint.xM,
    y: rack.accessPoint.yM,
  };

  return {
    from,
    to,
    waypoints: [
      from,
      {
        code: mainAisle.code,
        label: "Đường chính",
        x: mainVertical ? mainCenter.x : gate.xM,
        y: mainVertical ? gate.yM : mainCenter.y,
      },
      {
        code: `TURN-${rack.code}`,
        label: `Rẽ vào ${rack.name}`,
        x: crossPoint.x,
        y: crossPoint.y,
      },
      to,
    ],
  };
}

export function validateWarehouseLayoutClient(
  layout: WarehouseLayout,
  options: { publishing?: boolean } = {},
) {
  const errors: string[] = [];
  const canvas: LayoutRect = {
    xM: 0,
    yM: 0,
    widthM: layout.canvas.widthM,
    heightM: layout.canvas.heightM,
  };
  const allCodes = [
    ...layout.zones,
    ...layout.racks,
    ...layout.aisles,
    ...layout.gates,
  ].map((item) => item.code.trim().toUpperCase());

  if (new Set(allCodes).size !== allCodes.length) {
    errors.push("Mã zone, rack, aisle và gate không được trùng.");
  }

  layout.zones.forEach((zone) => {
    if (!isRectInside(getZoneRect(zone), canvas)) {
      errors.push(`${zone.code} nằm ngoài boundary kho.`);
    }
  });

  layout.racks.forEach((rack) => {
    const zone = layout.zones.find((item) => item.id === rack.zoneId);
    if (!zone || !isRectInside(getRackRect(rack), getZoneRect(zone))) {
      errors.push(`${rack.code} phải nằm hoàn toàn trong zone.`);
    }
  });

  for (let index = 0; index < layout.racks.length; index += 1) {
    for (let next = index + 1; next < layout.racks.length; next += 1) {
      if (
        doRectsOverlap(
          getRackRect(layout.racks[index]),
          getRackRect(layout.racks[next]),
        )
      ) {
        errors.push(
          `${layout.racks[index].code} đang chồng lên ${layout.racks[next].code}.`,
        );
      }
    }
  }

  layout.aisles.forEach((aisle) => {
    if (!isRectInside(getAisleRect(aisle), canvas)) {
      errors.push(`${aisle.code} nằm ngoài boundary kho.`);
    }
    layout.racks.forEach((rack) => {
      if (doRectsOverlap(getAisleRect(aisle), getRackRect(rack))) {
        errors.push(`${aisle.code} đang chồng lên ${rack.code}.`);
      }
    });
  });

  const mainWidths = layout.aisles
    .filter((aisle) => aisle.type === "MAIN")
    .map((aisle) => Math.min(aisle.widthM, aisle.heightM));
  const rackWidths = layout.aisles
    .filter((aisle) => aisle.type === "RACK")
    .map((aisle) => Math.min(aisle.widthM, aisle.heightM));

  if (
    mainWidths.length > 0 &&
    rackWidths.length > 0 &&
    Math.min(...mainWidths) <= Math.max(...rackWidths)
  ) {
    errors.push("Đường chính phải rộng hơn lối đi giữa các rack.");
  }

  if (options.publishing) {
    if (layout.zones.length === 0 || layout.racks.length === 0) {
      errors.push("Layout publish cần ít nhất một zone và một rack.");
    }
    if (layout.gates.length === 0) {
      errors.push("Layout publish cần ít nhất một gate.");
    }
    if (mainWidths.length === 0) {
      errors.push("Layout publish cần ít nhất một đường chính.");
    }
  }

  return Array.from(new Set(errors));
}
