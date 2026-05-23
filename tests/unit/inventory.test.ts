import { describe, expect, it } from "vitest";

import {
  calculateAvailableQty,
  getStockStatus,
} from "@/features/inventory/utils/stock";

describe("inventory stock helpers", () => {
  it("calculates available quantity from quantity and reserved quantity", () => {
    expect(calculateAvailableQty(120, 35)).toBe(85);
  });

  it("does not return negative available quantity", () => {
    expect(calculateAvailableQty(10, 50)).toBe(0);
  });

  it("marks low stock when available quantity is below reorder point", () => {
    expect(getStockStatus(100, 75, 30)).toBe("low");
  });
});
