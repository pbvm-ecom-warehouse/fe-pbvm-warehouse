import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { SessionUser } from "@/lib/auth";

type AuthState = {
  user: SessionUser | null;
  setUser: (user: SessionUser | null) => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
    }),
    {
      name: "wms-auth",
    },
  ),
);
