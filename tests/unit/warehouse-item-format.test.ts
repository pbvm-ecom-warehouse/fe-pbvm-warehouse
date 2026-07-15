import { describe, expect, it } from "vitest";

import { formatWarehouseItemListValue } from "@/features/products/utils/warehouse-item-format";

describe("warehouse item display formatting", () => {
  it("formats array/object values without leaking object strings", () => {
    const value = formatWarehouseItemListValue([
      "8938501234567",
      { factor: 24, unit: "thùng" },
    ]);

    expect(value).toBe("8938501234567, thùng x24");
    expect(value).not.toContain("[object Object]");
    expect(value).not.toContain("unit:");
    expect(value).not.toContain("factor:");
  });

  it("returns an empty string for empty values", () => {
    expect(formatWarehouseItemListValue([])).toBe("");
    expect(formatWarehouseItemListValue(null)).toBe("");
  });
});
