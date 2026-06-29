import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(1, "Thiếu username"),
  password: z.string().min(1, "Thiếu mật khẩu"),
});

export type LoginInput = z.infer<typeof loginSchema>;
