import { describe, expect, it } from "vitest";

import { evaluateCellCapacity } from "@/features/warehouse-navigation/utils/cell-capacity";
import type { StorageCellView } from "@/features/warehouse-navigation/services/warehouse-operations.service";

function cell(overrides: Partial<StorageCellView> = {}): StorageCellView {
  return {
    id: "cell-1",
    rackId: "rack-1",
    shelfId: "shelf-1",
    level: 1,
    bay: 1,
    code: "A-01-01",
    barcode: "CELL-A-01-01",
    status: "ACTIVE",
    innerDepth: 100,
    innerWidth: 80,
    innerHeight: 60,
    usableVolumeCm3: 480000,
    occupiedVolumeCm3: 120000,
    fillPercent: 25,
    contents: [],
    ...overrides,
  };
}

const packageSpec = {
  depthCm: 30,
  widthCm: 20,
  heightCm: 10,
  volumeCm3: 6000,
};

describe("cell put-away capacity", () => {
  it("calculates whole boxes from remaining usable volume", () => {
    expect(evaluateCellCapacity(cell(), packageSpec)).toEqual(
      expect.objectContaining({
        dimensionFits: true,
        remainingPackages: 60,
        full: false,
      }),
    );
  });

  it("blocks a package that fails any inner dimension", () => {
    expect(evaluateCellCapacity(cell({ innerDepth: 20 }), packageSpec)).toEqual(
      expect.objectContaining({ dimensionFits: false, selectable: false }),
    );
  });

  it("treats blocked and full cells as view-only", () => {
    expect(
      evaluateCellCapacity(cell({ status: "BLOCKED" }), packageSpec),
    ).toEqual(expect.objectContaining({ locked: true, selectable: false }));
    expect(
      evaluateCellCapacity(
        cell({ occupiedVolumeCm3: 480000, fillPercent: 100 }),
        packageSpec,
      ),
    ).toEqual(expect.objectContaining({ full: true, selectable: false }));
  });

  it("allows an override only for an empty compatible cell", () => {
    expect(
      evaluateCellCapacity(cell(), packageSpec, { suggested: false }),
    ).toEqual(expect.objectContaining({ selectable: true, override: true }));
    expect(
      evaluateCellCapacity(
        cell({ contents: [{ id: "stock-1" }] as StorageCellView["contents"] }),
        packageSpec,
        { suggested: false },
      ),
    ).toEqual(expect.objectContaining({ selectable: false, override: false }));
  });
});
