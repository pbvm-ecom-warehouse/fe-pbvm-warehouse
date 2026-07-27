import type {
  WarehouseLayout,
  WarehouseLayoutAisle,
  WarehouseLayoutRack,
  WarehouseLayoutZone,
} from "@/types/api";

export type LayoutRect = {
  xM: number;
  yM: number;
  widthM: number;
  heightM: number;
};

export function cloneWarehouseLayout(layout: WarehouseLayout): WarehouseLayout {
  return structuredClone(layout);
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
