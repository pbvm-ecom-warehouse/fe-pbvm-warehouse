"use client";

import { type ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";

import { DashboardHeader } from "@/components/layout/dashboard-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardAccessBoundary } from "@/features/admin-shell/components/dashboard-access-boundary";
import { useAuthStore } from "@/stores/auth-store";

export function DashboardShell({ children }: { children: ReactNode }) {
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const user = useAuthStore((state) => state.user);
  const router = useRouter();

  useEffect(() => {
    if (hasHydrated && !user) {
      router.replace("/login");
    }
  }, [hasHydrated, router, user]);

  if (!hasHydrated) {
    return (
      <div className="min-h-screen bg-background px-4 py-5 sm:px-5 lg:px-6">
        <div className="mx-auto flex w-full max-w-[1500px] gap-4">
          <Skeleton className="hidden h-[calc(100vh-40px)] w-[260px] rounded-xl lg:block" />
          <div className="min-w-0 flex-1 space-y-4">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton className="h-32 rounded-xl" key={index} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <AppSidebar />
        <div className="min-w-0 flex-1 lg:pl-0">
          <DashboardHeader />
          <main className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-5 lg:px-6">
            <DashboardAccessBoundary>{children}</DashboardAccessBoundary>
          </main>
        </div>
      </div>
    </div>
  );
}
