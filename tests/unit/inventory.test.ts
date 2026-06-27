import { describe, expect, it } from "vitest";

import {
  calculateAvailableQty,
  getMoveTypeLabel,
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

  it("labels documented WMS movement types", () => {
    expect(getMoveTypeLabel("RECEIVE")).toBe("Nhập kho");
    expect(getMoveTypeLabel("PUTAWAY")).toBe("Xếp hàng lên kệ");
    expect(getMoveTypeLabel("ISSUE")).toBe("Xuất kho");
    expect(getMoveTypeLabel("ADJUST")).toBe("Điều chỉnh kiểm kê");
    expect(getMoveTypeLabel("SCRAP")).toBe("Hủy hàng");
  });
});
