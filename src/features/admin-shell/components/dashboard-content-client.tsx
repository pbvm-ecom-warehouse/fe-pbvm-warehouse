"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ClipboardCheck,
  ClipboardList,
  MapPinned,
  PackageCheck,
  PackageSearch,
  Printer,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSessionUser } from "@/hooks/use-session-user";
import { listGoodsIssues } from "@/features/goods-issues/services/goods-issue.service";
import { listPurchaseOrders } from "@/features/purchases/services/purchase-order.service";
import { listGoodsReceiptNotes } from "@/features/purchases/services/goods-receipt-note.service";
import { listPrintJobs } from "@/features/print-jobs/services/print-job.service";
import { listWarehouseItems } from "@/features/products/services/warehouse-items.service";
import { listPutawayTasks } from "@/features/warehouse-navigation/services/putaway-task.service";
import {
  getDefaultRoleFocus,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  type WmsRole,
} from "@/lib/rbac";
import { cn } from "@/lib/utils";

type MetricTone = "primary" | "teal" | "amber" | "blue" | "rose";

type Metric = {
  detail: ReactNode;
  href: string;
  icon: LucideIcon;
  label: string;
  tone: MetricTone;
  value: string;
};

const toneClass: Record<MetricTone, string> = {
  amber: "bg-amber-50 text-amber-700 ring-amber-100",
  blue: "bg-blue-50 text-blue-700 ring-blue-100",
  primary: "bg-primary/10 text-primary ring-primary/15",
  rose: "bg-rose-50 text-rose-700 ring-rose-100",
  teal: "bg-teal-50 text-teal-700 ring-teal-100",
};

const toneBorderClass: Record<MetricTone, string> = {
  amber: "border-l-amber-300",
  blue: "border-l-blue-300",
  primary: "border-l-primary/40",
  rose: "border-l-rose-300",
  teal: "border-l-teal-300",
};

const rolePanelCopy: Record<WmsRole, { description: string; title: string }> = {
  ADMIN: {
    title: "Tổng quan vận hành kho",
    description: "Theo dõi các luồng chính đã kết nối dữ liệu thật.",
  },
  MANAGER: {
    title: "Bảng điều phối quản lý",
    description: "Theo dõi mua hàng, nhập kho, cất hàng và xuất kho.",
  },
  SHIPPER: {
    title: "Khu vực giao hàng",
    description: "Theo dõi vận đơn, bàn giao hàng và cập nhật trạng thái giao nhận.",
  },
  RECEIVER: {
    title: "Khu vực nhận hàng",
    description: "Tập trung phiếu nhập và task cất hàng cần xử lý.",
  },
  PICKER: {
    title: "Khu vực soạn hàng",
    description: "Theo dõi phiếu xuất và gợi ý lấy hàng theo vị trí.",
  },
  PRINTER: {
    title: "Khu vực in ly",
    description: "Xử lý các đơn in ly đã thanh toán.",
  },
  COUNTER: {
    title: "Khu vực kiểm kê",
    description: "Các chức năng kiểm kê sẽ hiển thị khi sẵn sàng.",
  },
};

function formatNumber(value: number | undefined) {
  return (value ?? 0).toLocaleString("vi-VN");
}

function MetricCard({ detail, href, icon: Icon, label, tone, value }: Metric) {
  return (
    <Card
      className={cn(
        "group overflow-hidden border-l-4 border-border/70 bg-card shadow-[0_18px_45px_-34px_rgba(15,23,42,0.55)] transition duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_24px_55px_-36px_rgba(30,64,175,0.55)]",
        toneBorderClass[tone],
      )}
    >
      <CardContent className="grid min-h-[156px] grid-cols-[56px_minmax(0,1fr)_32px] items-center gap-4 pt-1">
        <div
          className={cn(
            "flex size-14 shrink-0 items-center justify-center rounded-lg ring-1",
            toneClass[tone],
          )}
        >
          <Icon className="size-6" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold leading-snug text-foreground">
            {label}
          </div>
          <div className="mt-2 font-mono text-3xl font-bold leading-none text-foreground">
            {value}
          </div>
          <div className="mt-3 max-w-[24rem] text-sm leading-5 text-muted-foreground">
            {detail}
          </div>
        </div>
        <Button
          asChild
          className="opacity-80 transition group-hover:opacity-100"
          size="icon-sm"
          variant="outline"
        >
          <Link href={href}>
            <ArrowRight />
            <span className="sr-only">Mở {label}</span>
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function RoleFocusSwitcher({
  activeRole,
  onRoleChange,
  roles,
}: {
  activeRole: WmsRole;
  onRoleChange: (role: WmsRole) => void;
  roles: readonly WmsRole[];
}) {
  if (roles.length <= 1) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2" aria-label="Chọn vai trò đang xem">
      {roles.map((role) => (
        <Button
          aria-pressed={activeRole === role}
          className={activeRole === role ? "border-primary/40 bg-primary/10" : ""}
          key={role}
          onClick={() => onRoleChange(role)}
          size="sm"
          type="button"
          variant={activeRole === role ? "secondary" : "outline"}
        >
          {ROLE_LABELS[role]}
        </Button>
      ))}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5" role="status" aria-label="Đang tải trang tổng quan">
      <Skeleton className="h-44 w-full rounded-xl" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton className="h-40 rounded-xl" key={index} />
        ))}
      </div>
    </div>
  );
}

function DashboardError() {
  return (
    <div
      className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-4 text-sm font-medium text-amber-900"
      role="alert"
    >
      Chưa kết nối được một phần dữ liệu WMS. Tải lại trang hoặc đăng nhập lại.
    </div>
  );
}

function countFrom(data: { total: number; data: unknown[] } | undefined) {
  return data?.total ?? data?.data.length ?? 0;
}

export function DashboardContentClient() {
  const user = useSessionUser();
  const [selectedRole, setSelectedRole] = useState<WmsRole | null>(null);
  const userRoles = user?.roles ?? [];
  const activeRole =
    selectedRole && userRoles.includes(selectedRole)
      ? selectedRole
      : getDefaultRoleFocus(userRoles);

  const productsQuery = useQuery({
    queryFn: () =>
      listWarehouseItems({ isActive: "ALL", limit: 100, page: 1 }),
    queryKey: ["dashboard", "stock-items"],
  });
  const purchaseOrdersQuery = useQuery({
    queryFn: () => listPurchaseOrders({ limit: 100, page: 1, status: "ALL" }),
    queryKey: ["dashboard", "purchase-orders"],
  });
  const grnsQuery = useQuery({
    queryFn: () => listGoodsReceiptNotes({ limit: 100, page: 1, status: "ALL" }),
    queryKey: ["dashboard", "goods-receipt-notes"],
  });
  const putawayTasksQuery = useQuery({
    queryFn: () => listPutawayTasks({ limit: 100, page: 1, status: "ALL" }),
    queryKey: ["dashboard", "putaway-tasks"],
  });
  const goodsIssuesQuery = useQuery({
    queryFn: () => listGoodsIssues({ limit: 100, page: 1, status: "ALL" }),
    queryKey: ["dashboard", "goods-issues"],
  });
  const printJobsQuery = useQuery({
    queryFn: () => listPrintJobs({ limit: 100, page: 1, status: "ALL" }),
    queryKey: ["dashboard", "print-jobs"],
  });

  const isLoading =
    productsQuery.isLoading ||
    purchaseOrdersQuery.isLoading ||
    grnsQuery.isLoading ||
    putawayTasksQuery.isLoading ||
    goodsIssuesQuery.isLoading ||
    printJobsQuery.isLoading;
  const hasError =
    productsQuery.isError ||
    purchaseOrdersQuery.isError ||
    grnsQuery.isError ||
    putawayTasksQuery.isError ||
    goodsIssuesQuery.isError ||
    printJobsQuery.isError;

  const metrics = useMemo<Metric[]>(
    () => [
      {
        detail: "SKU, mã vạch và loại hàng.",
        href: "/products",
        icon: PackageSearch,
        label: "Mặt hàng",
        tone: "primary",
        value: formatNumber(countFrom(productsQuery.data)),
      },
      {
        detail: "Đơn mua dùng để tạo phiếu nhập.",
        href: "/purchases",
        icon: ShoppingCart,
        label: "Đơn mua",
        tone: "amber",
        value: formatNumber(countFrom(purchaseOrdersQuery.data)),
      },
      {
        detail: "Phiếu nhập, xác nhận và duyệt nhận hàng.",
        href: "/purchases",
        icon: ClipboardCheck,
        label: "Phiếu nhập",
        tone: "teal",
        value: formatNumber(countFrom(grnsQuery.data)),
      },
      {
        detail: "Phiếu cất hàng sau khi nhập kho.",
        href: "/warehouse-navigation",
        icon: MapPinned,
        label: "Cất hàng",
        tone: "blue",
        value: formatNumber(countFrom(putawayTasksQuery.data)),
      },
      {
        detail: "Phiếu xuất và xác nhận lấy hàng.",
        href: "/goods-issues",
        icon: PackageCheck,
        label: "Phiếu xuất",
        tone: "rose",
        value: formatNumber(countFrom(goodsIssuesQuery.data)),
      },
      {
        detail: "Đơn in ly đã thanh toán.",
        href: "/print-jobs",
        icon: Printer,
        label: "In ly",
        tone: "blue",
        value: formatNumber(countFrom(printJobsQuery.data)),
      },
    ],
    [
      goodsIssuesQuery.data,
      grnsQuery.data,
      printJobsQuery.data,
      productsQuery.data,
      purchaseOrdersQuery.data,
      putawayTasksQuery.data,
    ],
  );

  if (!user) {
    return null;
  }

  const copy = rolePanelCopy[activeRole];
  const pendingPutaway = putawayTasksQuery.data?.data.filter(
    (task) => task.status === "PENDING",
  ).length;
  const pendingIssues = goodsIssuesQuery.data?.data.filter(
    (issue) => issue.status === "PENDING",
  ).length;
  const pendingGrns = grnsQuery.data?.data.filter(
    (grn) => grn.status !== "APPROVED",
  ).length;

  const queueItems = [
    {
      count: pendingGrns,
      description: "Phiếu nhập chưa duyệt xong.",
      href: "/purchases",
      icon: ClipboardList,
      label: "Nhập hàng cần xử lý",
      tone: "amber" as const,
    },
    {
      count: pendingPutaway,
      description: "Phiếu cất hàng đang chờ quét vị trí.",
      href: "/warehouse-navigation",
      icon: MapPinned,
      label: "Cất hàng đang chờ",
      tone: "blue" as const,
    },
    {
      count: pendingIssues,
      description: "Phiếu xuất đang chờ lấy hàng.",
      href: "/goods-issues",
      icon: PackageCheck,
      label: "Xuất kho đang chờ",
      tone: "rose" as const,
    },
  ];

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-[0_22px_60px_-42px_rgba(15,23,42,0.62)]">
        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge className="bg-blue-50 text-blue-800" variant="outline">
                {ROLE_LABELS[activeRole]}
              </Badge>
              <span className="text-sm font-medium text-muted-foreground">
                {ROLE_DESCRIPTIONS[activeRole]}
              </span>
            </div>
            <h1 className="text-3xl font-bold leading-tight text-foreground">
              {copy.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {copy.description}
            </p>
          </div>

          <div className="flex flex-col gap-3 lg:items-end">
            <RoleFocusSwitcher
              activeRole={activeRole}
              onRoleChange={setSelectedRole}
              roles={userRoles}
            />
            <div className="grid w-full grid-cols-3 gap-2 rounded-lg border border-border/70 bg-muted/25 p-2">
              {queueItems.map((item) => (
                <div className="rounded-md bg-card px-3 py-2" key={item.label}>
                  <div className="font-mono text-xl font-bold leading-none">
                    {formatNumber(item.count)}
                  </div>
                  <div className="mt-1 text-[11px] font-medium leading-snug text-muted-foreground">
                    {item.label.replace(" đang chờ", "")}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {hasError ? <DashboardError /> : null}

      {isLoading ? (
        <DashboardSkeleton />
      ) : (
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {metrics.map((metric) => (
              <MetricCard key={metric.label} {...metric} />
            ))}
          </div>

          <div className="rounded-xl border border-border/70 bg-card p-4 shadow-[0_18px_45px_-36px_rgba(15,23,42,0.55)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Việc cần làm</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Các luồng đang chờ thao tác trong kho.
                </p>
              </div>
            </div>
            <div className="grid gap-3">
              {queueItems.map((item) => (
                <WorkQueueCard key={item.label} {...item} />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function WorkQueueCard({
  count,
  description,
  href,
  icon: Icon,
  label,
  tone,
}: {
  count: number | undefined;
  description: string;
  href: string;
  icon: LucideIcon;
  label: string;
  tone: MetricTone;
}) {
  return (
    <Link
      className="group grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border/70 bg-muted/20 p-3 transition hover:border-primary/30 hover:bg-primary/[0.03]"
      href={href}
    >
      <div
        className={cn(
          "flex size-11 items-center justify-center rounded-lg ring-1",
          toneClass[tone],
        )}
      >
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-3">
          <div className="truncate text-sm font-semibold">{label}</div>
          <div className="font-mono text-xl font-bold">
            {formatNumber(count)}
          </div>
        </div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {description}
        </p>
      </div>
      <ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  );
}
