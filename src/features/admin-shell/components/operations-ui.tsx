import { type ReactNode } from "react";
import { AlertCircle, Inbox } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function PageHeader({
  actions,
  eyebrow,
  title,
}: {
  actions?: ReactNode;
  eyebrow?: ReactNode;
  title: string;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        {eyebrow ? <div className="mb-2">{eyebrow}</div> : null}
        <h1 className="font-heading text-2xl font-semibold tracking-normal text-foreground">
          {title}
        </h1>
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

export function TablePanel({
  action,
  children,
  className,
  count,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  count?: ReactNode;
  title: ReactNode;
}) {
  return (
    <Card className={cn("gap-0", className)}>
      <CardHeader className="border-b bg-muted/25 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">{title}</CardTitle>
          <div className="flex items-center gap-2">
            {count ? (
              <div className="font-mono text-xs font-medium text-muted-foreground">
                {count}
              </div>
            ) : null}
            {action}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">{children}</CardContent>
    </Card>
  );
}

export function EntityDrawer({
  children,
  description,
  onOpenChange,
  open,
  title,
}: {
  children: ReactNode;
  description?: ReactNode;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:w-3/4" size="lg">
        <SheetHeader className="border-b bg-muted/25 pr-12">
          <SheetTitle>{title}</SheetTitle>
          {description ? (
            <SheetDescription>{description}</SheetDescription>
          ) : null}
        </SheetHeader>
        <div className="flex-1 p-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

export function EmptyState({
  action,
  description,
  title,
}: {
  action?: ReactNode;
  description?: ReactNode;
  title: ReactNode;
}) {
  return (
    <div className="flex min-h-28 flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/15 px-4 py-6 text-center">
      <Inbox className="mb-2 size-5 text-muted-foreground" />
      <div className="text-sm font-semibold text-foreground">{title}</div>
      {description ? (
        <div className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">
          {description}
        </div>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function PermissionNotice({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  const className = {
    danger: "border-rose-200 bg-rose-50 text-rose-700",
    info: "border-blue-200 bg-blue-50 text-blue-700",
    neutral: "border-slate-200 bg-slate-50 text-slate-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
  }[tone];

  return (
    <Badge className={cn("font-medium", className)} variant="outline">
      {children}
    </Badge>
  );
}

export function TableSkeleton({
  columns = 5,
  rows = 5,
}: {
  columns?: number;
  rows?: number;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-border/70 p-3">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div className="flex gap-2" key={rowIndex}>
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <Skeleton
              className="h-7 min-w-0 flex-1 rounded-md"
              key={columnIndex}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
