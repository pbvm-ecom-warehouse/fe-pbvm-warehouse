import { describe, expect, it } from "vitest";

import { cupConversionSchema } from "@/features/cup-conversion/schemas/cup-conversion.schema";

describe("cup conversion schema", () => {
  const validInput = {
    sourceProductId: "cup-plain",
    targetProductId: "cup-printed",
    warehouseId: "warehouse-1",
    quantity: 1000,
    availableQty: 1200,
    printCampaignId: "PRINT-SUMMER-26",
    designFileUrl: "https://assets.example/design.pdf",
    printCostPerUnit: 320,
  };

  it("accepts a valid plain-cup to printed-cup conversion", () => {
    expect(cupConversionSchema.safeParse(validInput).success).toBe(true);
  });

  it("rejects conversion when source and target SKU are the same", () => {
    const result = cupConversionSchema.safeParse({
      ...validInput,
      targetProductId: "cup-plain",
    });

    expect(result.success).toBe(false);
  });

  it("rejects conversion above available stock", () => {
    const result = cupConversionSchema.safeParse({
      ...validInput,
      quantity: 1500,
    });

    expect(result.success).toBe(false);
  });
});
