import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Email chưa hợp lệ"),
  password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự"),
  tenantId: z.string().min(1, "Thiếu tenant"),
});

export type LoginInput = z.infer<typeof loginSchema>;
