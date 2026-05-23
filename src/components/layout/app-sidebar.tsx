"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { dashboardRoutes } from "@/constants/routes";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const pathname = usePathname();
  const routes = dashboardRoutes.filter((route) => route.href !== "/login");

  return (
    <aside className="hidden min-h-screen w-64 shrink-0 border-r bg-sidebar px-3 py-4 lg:block">
      <div className="mb-6 px-2">
        <div className="text-sm font-semibold text-foreground">PBVM WMS</div>
        <div className="text-xs text-muted-foreground">
          Multi-warehouse admin
        </div>
      </div>
      <nav className="space-y-1">
        {routes.map((route) => {
          const active = pathname === route.href;
          const Icon = route.icon;

          return (
            <Button
              key={route.href}
              asChild
              variant={active ? "secondary" : "ghost"}
              className={cn("w-full justify-start", active && "bg-accent")}
            >
              <Link href={route.href}>
                <Icon data-icon="inline-start" />
                {route.label}
              </Link>
            </Button>
          );
        })}
      </nav>
      <div className="mt-8 rounded-lg border bg-background p-3 text-xs text-muted-foreground">
        Tồn kho khả dụng luôn được tính từ quantity - reserved_qty.
      </div>
      <Button asChild variant="ghost" className="mt-3 w-full justify-start">
        <Link href="/login">
          <LogOut data-icon="inline-start" />
          Đăng xuất
        </Link>
      </Button>
    </aside>
  );
}
