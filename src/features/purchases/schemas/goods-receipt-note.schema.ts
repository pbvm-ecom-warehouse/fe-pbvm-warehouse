import { z } from "zod";

import {
  formatLotNumber,
  isCalendarDate,
  LOT_NUMBER_PATTERN,
  normalizeLotSequence,
  todayInHoChiMinh,
} from "../utils/lot-number";

const goodsReceiptItemFormSchema = z
  .object({
    actualQty: z.coerce
      .number()
      .int("Số thùng thực nhận phải là số nguyên")
      .positive("Số thùng thực nhận phải lớn hơn 0"),
    expiryDate: z.string().trim().optional().default(""),
    isPerishable: z.boolean(),
    itemId: z.string().trim().min(1, "Thiếu mặt hàng"),
    itemName: z.string().trim().optional().default(""),
    lotNumber: z
      .string()
      .trim()
      .regex(LOT_NUMBER_PATTERN, "Số lô phải có dạng LOT-YYMMDD-SEQ"),
    lotSequence: z
      .string()
      .trim()
      .refine(
        (value) => Boolean(normalizeLotSequence(value)),
        "SEQ phải là số từ 001 đến 999",
      ),
    manufacturedDate: z
      .string()
      .trim()
      .min(1, "Mọi mặt hàng cần có ngày sản xuất")
      .refine(isCalendarDate, "Ngày sản xuất không hợp lệ"),
    note: z.string().trim().max(240, "Ghi chú quá dài").optional().default(""),
    sku: z.string().trim().min(1, "Thiếu SKU"),
  })
  .superRefine((value, context) => {
    if (value.manufacturedDate && value.manufacturedDate > todayInHoChiMinh()) {
      context.addIssue({
        code: "custom",
        message: "Ngày sản xuất không được sau ngày hiện tại",
        path: ["manufacturedDate"],
      });
    }

    const expectedLotNumber = formatLotNumber(
      value.manufacturedDate,
      value.lotSequence,
    );
    if (expectedLotNumber && value.lotNumber !== expectedLotNumber) {
      context.addIssue({
        code: "custom",
        message: "Ngày trong số lô không khớp ngày sản xuất và SEQ",
        path: ["lotNumber"],
      });
    }

    if (value.isPerishable && !value.expiryDate) {
      context.addIssue({
        code: "custom",
        message: `Mặt hàng ${value.itemName || value.sku} có hạn sử dụng — cần nhập hạn sử dụng`,
        path: ["expiryDate"],
      });
    }

    if (
      value.isPerishable &&
      value.expiryDate &&
      value.manufacturedDate &&
      value.expiryDate <= value.manufacturedDate
    ) {
      context.addIssue({
        code: "custom",
        message: "Hạn sử dụng phải sau ngày sản xuất",
        path: ["expiryDate"],
      });
    }
  });

export const createGoodsReceiptNoteFormSchema = z
  .object({
    items: z
      .array(goodsReceiptItemFormSchema)
      .min(1, "Phiếu nhập cần ít nhất một dòng hàng"),
    purchaseOrderId: z.string().trim().min(1, "Chọn một đơn mua"),
  })
  .superRefine((value, context) => {
    const seen = new Set<string>();
    value.items.forEach((item, index) => {
      const key = `${item.itemId}:${item.lotNumber}`;
      if (seen.has(key)) {
        context.addIssue({
          code: "custom",
          message: "Mặt hàng bị trùng số lô trong cùng phiếu nhập",
          path: ["items", index, "lotNumber"],
        });
      }
      seen.add(key);
    });
  });

export type GoodsReceiptItemFormInput = z.infer<
  typeof goodsReceiptItemFormSchema
>;
export type CreateGoodsReceiptNoteFormInput = z.infer<
  typeof createGoodsReceiptNoteFormSchema
>;
