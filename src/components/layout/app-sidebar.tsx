"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { Building2 } from "lucide-react";

import { WmsLogo } from "@/components/brand/wms-logo";
import { SheetClose } from "@/components/ui/sheet";
import { dashboardRoutes } from "@/constants/routes";
import { useSessionUser } from "@/hooks/use-session-user";
import { getAllowedRoutes, getDefaultRoleFocus, ROLE_LABELS } from "@/lib/rbac";
import { cn } from "@/lib/utils";

type SidebarContentProps = {
  closeOnNavigate?: boolean;
};

function NavLink({
  active,
  children,
  closeOnNavigate,
  href,
}: {
  active: boolean;
  children: React.ReactNode;
  closeOnNavigate?: boolean;
  href: string;
}) {
  const link = (
    <Link
      className={cn(
        "group flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-sidebar-foreground/72 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        active &&
          "bg-sidebar-accent text-sidebar-accent-foreground shadow-[0_12px_28px_-22px_rgba(79,70,229,0.55)]",
      )}
      href={href}
    >
      {children}
    </Link>
  );

  if (closeOnNavigate) {
    return <SheetClose asChild>{link}</SheetClose>;
  }

  return link;
}

export function SidebarContent({ closeOnNavigate }: SidebarContentProps) {
  const pathname = usePathname();
  const user = useSessionUser();
  const primaryRole = getDefaultRoleFocus(user?.roles);
  const routes = getAllowedRoutes(
    dashboardRoutes.filter((route) => route.href !== "/login"),
    user?.roles,
  );

  if (!user) {
    return null;
  }

  const settingsIndex = routes.findIndex((route) => route.href === "/settings");
  const warehouseLabel = "Mô hình vận hành";
  const warehouseName = "Kho trung tâm";

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar px-4 py-5 text-sidebar-foreground">
      <WmsLogo
        className="mb-8 px-1"
        size="sm"
        subtitle={`Khu vực làm việc ${ROLE_LABELS[primaryRole]}`}
      />

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        {routes.map((route) => {
          const active = pathname === route.href;
          const Icon = route.icon;
          const addDivider = route.href === "/settings" && settingsIndex > 0;

          return (
            <React.Fragment key={route.href}>
              {addDivider ? (
                <div className="my-4 h-px bg-sidebar-border" />
              ) : null}
              <NavLink
                active={active}
                closeOnNavigate={closeOnNavigate}
                href={route.href}
              >
                <Icon
                  className={cn(
                    "size-4 text-sidebar-foreground/55 transition-colors group-hover:text-sidebar-accent-foreground",
                    active && "text-sidebar-accent-foreground",
                  )}
                />
                {route.label}
              </NavLink>
            </React.Fragment>
          );
        })}
      </nav>

      <div className="mt-5">
        <div className="rounded-lg border border-sidebar-border bg-card p-3 shadow-[0_14px_32px_-28px_rgba(15,23,42,0.45)]">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Building2 className="size-3.5" />
            {warehouseLabel}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">
              {warehouseName}
            </div>
            <div className="text-xs text-muted-foreground">
              {user.name} · {ROLE_LABELS[primaryRole]}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppSidebar() {
  return (
    <aside className="hidden h-full w-[260px] shrink-0 border-r border-sidebar-border bg-sidebar lg:block">
      <SidebarContent />
    </aside>
  );
}
