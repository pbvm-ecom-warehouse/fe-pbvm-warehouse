import * as React from "react";

import { DashboardHeader } from "@/components/layout/dashboard-header";
import { AppSidebar } from "@/components/layout/app-sidebar";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/30">
      <div className="flex">
        <AppSidebar />
        <div className="min-w-0 flex-1">
          <DashboardHeader />
          <main className="mx-auto w-full max-w-7xl px-4 py-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
