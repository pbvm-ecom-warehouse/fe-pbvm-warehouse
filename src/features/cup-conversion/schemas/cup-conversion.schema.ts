import { z } from "zod";

export const cupConversionSchema = z
  .object({
    sourceProductId: z.string().min(1, "Chọn SKU ly chưa in"),
    targetProductId: z.string().min(1, "Chọn SKU ly đã in"),
    warehouseId: z.string().min(1, "Chọn kho xử lý"),
    quantity: z.coerce.number().int().positive("Số lượng phải lớn hơn 0"),
    availableQty: z.coerce.number().int().nonnegative(),
    printCampaignId: z.string().min(1, "Nhập mã chiến dịch in"),
    designFileUrl: z.string().url("URL thiết kế chưa hợp lệ"),
    printCostPerUnit: z.coerce.number().nonnegative("Chi phí in không được âm"),
  })
  .superRefine((value, context) => {
    if (value.sourceProductId === value.targetProductId) {
      context.addIssue({
        code: "custom",
        message: "SKU nguồn và SKU đích phải khác nhau",
        path: ["targetProductId"],
      });
    }

    if (value.quantity > value.availableQty) {
      context.addIssue({
        code: "custom",
        message: "Không đủ tồn khả dụng để convert",
        path: ["quantity"],
      });
    }
  });

export type CupConversionInput = z.infer<typeof cupConversionSchema>;
