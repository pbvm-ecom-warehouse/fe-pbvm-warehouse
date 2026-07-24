import { z } from "zod";

export const printJobSchema = z
  .object({
    orderId: z.string().min(1, "Thiếu tham chiếu đơn hàng"),
    inputItemId: z.string().min(1, "Chọn SKU ly trắng"),
    outputItemId: z.string().min(1, "Chọn SKU ly đã in"),
    quantity: z.coerce.number().int().positive("Số lượng phải lớn hơn 0"),
    availableQty: z.coerce.number().int().nonnegative(),
    designId: z.string().min(1, "Thiếu designId cho ly in custom"),
    designFile: z.string().min(1, "Thiếu designFile snapshot"),
    printCostPerUnit: z.coerce.number().nonnegative("Chi phí in không được âm"),
    note: z.string().trim().max(240, "Ghi chú quá dài").optional(),
  })
  .superRefine((value, context) => {
    if (value.inputItemId === value.outputItemId) {
      context.addIssue({
        code: "custom",
        message: "SKU ly trắng và SKU ly in phải khác nhau",
        path: ["outputItemId"],
      });
    }

    if (value.quantity > value.availableQty) {
      context.addIssue({
        code: "custom",
        message: "Không đủ tồn ly trắng khả dụng cho in ly",
        path: ["quantity"],
      });
    }
  });

export const cupConversionSchema = printJobSchema;

export type PrintJobInput = z.infer<typeof printJobSchema>;
export type CupConversionInput = PrintJobInput;
