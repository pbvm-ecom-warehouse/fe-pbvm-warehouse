import { describe, expect, it } from "vitest";

import {
  cloneWarehouseLayout,
  getRackRect,
  snapToGrid,
  validateWarehouseLayoutClient,
} from "@/features/warehouse-layout/utils/warehouse-layout";
import type { WarehouseLayout } from "@/types/api";

const editorLayout: WarehouseLayout = {
  id: "single-warehouse-layout",
  revision: 1,
  status: "PUBLISHED",
  updatedAt: "2026-07-27T00:00:00.000Z",
  canvas: { widthM: 40, heightM: 24, gridM: 0.5 },
  rackTemplate: { widthM: 10, depthM: 1.5, levelCount: 3, bayCount: 3 },
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
      id: "rack-a2",
      zoneId: "zone-a",
      code: "A2",
      name: "Rack A2",
      xM: 3,
      yM: 11,
      widthM: 10,
      depthM: 1.5,
      rotation: 0,
      levelCount: 2,
      bayCount: 3,
      shelfCodes: ["A2-S01", "A2-S02"],
      accessPoint: { xM: 8, yM: 10 },
    },
  ],
  shelves: [],
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
  ],
  gates: [
    {
      id: "gate-01",
      code: "GATE-01",
      label: "Cổng vào",
      xM: 20,
      yM: 23,
    },
  ],
};

describe("warehouse architectural layout", () => {
  it("keeps main aisles wider than rack aisles", () => {
    const mainWidths = editorLayout.aisles
      .filter((aisle) => aisle.type === "MAIN")
      .map((aisle) => Math.min(aisle.widthM, aisle.heightM));
    const rackWidths = editorLayout.aisles
      .filter((aisle) => aisle.type === "RACK")
      .map((aisle) => Math.min(aisle.widthM, aisle.heightM));

    expect(Math.min(...mainWidths)).toBeGreaterThan(Math.max(...rackWidths));
    expect(
      validateWarehouseLayoutClient(editorLayout, {
        publishing: true,
      }),
    ).toEqual([]);
  });

  it("snaps editor coordinates and rotates rack footprints", () => {
    expect(snapToGrid(3.24, 0.5)).toBe(3);
    expect(snapToGrid(3.26, 0.5)).toBe(3.5);

    const rack = {
      ...editorLayout.racks[0],
      rotation: 90 as const,
    };

    expect(getRackRect(rack)).toMatchObject({
      widthM: rack.depthM,
      heightM: rack.widthM,
    });
  });

  it("báo rõ mã layout nào đang bị trùng", () => {
    const layout = cloneWarehouseLayout(editorLayout);
    layout.aisles.push({
      ...layout.aisles[1],
      id: "aisle-copy",
      code: "AISLE-A1",
      yM: 9,
    });

    expect(validateWarehouseLayoutClient(layout)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("AISLE-A1 đang bị dùng 2 lần"),
      ]),
    );
  });
  it("reports overlap errors before publish", () => {
    const layout = cloneWarehouseLayout(editorLayout);
    layout.racks[1].xM = layout.racks[0].xM;
    layout.racks[1].yM = layout.racks[0].yM;

    expect(validateWarehouseLayoutClient(layout, { publishing: true })).toEqual(
      expect.arrayContaining([expect.stringMatching(/chồng lên/)]),
    );
  });
});
