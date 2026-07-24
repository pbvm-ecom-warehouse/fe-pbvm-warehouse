import { create } from "zustand";
import { persist } from "zustand/middleware";

import { sessionUserFromClaims, type SessionUser } from "@/lib/auth";
import { normalizeRoles } from "@/lib/rbac";

type AuthState = {
  hasHydrated: boolean;
  user: SessionUser | null;
  clearUser: () => void;
  setHasHydrated: (hasHydrated: boolean) => void;
  setUser: (user: SessionUser | null) => void;
};

type PersistedUser = Partial<SessionUser> & {
  role?: unknown;
  roles?: unknown;
};

function migrateUser(user: unknown): SessionUser | null {
  if (!user || typeof user !== "object") {
    return null;
  }

  const persistedUser = user as PersistedUser;
  const roles = normalizeRoles(persistedUser.roles ?? persistedUser.role);

  if (roles.length === 0) {
    return null;
  }

  return sessionUserFromClaims(
    {
      avatarUrl: persistedUser.avatarUrl,
      email: persistedUser.email,
      id: persistedUser.id,
      name: persistedUser.name,
      roles,
      tenantId: persistedUser.tenantId,
      type: persistedUser.type ?? "user",
    },
    persistedUser.tenantId,
  );
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      hasHydrated: false,
      user: null,
      clearUser: () => set({ user: null }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
      setUser: (user) => set({ user }),
    }),
    {
      name: "wms-auth",
      version: 2,
      partialize: (state) => ({ user: state.user }),
      migrate: (persistedState) => {
        const state = persistedState as { user?: unknown } | undefined;
        return { user: migrateUser(state?.user) };
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
