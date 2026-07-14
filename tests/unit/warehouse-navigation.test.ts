import { describe, expect, it } from "vitest";

import {
  GATE_ROUTE_POINT,
  buildLayoutPutawaySuggestions,
  buildLayoutShelfSuggestions,
  buildNavigationPath,
  buildRouteToShelf,
  describeShelfGranularity,
  fallbackPutawaySuggestions,
  getRackFootprints,
  layoutToWarehouseShelves,
  normalizeShelfBoxPlacement,
  selectSuggestedShelf,
} from "@/features/warehouse-navigation/utils/putaway-navigation";
import { fallbackWarehouseLayout } from "@/features/warehouse-layout/utils/warehouse-layout";

describe("warehouse put-away navigation", () => {
  it("returns advisory fallback suggestions with capacity and reason", () => {
    const suggestions = fallbackPutawaySuggestions({
      sku: "CUP-BLANK-500",
      quantity: 80,
      warehouseId: "central",
    });

    expect(suggestions[0]?.advisory).toBe(true);
    expect(suggestions[0]?.capacity).toBeGreaterThanOrEqual(80);
    expect(suggestions[0]?.reason).toMatch(/Vừa sức chứa|same SKU/i);
  });

  it("builds a scan path to the suggested shelf", () => {
    const suggestion = selectSuggestedShelf(
      fallbackPutawaySuggestions({
        sku: "CUP-BLANK-500",
        quantity: 80,
        warehouseId: "central",
      }),
    );

    expect(suggestion).toBeTruthy();
    expect(buildNavigationPath(suggestion!.shelf)).toEqual([
      "CENTRAL",
      "Zone A",
      "Rack A1",
      "A1-S02",
    ]);
    expect(suggestion!.shelf.level).toBe(2);
  });

  it("documents shelf as the smallest barcode-scanned location for current model", () => {
    const suggestion = selectSuggestedShelf(
      fallbackPutawaySuggestions({
        sku: "CUP-BLANK-500",
        quantity: 80,
        warehouseId: "central",
      }),
    );

    expect(describeShelfGranularity(suggestion!.shelf)).toMatch(/đơn vị nhỏ nhất có mã vạch/i);
  });

  it("builds a fallback route from gate to the shelf center", () => {
    const suggestion = selectSuggestedShelf(
      fallbackPutawaySuggestions({
        sku: "CUP-BLANK-500",
        quantity: 80,
        warehouseId: "central",
      }),
    );

    const route = buildRouteToShelf(suggestion!.shelf);

    expect(route.from).toEqual(GATE_ROUTE_POINT);
    expect(route.to.code).toBe("A1-S02");
    expect(route.to.x).toBe(suggestion!.shelf.x + suggestion!.shelf.width / 2);
    expect(route.to.y).toBe(suggestion!.shelf.y + suggestion!.shelf.height / 2);
    expect(route.waypoints.map((point) => point.code)).toEqual([
      "GATE-01",
      "AISLE-A1",
      "A1-S02",
    ]);
  });

  it("calculates rack footprints from shelf coordinates", () => {
    const footprints = getRackFootprints(
      fallbackPutawaySuggestions({
        sku: "CUP-BLANK-500",
        quantity: 1,
        warehouseId: "central",
      }).map((suggestion) => suggestion.shelf),
    );

    const rackA1 = footprints.find((footprint) => footprint.rackCode === "A1");

    expect(rackA1).toMatchObject({
      rackCode: "A1",
      rackName: "Rack A1",
      zoneCode: "A",
      shelfCount: 3,
      x: 72,
      width: 132,
    });
    expect(rackA1?.height).toBe(154);
    expect(rackA1?.center).toEqual({ x: 138, y: 183 });
  });

  it("normalizes API shelf box placement for the rack viewer", () => {
    const placement = normalizeShelfBoxPlacement(
      {
        id: "stock-1",
        sku: "CUP-BLANK-500",
        itemName: "Ly trắng 500ml",
        quantity: 24,
        unit: "cái",
        dimensions: { depthCm: 18 },
        placement: {
          x: 8,
          y: 12,
          z: 4,
          width: 36,
          height: 28,
          depth: 14,
          rotationDeg: 3,
          label: "LOT-A",
        },
      },
      0,
    );

    expect(placement).toMatchObject({
      depth: 14,
      estimated: false,
      height: 28,
      label: "LOT-A",
      rotationDeg: 3,
      width: 36,
      x: 8,
      y: 12,
      z: 4,
    });
  });

  it("auto-layouts shelf boxes when API placement is missing", () => {
    const placement = normalizeShelfBoxPlacement(
      {
        id: "stock-2",
        sku: "CUP-BLANK-500",
        itemName: "Ly trắng 500ml",
        quantity: 12,
        unit: "cái",
        placement: null,
      },
      4,
    );

    expect(placement.estimated).toBe(true);
    expect(placement.label).toBe("CUP-BLANK-500");
    expect(placement.x + placement.width).toBeLessThanOrEqual(100);
    expect(placement.y + placement.height).toBeLessThanOrEqual(100);
  });

  it("maps a published layout into scan-ready shelves", () => {
    const shelves = layoutToWarehouseShelves(fallbackWarehouseLayout);
    const shelf = shelves.find((item) => item.code === "A1-S02");

    expect(shelf).toMatchObject({
      barcode: "A1-S02",
      code: "A1-S02",
      level: 2,
      rackCode: "A1",
      warehouseId: "central",
      zoneCode: "A",
    });
    expect(shelf?.innerDepth).toBe(150);
    expect(shelf?.innerWidth).toBe(333);
  });

  it("builds visual suggestions from backend shelfCode/capacity payloads", () => {
    const suggestions = buildLayoutPutawaySuggestions({
      layout: fallbackWarehouseLayout,
      suggestions: [{ capacity: 120, shelfCode: "A1-S02" }],
    });

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      advisory: true,
      capacity: 120,
      pathLabel: "central / Zone A / Rack A1 / A1-S02",
      reason: "Gợi ý từ WMS theo sức chứa còn lại",
    });
    expect(suggestions[0]?.route?.to.code).toBe("A1-S02");
  });

  it("maps shared shelfCode suggestions for picking routes", () => {
    const suggestions = buildLayoutShelfSuggestions({
      layout: fallbackWarehouseLayout,
      reason: "Vị trí có hàng để lấy",
      suggestions: [{ capacity: 12, shelfCode: "A1-S02" }],
    });

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      capacity: 12,
      reason: "Vị trí có hàng để lấy",
      shelf: { code: "A1-S02" },
    });
    expect(suggestions[0]?.route?.to.code).toBe("A1-S02");
  });
});


