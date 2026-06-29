"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { LockKeyhole, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { useSessionUser } from "@/hooks/use-session-user";
import {
  getDefaultRoleFocus,
  getRouteAllowedRoles,
  hasRouteAccess,
  ROLE_LABELS,
} from "@/lib/rbac";

function ForbiddenState({
  allowedRoles,
  currentRole,
}: {
  allowedRoles: ReturnType<typeof getRouteAllowedRoles>;
  currentRole: ReturnType<typeof getDefaultRoleFocus>;
}) {
  return (
    <Card
      className="mx-auto mt-10 max-w-2xl border-amber-200 bg-amber-50/70"
      role="alert"
    >
      <CardHeader>
        <div className="mb-2 flex size-11 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
          <ShieldAlert className="size-5" />
        </div>
        <h2 className="font-heading text-base leading-snug font-semibold tracking-normal">
          Không có quyền truy cập module này
        </h2>
        <CardDescription className="text-amber-900/70">
          Role hiện tại là {ROLE_LABELS[currentRole]}. Module này chỉ mở cho
          các role phù hợp theo RBAC WMS.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {allowedRoles.map((role) => (
            <Badge className="bg-card text-amber-800" key={role} variant="outline">
              <LockKeyhole data-icon="inline-start" />
              {ROLE_LABELS[role]}
            </Badge>
          ))}
        </div>
        <Button asChild>
          <Link href="/dashboard">Về tổng quan phù hợp role</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function DashboardAccessBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const user = useSessionUser();
  const currentRole = getDefaultRoleFocus(user?.roles);

  if (!user) {
    return null;
  }

  if (!hasRouteAccess(pathname, user.roles)) {
    return (
      <ForbiddenState
        allowedRoles={getRouteAllowedRoles(pathname)}
        currentRole={currentRole}
      />
    );
  }

  return children;
}
