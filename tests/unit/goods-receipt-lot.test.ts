import { describe, expect, it } from "vitest";

import { createGoodsReceiptNoteFormSchema } from "@/features/purchases/schemas/goods-receipt-note.schema";
import {
  formatLotNumber,
  parseLotNumber,
} from "@/features/purchases/utils/lot-number";

function receiptItem(overrides: Record<string, unknown> = {}) {
  return {
    actualQty: "4",
    expiryDate: "",
    isPerishable: false,
    itemId: "item-1",
    itemName: "Hộp giấy kraft",
    lotNumber: "LOT-260728-001",
    lotSequence: "1",
    manufacturedDate: "2026-07-28",
    note: "",
    sku: "PKG-KRAFT",
    ...overrides,
  };
}

describe("quy tắc số lô phiếu nhập", () => {
  it("ghép ngày sản xuất và SEQ thành LOT-YYMMDD-SEQ", () => {
    expect(formatLotNumber("2026-07-28", "7")).toBe("LOT-260728-007");
    expect(formatLotNumber("2026-07-28", "999")).toBe("LOT-260728-999");
  });

  it("từ chối SEQ ngoài khoảng 001-999", () => {
    expect(formatLotNumber("2026-07-28", "0")).toBe("");
    expect(formatLotNumber("2026-07-28", "1000")).toBe("");
  });

  it("đọc số lô hợp lệ khi sửa phiếu DRAFT", () => {
    expect(parseLotNumber("LOT-260728-007")).toEqual({
      manufacturedDate: "2026-07-28",
      lotSequence: "7",
    });
    expect(parseLotNumber("legacy-lot")).toBeNull();
  });

  it("bắt buộc số lô cho cả hàng không có hạn sử dụng", () => {
    const result = createGoodsReceiptNoteFormSchema.safeParse({
      items: [
        receiptItem({
          lotNumber: "",
          lotSequence: "",
          manufacturedDate: "",
        }),
      ],
      purchaseOrderId: "po-1",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.at(-1))).toEqual(
      expect.arrayContaining(["manufacturedDate", "lotSequence", "lotNumber"]),
    );
  });

  it("chặn ngày trong mã lô không khớp ngày sản xuất", () => {
    const result = createGoodsReceiptNoteFormSchema.safeParse({
      items: [receiptItem({ lotNumber: "LOT-260729-001" })],
      purchaseOrderId: "po-1",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/không khớp/i);
  });

  it("chặn ngày sản xuất không hợp lệ hoặc ở tương lai", () => {
    const invalid = createGoodsReceiptNoteFormSchema.safeParse({
      items: [receiptItem({ manufacturedDate: "2026-02-30" })],
      purchaseOrderId: "po-1",
    });
    const future = createGoodsReceiptNoteFormSchema.safeParse({
      items: [
        receiptItem({
          lotNumber: "LOT-991231-001",
          manufacturedDate: "2099-12-31",
        }),
      ],
      purchaseOrderId: "po-1",
    });

    expect(invalid.success).toBe(false);
    expect(future.success).toBe(false);
  });

  it("chặn trùng item và số lô trong cùng phiếu", () => {
    const result = createGoodsReceiptNoteFormSchema.safeParse({
      items: [receiptItem(), receiptItem()],
      purchaseOrderId: "po-1",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.at(-1)?.message).toMatch(/trùng số lô/i);
  });
  it("chặn hạn sử dụng không sau ngày sản xuất", () => {
    const result = createGoodsReceiptNoteFormSchema.safeParse({
      items: [
        receiptItem({
          expiryDate: "2026-07-28",
          isPerishable: true,
        }),
      ],
      purchaseOrderId: "po-1",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/sau ngày sản xuất/i);
  });
});
