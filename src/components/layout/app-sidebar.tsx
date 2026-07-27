"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { Building2, ChevronDown } from "lucide-react";

import { WmsLogo } from "@/components/brand/wms-logo";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { SheetClose } from "@/components/ui/sheet";
import {
  dashboardRoutes,
  ROUTE_GROUPS,
  type RouteGroupKey,
} from "@/constants/routes";
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
      aria-current={active ? "page" : undefined}
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

type DashboardRoute = (typeof dashboardRoutes)[number];

/** Gom các route liên tiếp có cùng `group` thành 1 khối — giữ nguyên thứ tự
 * xuất hiện trong dashboardRoutes, route không có `group` đứng riêng lẻ. */
function groupRoutes(routes: readonly DashboardRoute[]) {
  const items: (
    | { kind: "route"; route: DashboardRoute }
    | { kind: "group"; key: RouteGroupKey; routes: DashboardRoute[] }
  )[] = [];

  for (const route of routes) {
    const groupKey =
      "group" in route ? (route.group as RouteGroupKey) : undefined;
    const last = items[items.length - 1];

    if (groupKey && last?.kind === "group" && last.key === groupKey) {
      last.routes.push(route);
      continue;
    }

    if (groupKey) {
      items.push({ kind: "group", key: groupKey, routes: [route] });
      continue;
    }

    items.push({ kind: "route", route });
  }

  return items;
}

export function SidebarContent({ closeOnNavigate }: SidebarContentProps) {
  const pathname = usePathname();
  const user = useSessionUser();
  const primaryRole = getDefaultRoleFocus(user?.roles);
  const routes = getAllowedRoutes(
    dashboardRoutes.filter((route) => route.href !== "/login"),
    user?.roles,
  );
  const items = React.useMemo(() => groupRoutes(routes), [routes]);

  if (!user) {
    return null;
  }

  const warehouseLabel = "Mô hình vận hành";
  const warehouseName = "Kho trung tâm";
  const isRouteActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar px-4 py-5 text-sidebar-foreground">
      <WmsLogo
        className="mb-8 px-1"
        size="sm"
        subtitle={`Khu vực làm việc ${ROLE_LABELS[primaryRole]}`}
      />

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        {items.map((item) => {
          if (item.kind === "route") {
            const route = item.route;
            const active = isRouteActive(route.href);
            const Icon = route.icon;

            return (
              <NavLink
                active={active}
                closeOnNavigate={closeOnNavigate}
                href={route.href}
                key={route.href}
              >
                <Icon
                  className={cn(
                    "size-4 text-sidebar-foreground/55 transition-colors group-hover:text-sidebar-accent-foreground",
                    active && "text-sidebar-accent-foreground",
                  )}
                />
                {route.label}
              </NavLink>
            );
          }

          const groupMeta = ROUTE_GROUPS[item.key];
          const GroupIcon = groupMeta.icon;
          const groupActive = item.routes.some((route) =>
            isRouteActive(route.href),
          );

          return (
            <Collapsible defaultOpen={groupActive} key={item.key}>
              <CollapsibleTrigger
                className={cn(
                  "group/trigger flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold text-sidebar-foreground/72 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  groupActive && "text-sidebar-accent-foreground",
                )}
              >
                <GroupIcon
                  className={cn(
                    "size-4 text-sidebar-foreground/55 transition-colors group-hover/trigger:text-sidebar-accent-foreground",
                    groupActive && "text-sidebar-accent-foreground",
                  )}
                />
                <span className="flex-1 text-left">{groupMeta.label}</span>
                <ChevronDown className="size-4 text-sidebar-foreground/40 transition-transform group-data-[state=open]/trigger:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 py-1 pl-4">
                {item.routes.map((route) => {
                  const active = isRouteActive(route.href);
                  const Icon = route.icon;

                  return (
                    <NavLink
                      active={active}
                      closeOnNavigate={closeOnNavigate}
                      href={route.href}
                      key={route.href}
                    >
                      <Icon
                        className={cn(
                          "size-4 text-sidebar-foreground/55 transition-colors group-hover:text-sidebar-accent-foreground",
                          active && "text-sidebar-accent-foreground",
                        )}
                      />
                      {route.label}
                    </NavLink>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
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
