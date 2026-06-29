import { z } from "zod";

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, "Thiếu mật khẩu hiện tại"),
  newPassword: z.string().min(8, "Mật khẩu mới cần ít nhất 8 ký tự"),
});

export type ChangePasswordFormInput = z.infer<typeof changePasswordSchema>;
