import { describe, expect, it } from "vitest";

import { formatWarehouseItemListValue } from "@/features/products/utils/warehouse-item-format";

describe("warehouse item display formatting", () => {
  it("formats array/object values without leaking object strings", () => {
    const value = formatWarehouseItemListValue([
      "8938501234567",
      { barcode: "8938507654321", unit: "thùng" },
    ]);

    expect(value).toBe("8938501234567, barcode: 8938507654321, unit: thùng");
    expect(value).not.toContain("[object Object]");
  });

  it("returns an empty string for empty values", () => {
    expect(formatWarehouseItemListValue([])).toBe("");
    expect(formatWarehouseItemListValue(null)).toBe("");
  });
});
