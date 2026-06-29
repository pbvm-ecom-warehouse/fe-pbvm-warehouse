import { describe, expect, it } from "vitest";

import {
  applyRackConfiguration,
  buildLayoutRoute,
  cloneWarehouseLayout,
  createDefaultWarehouseRack,
  fallbackWarehouseLayout,
  getRackRect,
  snapToGrid,
  validateWarehouseLayoutClient,
} from "@/features/warehouse-layout/utils/warehouse-layout";

describe("warehouse architectural layout", () => {
  it("creates new racks with one bay by default", () => {
    const rack = createDefaultWarehouseRack(
      fallbackWarehouseLayout.zones[0],
      3,
      "rack-new",
    );

    expect(rack).toMatchObject({
      id: "rack-new",
      code: "R4",
      bayCount: 1,
    });
  });

  it("applies rack configuration only inside the source zone", () => {
    const layout = cloneWarehouseLayout(fallbackWarehouseLayout);
    const source = layout.racks.find((rack) => rack.id === "rack-b1")!;
    Object.assign(source, {
      widthM: 7,
      depthM: 2,
      levelCount: 4,
      bayCount: 1,
      rotation: 90,
    });
    const untouchedRack = structuredClone(layout.racks[0]);
    const targetBefore = structuredClone(layout.racks[2]);

    const result = applyRackConfiguration(layout, source.id, "ZONE");
    const target = result.racks.find((rack) => rack.id === "rack-b2")!;

    expect(result.racks[0]).toEqual(untouchedRack);
    expect(target).toMatchObject({
      id: targetBefore.id,
      zoneId: targetBefore.zoneId,
      code: targetBefore.code,
      name: targetBefore.name,
      xM: targetBefore.xM,
      yM: targetBefore.yM,
      accessPoint: targetBefore.accessPoint,
      widthM: 7,
      depthM: 2,
      levelCount: 4,
      bayCount: 1,
      rotation: 90,
      shelfCodes: ["B2-S01", "B2-S02", "B2-S03", "B2-S04"],
    });
    expect(layout.racks[2]).toEqual(targetBefore);
  });

  it("applies rack configuration across the warehouse", () => {
    const layout = cloneWarehouseLayout(fallbackWarehouseLayout);
    const source = layout.racks[0];
    Object.assign(source, {
      widthM: 8,
      depthM: 1,
      levelCount: 2,
      bayCount: 2,
      rotation: 90,
    });

    const result = applyRackConfiguration(layout, source.id, "WAREHOUSE");

    expect(result.racks.filter((rack) => rack.id !== source.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "B1",
          widthM: 8,
          depthM: 1,
          levelCount: 2,
          bayCount: 2,
          rotation: 90,
          shelfCodes: ["B1-S01", "B1-S02"],
        }),
        expect.objectContaining({
          code: "B2",
          widthM: 8,
          depthM: 1,
          levelCount: 2,
          bayCount: 2,
          rotation: 90,
          shelfCodes: ["B2-S01", "B2-S02"],
        }),
      ]),
    );
  });

  it("keeps main aisles wider than rack aisles", () => {
    const mainWidths = fallbackWarehouseLayout.aisles
      .filter((aisle) => aisle.type === "MAIN")
      .map((aisle) => Math.min(aisle.widthM, aisle.heightM));
    const rackWidths = fallbackWarehouseLayout.aisles
      .filter((aisle) => aisle.type === "RACK")
      .map((aisle) => Math.min(aisle.widthM, aisle.heightM));

    expect(Math.min(...mainWidths)).toBeGreaterThan(Math.max(...rackWidths));
    expect(
      validateWarehouseLayoutClient(fallbackWarehouseLayout, {
        publishing: true,
      }),
    ).toEqual([]);
  });

  it("snaps editor coordinates and rotates rack footprints", () => {
    expect(snapToGrid(3.24, 0.5)).toBe(3);
    expect(snapToGrid(3.26, 0.5)).toBe(3.5);

    const rack = {
      ...fallbackWarehouseLayout.racks[0],
      rotation: 90 as const,
    };

    expect(getRackRect(rack)).toMatchObject({
      widthM: rack.depthM,
      heightM: rack.widthM,
    });
  });

  it("builds a route from gate through the main aisle to rack access", () => {
    const route = buildLayoutRoute(
      fallbackWarehouseLayout,
      "A1",
      "A1-S02",
    );

    expect(route?.from.code).toBe("GATE-01");
    expect(route?.to.code).toBe("A1-S02");
    expect(route?.waypoints[1]?.code).toBe("MAIN-01");
    expect(route?.waypoints.at(-1)).toMatchObject({ x: 8, y: 6 });
  });

  it("reports overlap errors before publish", () => {
    const layout = cloneWarehouseLayout(fallbackWarehouseLayout);
    layout.racks[1].xM = layout.racks[2].xM;
    layout.racks[1].yM = layout.racks[2].yM;

    expect(validateWarehouseLayoutClient(layout, { publishing: true })).toEqual(
      expect.arrayContaining([expect.stringMatching(/chồng lên/)]),
    );
  });
});
