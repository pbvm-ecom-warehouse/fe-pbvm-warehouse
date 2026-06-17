"use client";

import type { SessionUser } from "@/lib/auth";
import { useAuthStore } from "@/stores/auth-store";

export function useSessionUser(): SessionUser | null {
  return useAuthStore((state) => state.user);
}
