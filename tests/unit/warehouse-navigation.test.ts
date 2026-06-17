import { describe, expect, it } from "vitest";

import {
  buildNavigationPath,
  describeShelfGranularity,
  fallbackPutawaySuggestions,
  selectSuggestedShelf,
} from "@/features/warehouse-navigation/utils/putaway-navigation";

describe("warehouse put-away navigation", () => {
  it("returns advisory fallback suggestions with capacity and reason", () => {
    const suggestions = fallbackPutawaySuggestions({
      sku: "CUP-BLANK-500",
      quantity: 80,
      warehouseId: "central",
    });

    expect(suggestions[0]?.advisory).toBe(true);
    expect(suggestions[0]?.capacity).toBeGreaterThanOrEqual(80);
    expect(suggestions[0]?.reason).toMatch(/best-fit|same SKU/i);
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

  it("documents shelf as the smallest barcode location for current model", () => {
    const suggestion = selectSuggestedShelf(
      fallbackPutawaySuggestions({
        sku: "CUP-BLANK-500",
        quantity: 80,
        warehouseId: "central",
      }),
    );

    expect(describeShelfGranularity(suggestion!.shelf)).toMatch(/barcode location nhỏ nhất/i);
  });
});
