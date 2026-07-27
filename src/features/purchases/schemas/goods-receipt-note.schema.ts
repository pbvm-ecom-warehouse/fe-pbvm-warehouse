import { z } from "zod";

const goodsReceiptItemFormSchema = z
  .object({
    actualQty: z.coerce.number().positive("Số lượng thực nhập phải lớn hơn 0"),
    expiryDate: z.string().trim().optional().default(""),
    isPerishable: z.boolean(),
    itemId: z.string().trim().min(1, "Thiếu mặt hàng"),
    itemName: z.string().trim().optional().default(""),
    lotNumber: z.string().trim().optional().default(""),
    note: z.string().trim().max(240, "Ghi chú quá dài").optional().default(""),
    sku: z.string().trim().min(1, "Thiếu SKU"),
    unit: z.string().trim().min(1, "Thiếu đơn vị"),
  })
  .superRefine((value, context) => {
    if (value.isPerishable && !value.lotNumber) {
      context.addIssue({
        code: "custom",
        message: `Mặt hàng ${value.itemName || value.sku} có hạn sử dụng — cần nhập mã lô`,
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
  });

export const createGoodsReceiptNoteFormSchema = z.object({
  items: z
    .array(goodsReceiptItemFormSchema)
    .min(1, "Phiếu nhập cần ít nhất một dòng hàng"),
  purchaseOrderId: z.string().trim().min(1, "Chọn một đơn mua"),
});

export type GoodsReceiptItemFormInput = z.infer<
  typeof goodsReceiptItemFormSchema
>;
export type CreateGoodsReceiptNoteFormInput = z.infer<
  typeof createGoodsReceiptNoteFormSchema
>;
