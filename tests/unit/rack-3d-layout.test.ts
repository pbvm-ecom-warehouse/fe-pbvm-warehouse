import { describe, expect, it } from "vitest";

import {
  getRackMeasurements,
  packCellBoxes,
} from "@/features/warehouse-navigation/utils/rack-3d-layout";
import type { StorageCellView } from "@/features/warehouse-navigation/services/warehouse-operations.service";

function cell(overrides: Partial<StorageCellView> = {}): StorageCellView {
  return {
    id: "cell-1",
    rackId: "rack-1",
    shelfId: "shelf-1",
    level: 1,
    bay: 1,
    code: "RACK-01-T1-B1",
    barcode: "CELL-01",
    status: "ACTIVE",
    innerWidth: 200,
    innerDepth: 100,
    innerHeight: 100,
    usableVolumeCm3: 1_500_000,
    occupiedVolumeCm3: 500_000,
    fillPercent: 34,
    contents: [],
    ...overrides,
  };
}

describe("rack 3D layout", () => {
  it("derives the rack size from the designed cell dimensions", () => {
    const cells = [
      cell(),
      cell({ id: "cell-2", bay: 2 }),
      cell({ id: "cell-3", level: 2 }),
      cell({ id: "cell-4", level: 2, bay: 2 }),
    ];

    expect(getRackMeasurements(cells)).toMatchObject({
      widthM: 4,
      depthM: 1,
      heightM: 2,
      levels: 2,
      bays: 2,
    });
  });

  it("creates one correctly-sized 3D box per stored package until the cell is full", () => {
    const boxes = packCellBoxes(
      cell({
        contents: [
          {
            id: "inventory-1",
            sku: "SKU-01",
            itemName: "Thùng nhựa",
            unit: "thùng",
            quantity: 40,
            packageDepthCm: 40,
            packageWidthCm: 50,
            packageHeightCm: 25,
          },
        ],
      }),
    );

    expect(boxes).toHaveLength(32);
    expect(boxes[0]).toMatchObject({
      contentId: "inventory-1",
      sku: "SKU-01",
      size: [0.5, 0.25, 0.4],
      position: [-0.75, -0.375, -0.3],
    });
    expect(boxes[1].position).toEqual([-0.25, -0.375, -0.3]);
  });
});
