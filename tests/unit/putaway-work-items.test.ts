import { describe, expect, it } from "vitest";

import { buildPutawayWorkItems } from "@/features/warehouse-navigation/utils/putaway-work-items";
import type { GoodsReceiptNote } from "@/features/purchases/services/goods-receipt-note.service";
import type { PutawayTask } from "@/features/warehouse-navigation/services/putaway-task.service";

const receipt = {
  id: "grn-1",
  grnNumber: "GRN-001",
  status: "APPROVED",
  items: [
    {
      itemId: "item-1",
      sku: "SKU-CAFE",
      itemName: "Cà phê rang",
      barcode: "8930001",
      type: "DRY",
      actualQty: 8,
      lotNumber: "LOT-260728-001",
      manufacturedDate: "2026-07-28",
      expiryDate: "2027-07-28",
      itemDepth: 30,
      itemWidth: 20,
      itemHeight: 10,
    },
  ],
} as GoodsReceiptNote;

const task = {
  id: "task-1",
  grnId: "grn-1",
  status: "PENDING",
  items: [
    {
      itemId: "item-1",
      sku: "",
      quantity: 8,
      remainingQty: 5,
      lotId: "lot-1",
      lotNumber: "LOT-260728-001",
      packageSpec: {
        unit: "box",
        factor: 1,
        depthCm: 30,
        widthCm: 20,
        heightCm: 10,
        volumeCm3: 6000,
      },
    },
  ],
} as PutawayTask;

describe("put-away work item hydration", () => {
  it("hydrates a task line with GRN item metadata", () => {
    expect(buildPutawayWorkItems([task], [receipt])).toEqual([
      expect.objectContaining({
        key: "task-1:item-1:lot-1",
        taskId: "task-1",
        grnNumber: "GRN-001",
        sku: "SKU-CAFE",
        itemName: "Cà phê rang",
        barcode: "8930001",
        itemType: "DRY",
        lotNumber: "LOT-260728-001",
        manufacturedDate: "2026-07-28",
        remainingQty: 5,
        packageSpec: expect.objectContaining({ volumeCm3: 6000 }),
      }),
    ]);
  });

  it("can omit completed lines from the active work queue", () => {
    const completed = {
      ...task,
      items: [{ ...task.items[0], remainingQty: 0 }],
    };

    expect(buildPutawayWorkItems([completed], [receipt])).toHaveLength(0);
    expect(
      buildPutawayWorkItems([completed], [receipt], { includeCompleted: true }),
    ).toHaveLength(1);
  });
});
