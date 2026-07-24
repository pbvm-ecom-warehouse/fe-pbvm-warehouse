import { describe, expect, it } from "vitest";

import { printJobSchema } from "@/features/cup-conversion/schemas/cup-conversion.schema";

describe("print job schema", () => {
  const validInput = {
    orderId: "order-2026-06-17-01",
    inputItemId: "cup-blank",
    outputItemId: "cup-printed",
    quantity: 1000,
    availableQty: 1200,
    designId: "design_tea_house",
    designFile: "snapshot://design_tea_house",
    printCostPerUnit: 320,
  };

  it("accepts a valid custom-print job request", () => {
    expect(printJobSchema.safeParse(validInput).success).toBe(true);
  });

  it("rejects a print job when input and output SKU are the same", () => {
    const result = printJobSchema.safeParse({
      ...validInput,
      outputItemId: "cup-blank",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a print job above available blank stock", () => {
    const result = printJobSchema.safeParse({
      ...validInput,
      quantity: 1500,
    });

    expect(result.success).toBe(false);
  });
});
