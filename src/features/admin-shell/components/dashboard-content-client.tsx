"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FileCheck2,
  ListChecks,
  MapPinned,
  PackageCheck,
  PackageSearch,
  Printer,
  Repeat2,
  ScanLine,
  ShieldCheck,
  TrendingUp,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSessionUser } from "@/hooks/use-session-user";
import { InventoryTable } from "@/features/admin-shell/components/inventory-table";
import { StockValueChart } from "@/features/admin-shell/components/stock-value-chart";
import {
  listInventoryValueSeries,
  listStockLedger,
  listStockMovements,
} from "@/features/inventory/inventory.service";
import {
  calculateAvailableQty,
  getMoveTypeLabel,
  getStockStatus,
} from "@/features/inventory/utils/stock";
import {
  getDefaultRoleFocus,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  type WmsRole,
} from "@/lib/rbac";
import { formatDateTime } from "@/utils/format-date";
import type { MoveType, StockLedgerRow, StockMovement } from "@/types/api";

type MetricTone = "primary" | "teal" | "amber" | "violet" | "rose";

type DashboardMetric = {
  detail: ReactNode;
  icon: LucideIcon;
  label: string;
  tone: MetricTone;
  value: string;
};

type WorkTask = {
  count: string;
  description: string;
  icon: LucideIcon;
  label: string;
  tone: MetricTone;
};

type DashboardStats = {
  cupRowsCount: number;
  inboundCount: number;
  ledgerCount: number;
  lowStockCount: number;
  outboundCount: number;
  putawayCount: number;
  printMovementCount: number;
  reservedQty: number;
  scrapCount: number;
  totalAvailableQty: number;
};

const roleAccentClass: Record<MetricTone, string> = {
  primary: "bg-primary/10 text-primary",
  teal: "bg-teal-50 text-teal-600",
  amber: "bg-amber-50 text-amber-600",
  violet: "bg-blue-50 text-blue-700",
  rose: "bg-rose-50 text-rose-600",
};

const rolePanelCopy: Record<
  WmsRole,
  { description: string; title: string; warehouseCopy: string }
> = {
  ADMIN: {
    title: "Tổng quan vận hành kho",
    description: "Theo dõi tồn kho khả dụng, movement trail và sức khỏe WMS.",
    warehouseCopy: "Central warehouse",
  },
  MANAGER: {
    title: "Bảng điều phối quản lý",
    description: "Tập trung PO, goods issue, phê duyệt và báo cáo tồn kho.",
    warehouseCopy: "Central warehouse",
  },
  RECEIVER: {
    title: "Receiver workspace",
    description: "Nhận hàng, put-away và xác nhận bằng barcode.",
    warehouseCopy: "Inbound warehouse",
  },
  PICKER: {
    title: "Picker workspace",
    description: "Soạn hàng, xuất kho và lấy đúng vị trí shelf.",
    warehouseCopy: "Pick face",
  },
  PRINTER: {
    title: "Printer workspace",
    description: "Theo dõi lệnh in, cup blank, cup printed và output đã xác nhận.",
    warehouseCopy: "Print cell",
  },
  COUNTER: {
    title: "Counter workspace",
    description: "Kiểm đếm tồn, ghi nhận chênh lệch và chuẩn bị adjustment.",
    warehouseCopy: "Count zone",
  },
};

function formatNumber(value: number) {
  return value.toLocaleString("vi-VN");
}

function Trend({ value, tone }: { value: string; tone: "good" | "warn" }) {
  return (
    <span
      className={
        tone === "good"
          ? "font-semibold text-teal-600"
          : "font-semibold text-amber-600"
      }
    >
      {value}
    </span>
  );
}

function MetricCard({
  detail,
  icon: Icon,
  label,
  tone,
  value,
}: DashboardMetric) {
  return (
    <Card className="min-h-[132px]">
      <CardContent className="flex h-full items-center gap-4 pt-1">
        <div
          className={`flex size-14 shrink-0 items-center justify-center rounded-full ${roleAccentClass[tone]}`}
        >
          <Icon className="size-6" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-muted-foreground">
            {label}
          </div>
          <div className="mt-1 font-mono text-2xl font-bold tracking-normal text-foreground">
            {value}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">{detail}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function WorkTaskCard({ count, description, icon: Icon, label, tone }: WorkTask) {
  return (
    <div className="rounded-lg border border-border/70 bg-card p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div
          className={`flex size-9 items-center justify-center rounded-lg ${roleAccentClass[tone]}`}
        >
          <Icon className="size-4" />
        </div>
        <div className="font-mono text-xl font-bold">{count}</div>
      </div>
      <div className="text-sm font-semibold">{label}</div>
      <div className="mt-1 text-xs leading-5 text-muted-foreground">
        {description}
      </div>
    </div>
  );
}

function PanelHeader({
  action,
  description,
  title,
}: {
  action?: ReactNode;
  description?: ReactNode;
  title: string;
}) {
  return (
    <CardHeader className="pb-2">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          {description ? (
            <CardDescription className="mt-1">{description}</CardDescription>
          ) : null}
        </div>
        {action}
      </div>
    </CardHeader>
  );
}

function statusBreakdown(rows: StockLedgerRow[]) {
  const initial = { normal: 0, low: 0, out: 0, blocked: 0 };

  return rows.reduce((acc, row) => {
    const reservedQty = row.reserved ?? row.reservedQty ?? 0;
    const status = getStockStatus(row.quantity, reservedQty, row.reorderPoint);

    if (reservedQty > row.quantity) {
      acc.blocked += 1;
    } else if (status === "out") {
      acc.out += 1;
    } else if (status === "low") {
      acc.low += 1;
    } else {
      acc.normal += 1;
    }

    return acc;
  }, initial);
}

function StockStatusCard({ rows }: { rows: StockLedgerRow[] }) {
  const status = statusBreakdown(rows);
  const total = Math.max(rows.length, 1);
  const normalDeg = (status.normal / total) * 360;
  const lowDeg = normalDeg + (status.low / total) * 360;
  const outDeg = lowDeg + (status.out / total) * 360;
  const background =
    rows.length === 0
      ? "conic-gradient(#e5e7eb 0 360deg)"
      : `conic-gradient(#14b8a6 0 ${normalDeg}deg, #f59e0b ${normalDeg}deg ${lowDeg}deg, #fb7185 ${lowDeg}deg ${outDeg}deg, #94a3b8 ${outDeg}deg 360deg)`;
  const legend = [
    { label: "Ổn định", value: status.normal, color: "bg-teal-500" },
    { label: "Sắp hết", value: status.low, color: "bg-amber-500" },
    { label: "Hết hàng", value: status.out, color: "bg-rose-400" },
    { label: "Blocked", value: status.blocked, color: "bg-slate-400" },
  ];

  return (
    <Card>
      <PanelHeader
        title="Trạng thái stock"
        description="Phân nhóm theo available_qty và reorder point."
      />
      <CardContent className="grid gap-5 sm:grid-cols-[160px_1fr] xl:grid-cols-1 2xl:grid-cols-[160px_1fr]">
        <div className="relative mx-auto flex size-40 items-center justify-center rounded-full">
          <div className="absolute inset-0 rounded-full" style={{ background }} />
          <div className="absolute inset-5 rounded-full bg-card shadow-inner" />
          <div className="relative text-center">
            <div className="text-xs font-semibold text-muted-foreground">
              Dòng tồn kho
            </div>
            <div className="font-mono text-2xl font-bold">
              {formatNumber(rows.length)}
            </div>
          </div>
        </div>
        <div className="grid content-center gap-3">
          {legend.map((item) => (
            <div
              className="flex items-center justify-between gap-3 text-sm"
              key={item.label}
            >
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className={`size-2 rounded-full ${item.color}`} />
                {item.label}
              </div>
              <div className="font-mono font-semibold">
                {formatNumber(item.value)}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function movementTone(moveType: MoveType) {
  if (moveType === "RECEIVE" || moveType === "PUTAWAY") {
    return {
      icon: ArrowDownToLine,
      className: "bg-teal-50 text-teal-600",
      qty: "text-teal-600",
    };
  }

  if (
    moveType === "PRINT_CONSUME" ||
    moveType === "PRINT_OUTPUT" ||
    moveType === "ADJUST"
  ) {
    return {
      icon: Repeat2,
      className: "bg-blue-50 text-blue-700",
      qty: "text-primary",
    };
  }

  return {
    icon: ArrowUpFromLine,
    className: "bg-rose-50 text-rose-600",
    qty: "text-rose-600",
  };
}

function RecentMovements({
  movements,
  title = "Stock movement gần nhất",
}: {
  movements: StockMovement[];
  title?: string;
}) {
  return (
    <Card>
      <PanelHeader
        title={title}
       
        action={
          <Badge variant="outline">
            <ClipboardList data-icon="inline-start" />
            Audit
          </Badge>
        }
      />
      <CardContent className="space-y-2">
        {movements.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/30 p-5 text-sm text-muted-foreground">
            Chưa có stock movement từ wms-api.
          </div>
        ) : null}

        {movements.slice(0, 6).map((movement) => {
          const tone = movementTone(movement.moveType);
          const Icon = tone.icon;

          return (
            <div
              key={movement.id}
              className="grid grid-cols-[36px_1fr_auto] items-center gap-3 rounded-lg border border-border/70 bg-card p-3"
            >
              <div
                className={`flex size-9 items-center justify-center rounded-full ${tone.className}`}
              >
                <Icon className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <Badge variant="outline">{getMoveTypeLabel(movement.moveType)}</Badge>
                  <span className="truncate font-mono text-sm font-semibold">
                    {movement.refId}
                  </span>
                </div>
                <div className="mt-1 truncate text-xs text-muted-foreground">
                  {movement.productName} · {movement.warehouseName} ·{" "}
                  {movement.refType}
                </div>
              </div>
              <div className="text-right">
                <div className={`font-mono text-sm font-bold ${tone.qty}`}>
                  {movement.quantity > 0 ? "+" : ""}
                  {formatNumber(movement.quantity)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDateTime(movement.createdAt)}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function PutawayAdvisory({ rows }: { rows: StockLedgerRow[] }) {
  const priorityRow =
    rows.find((row) => {
      const reservedQty = row.reserved ?? row.reservedQty ?? 0;
      return getStockStatus(row.quantity, reservedQty, row.reorderPoint) !== "healthy";
    }) ?? rows[0];

  return (
    <Card className="xl:sticky xl:top-[92px]">
      <PanelHeader
        title="Put-away advisory"
        description="Gợi ý vẫn là advisory; receiver xác nhận bằng barcode."
        action={<Badge className="bg-teal-50 text-teal-700">Active</Badge>}
      />
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border/70 bg-muted/25 p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <PackageCheck className="size-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-muted-foreground">
                SKU cần xử lý
              </div>
              <div className="font-mono font-bold text-primary">
                {priorityRow?.productSku ?? "Chưa có SKU"}
              </div>
            </div>
          </div>
          <div className="text-sm font-semibold">
            {priorityRow?.productName ?? "Chờ dữ liệu từ wms-api"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Available:{" "}
            {priorityRow
              ? formatNumber(
                  calculateAvailableQty(
                    priorityRow.quantity,
                    priorityRow.reserved ?? priorityRow.reservedQty ?? 0,
                  ),
                )
              : "0"}
          </div>
        </div>

        <div className="rounded-lg border border-border/70 bg-card p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-full bg-blue-50 text-primary">
              <MapPinned className="size-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-muted-foreground">
                Recommended location
              </div>
              <div className="font-mono font-bold text-primary">A-12-03-2B</div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Shelf code, capacity và reason được hiển thị ở Điều hướng kệ.
          </div>
        </div>

        <div className="rounded-lg border border-border/70 bg-card p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ScanLine className="size-4 text-primary" />
              Location barcode
            </div>
            <Badge className="bg-teal-50 text-teal-700">
              <CheckCircle2 data-icon="inline-start" />
              Confirmed
            </Badge>
          </div>
          <div className="h-12 rounded-md border bg-[repeating-linear-gradient(90deg,#0f172a_0_3px,transparent_3px_8px)]" />
          <div className="mt-2 text-center font-mono text-xs font-semibold text-muted-foreground">
            A12032B
          </div>
        </div>
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
    <div className="flex flex-wrap gap-2" aria-label="Chọn role focus">
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

function DashboardHeaderBlock({
  activeRole,
  roles,
  setActiveRole,
  totalAvailableQty,
  warehouseCopy,
}: {
  activeRole: WmsRole;
  roles: readonly WmsRole[];
  setActiveRole: (role: WmsRole) => void;
  totalAvailableQty: number;
  warehouseCopy: string;
}) {
  const copy = rolePanelCopy[activeRole];

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge className="bg-blue-50 text-blue-800" variant="outline">
            {ROLE_LABELS[activeRole]}
          </Badge>
          <span className="text-xs font-semibold text-muted-foreground">
            {ROLE_DESCRIPTIONS[activeRole]}
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-normal text-foreground">
          {copy.title}
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          {copy.description}
        </p>
      </div>
      <div className="flex flex-col gap-2 md:items-end">
        <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-semibold shadow-[0_14px_32px_-28px_rgba(15,23,42,0.45)]">
          <Warehouse className="size-4 text-primary" />
          {warehouseCopy} · {formatNumber(totalAvailableQty)} available
        </div>
        <RoleFocusSwitcher
          activeRole={activeRole}
          onRoleChange={setActiveRole}
          roles={roles}
        />
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Đang tải dashboard">
      <Skeleton className="h-20 w-full rounded-lg" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton className="h-32 rounded-lg" key={index} />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_336px]">
        <Skeleton className="h-80 rounded-lg" />
        <Skeleton className="h-80 rounded-lg" />
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
      Chưa kết nối được wms-api hoặc phiên đăng nhập đã hết hạn. Kiểm tra lại
      API URL, token hoặc thử tải lại trang.
    </div>
  );
}

function buildStats(rows: StockLedgerRow[], movements: StockMovement[]) {
  const totalAvailableQty = rows.reduce(
    (total, row) =>
      total + calculateAvailableQty(row.quantity, row.reserved ?? row.reservedQty ?? 0),
    0,
  );
  const reservedQty = rows.reduce(
    (total, row) => total + (row.reserved ?? row.reservedQty ?? 0),
    0,
  );
  const lowStockCount = rows.filter(
    (row) =>
      calculateAvailableQty(row.quantity, row.reserved ?? row.reservedQty ?? 0) <=
      row.reorderPoint,
  ).length;
  const cupRowsCount = rows.filter(isCupRow).length;

  return {
    cupRowsCount,
    inboundCount: movements.filter((movement) => movement.moveType === "RECEIVE")
      .length,
    ledgerCount: rows.length,
    lowStockCount,
    outboundCount: movements.filter((movement) => movement.moveType === "ISSUE")
      .length,
    putawayCount: movements.filter((movement) => movement.moveType === "PUTAWAY")
      .length,
    printMovementCount: movements.filter(
      (movement) =>
        movement.moveType === "PRINT_CONSUME" ||
        movement.moveType === "PRINT_OUTPUT",
    ).length,
    reservedQty,
    scrapCount: movements.filter((movement) => movement.moveType === "SCRAP")
      .length,
    totalAvailableQty,
  };
}

function buildExecutiveMetrics(stats: DashboardStats): DashboardMetric[] {
  return [
    {
      label: "Tồn khả dụng",
      value: formatNumber(stats.totalAvailableQty),
      detail: (
        <>
          <Trend tone="good" value="+8.2%" /> · quantity - reserved_qty
        </>
      ),
      icon: Boxes,
      tone: "primary",
    },
    {
      label: "Dòng tồn kho",
      value: formatNumber(stats.ledgerCount),
      detail: "Đọc từ /inventory/ledger",
      icon: ShieldCheck,
      tone: "teal",
    },
    {
      label: "Đang reserved",
      value: formatNumber(stats.reservedQty),
      detail: (
        <>
          <Trend tone="good" value="+3.6%" /> · đơn pending giữ reserved_qty
        </>
      ),
      icon: Activity,
      tone: "amber",
    },
    {
      label: "Cần chú ý",
      value: formatNumber(stats.lowStockCount),
      detail: (
        <>
          <Trend tone="warn" value="+12" /> · available thấp hơn reorder point
        </>
      ),
      icon: TrendingUp,
      tone: "violet",
    },
  ];
}

function buildRoleMetrics(role: WmsRole, stats: DashboardStats): DashboardMetric[] {
  if (role === "RECEIVER") {
    return [
      {
        label: "Inbound movements",
        value: formatNumber(stats.inboundCount),
        detail: "GRN và nhập kho cần receiver xác nhận.",
        icon: ArrowDownToLine,
        tone: "teal",
      },
      {
        label: "Put-away queue",
        value: formatNumber(stats.lowStockCount),
        detail: "SKU ưu tiên theo reorder.",
        icon: MapPinned,
        tone: "primary",
      },
      {
        label: "Put-away moves",
        value: formatNumber(stats.putawayCount),
        detail: "Chuyển hàng từ staging vào shelf thật.",
        icon: MapPinned,
        tone: "amber",
      },
    ];
  }

  if (role === "PICKER") {
    return [
      {
        label: "Reserved qty",
        value: formatNumber(stats.reservedQty),
        detail: "Nguồn đơn cần pick/pack.",
        icon: PackageSearch,
        tone: "primary",
      },
      {
        label: "Outbound moves",
        value: formatNumber(stats.outboundCount),
        detail: "Xuất kho theo đơn hàng.",
        icon: ArrowUpFromLine,
        tone: "rose",
      },
      {
        label: "Barcode confirms",
        value: formatNumber(stats.outboundCount),
        detail: "Quét SKU + shelf trước khi confirm.",
        icon: ScanLine,
        tone: "amber",
      },
    ];
  }

  if (role === "PRINTER") {
    return [
      {
        label: "Cup SKUs",
        value: formatNumber(stats.cupRowsCount),
        detail: "",
        icon: Printer,
        tone: "primary",
      },
      {
        label: "Print movements",
        value: formatNumber(stats.printMovementCount),
        detail: "",
        icon: Repeat2,
        tone: "violet",
      },
      {
        label: "Reserved for print",
        value: formatNumber(stats.reservedQty),
        detail: "",
        icon: ClipboardCheck,
        tone: "amber",
      },
    ];
  }

  return [
    {
      label: "Stock count scope",
      value: formatNumber(stats.ledgerCount),
      detail: "Dòng tồn kho có thể kiểm đếm.",
      icon: ListChecks,
      tone: "primary",
    },
    {
      label: "Discrepancy risk",
      value: formatNumber(stats.lowStockCount),
      detail: "SKU cần kiểm tra lại số thực tế.",
      icon: FileCheck2,
      tone: "amber",
    },
    {
      label: "Adjustment refs",
      value: formatNumber(stats.inboundCount + stats.outboundCount),
      detail: "Movement gần đây để đối chiếu.",
      icon: Activity,
      tone: "teal",
    },
  ];
}

function buildRoleTasks(role: WmsRole, stats: DashboardStats): WorkTask[] {
  if (role === "RECEIVER") {
    return [
      {
        label: "Xác nhận GRN",
        count: formatNumber(stats.inboundCount),
        description: "Quét SKU và xác nhận số lượng nhận thực tế.",
        icon: ClipboardCheck,
        tone: "teal",
      },
      {
        label: "Put-away cần xử lý",
        count: formatNumber(stats.lowStockCount),
        description: "Đưa hàng từ staging vào shelf thật.",
        icon: MapPinned,
        tone: "primary",
      },
      {
        label: "Xác nhận put-away",
        count: formatNumber(stats.putawayCount),
        description: "Quét SKU + shelf để chuyển hàng khỏi staging.",
        icon: ScanLine,
        tone: "amber",
      },
    ];
  }

  if (role === "PICKER") {
    return [
      {
        label: "Pick/pack",
        count: formatNumber(stats.reservedQty),
        description: "Lấy hàng đã reserved theo đơn.",
        icon: PackageSearch,
        tone: "primary",
      },
      {
        label: "Xuất kho",
        count: formatNumber(stats.outboundCount),
        description: "Xác nhận ISSUE sau khi đóng gói.",
        icon: ArrowUpFromLine,
        tone: "rose",
      },
      {
        label: "Quét vị trí",
        count: formatNumber(stats.outboundCount),
        description: "Đối chiếu shelf barcode trước khi xuất.",
        icon: ScanLine,
        tone: "amber",
      },
    ];
  }

  if (role === "PRINTER") {
    return [
      {
        label: "Lệnh in đang mở",
        count: formatNumber(stats.printMovementCount),
        description: "Theo dõi job in và output.",
        icon: Printer,
        tone: "primary",
      },
      {
        label: "Blank cup",
        count: formatNumber(stats.cupRowsCount),
        description: "Kiểm tra hàng trước khi in.",
        icon: Boxes,
        tone: "amber",
      },
      {
        label: "Xác nhận in xong",
        count: formatNumber(stats.printMovementCount),
        description: "",
        icon: CheckCircle2,
        tone: "teal",
      },
    ];
  }

  return [
    {
      label: "Phiếu kiểm",
      count: formatNumber(stats.ledgerCount),
      description: "Kiểm đếm theo zone hoặc toàn kho.",
      icon: ListChecks,
      tone: "primary",
    },
    {
      label: "SKU lệch ngưỡng",
      count: formatNumber(stats.lowStockCount),
      description: "Ưu tiên kiểm tra dòng tồn kho rủi ro.",
      icon: FileCheck2,
      tone: "amber",
    },
    {
      label: "Audit movement",
      count: formatNumber(stats.inboundCount + stats.outboundCount),
      description: "",
      icon: ClipboardList,
      tone: "teal",
    },
  ];
}

function movementForRole(role: WmsRole, movements: StockMovement[]) {
  const moveTypesByRole: Partial<Record<WmsRole, MoveType[]>> = {
    RECEIVER: ["RECEIVE", "PUTAWAY"],
    PICKER: ["ISSUE"],
    PRINTER: ["PRINT_CONSUME", "PRINT_OUTPUT"],
    COUNTER: ["ADJUST", "SCRAP"],
  };
  const moveTypes = moveTypesByRole[role];

  if (!moveTypes) {
    return movements;
  }

  const moveTypeSet = new Set<MoveType>(moveTypes);
  return movements.filter((movement) => moveTypeSet.has(movement.moveType));
}

function isCupRow(row: StockLedgerRow) {
  const text = `${row.productSku} ${row.productName}`.toLowerCase();
  return text.includes("cup") || text.includes("ly");
}

function rowsForRole(role: WmsRole, rows: StockLedgerRow[]) {
  if (role === "PRINTER") {
    return rows.filter(isCupRow);
  }

  if (role === "COUNTER") {
    return rows.filter((row) => {
      const reservedQty = row.reserved ?? row.reservedQty ?? 0;
      return getStockStatus(row.quantity, reservedQty, row.reorderPoint) !== "healthy";
    });
  }

  return rows;
}

function ExecutiveDashboard({
  inventoryValueSeries,
  ledgerRows,
  stats,
  stockMovements,
}: {
  inventoryValueSeries: { cups: number; ingredients: number; name: string }[];
  ledgerRows: StockLedgerRow[];
  stats: DashboardStats;
  stockMovements: StockMovement[];
}) {
  const dashboardMetrics = buildExecutiveMetrics(stats);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {dashboardMetrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_336px]">
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Card>
              <PanelHeader
                title="Giá trị tồn kho theo nhóm"
                description="Đọc từ report API, không dùng dữ liệu mock."
                action={<Badge variant="outline">30 ngày</Badge>}
              />
              <CardContent>
                <StockValueChart data={inventoryValueSeries} />
              </CardContent>
            </Card>

            <StockStatusCard rows={ledgerRows} />
          </div>

          <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_380px]">
            <Card>
              <PanelHeader
                title="Tồn kho cần chú ý"
                description="Không có thao tác sửa stock trực tiếp trên dashboard."
                action={<Badge variant="outline">View all</Badge>}
              />
              <CardContent>
                <InventoryTable rows={ledgerRows} />
              </CardContent>
            </Card>

            <RecentMovements movements={stockMovements} />
          </div>
        </div>

        <PutawayAdvisory rows={ledgerRows} />
      </div>
    </>
  );
}

function OperationalDashboard({
  ledgerRows,
  role,
  stats,
  stockMovements,
}: {
  ledgerRows: StockLedgerRow[];
  role: WmsRole;
  stats: DashboardStats;
  stockMovements: StockMovement[];
}) {
  const metrics = buildRoleMetrics(role, stats);
  const tasks = buildRoleTasks(role, stats);
  const roleRows = rowsForRole(role, ledgerRows);
  const roleMovements = movementForRole(role, stockMovements);
  const inventoryTitle =
    role === "PRINTER"
      ? "Cup stock cần theo dõi"
      : role === "COUNTER"
        ? "Dòng tồn kho cần kiểm"
        : "Stock liên quan role";

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_336px]">
        <div className="space-y-4">
          <Card>
            <PanelHeader
              title="Task queue theo role"
              description="Các số liệu ưu tiên được suy ra từ ledger và movement hiện có."
              action={<Badge variant="outline">{ROLE_LABELS[role]}</Badge>}
            />
            <CardContent>
              <div className="grid gap-3 md:grid-cols-3">
                {tasks.map((task) => (
                  <WorkTaskCard key={task.label} {...task} />
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_380px]">
            <Card>
              <PanelHeader
                title={inventoryTitle}
                description="Bảng luôn scroll ngang trên màn nhỏ để không vỡ layout."
                action={<Badge variant="outline">Role view</Badge>}
              />
              <CardContent>
                <InventoryTable rows={roleRows} />
              </CardContent>
            </Card>

            <RecentMovements
              movements={roleMovements}
              title={`Movement cho ${ROLE_LABELS[role]}`}
            />
          </div>
        </div>

        {role === "RECEIVER" ? (
          <PutawayAdvisory rows={ledgerRows} />
        ) : (
          <StockStatusCard rows={ledgerRows} />
        )}
      </div>
    </>
  );
}

export function DashboardContentClient() {
  const user = useSessionUser();
  const [selectedRole, setSelectedRole] = useState<WmsRole | null>(null);
  const userRoles = user?.roles ?? [];
  const activeRole =
    selectedRole && userRoles.includes(selectedRole)
      ? selectedRole
      : getDefaultRoleFocus(userRoles);

  const ledgerQuery = useQuery({
    queryKey: ["inventory", "ledger"],
    queryFn: listStockLedger,
  });
  const movementsQuery = useQuery({
    queryKey: ["inventory", "movements"],
    queryFn: listStockMovements,
  });
  const valueSeriesQuery = useQuery({
    queryKey: ["reports", "inventory-value-series"],
    queryFn: listInventoryValueSeries,
  });
  const ledgerRows = useMemo(
    () => ledgerQuery.data?.data ?? [],
    [ledgerQuery.data?.data],
  );
  const stockMovements = useMemo(
    () => movementsQuery.data?.data ?? [],
    [movementsQuery.data?.data],
  );
  const inventoryValueSeries = useMemo(
    () => valueSeriesQuery.data?.data ?? [],
    [valueSeriesQuery.data?.data],
  );
  const stats = useMemo(
    () => buildStats(ledgerRows, stockMovements),
    [ledgerRows, stockMovements],
  );
  const hasApiError =
    ledgerQuery.isError || movementsQuery.isError || valueSeriesQuery.isError;
  const isLoading =
    ledgerQuery.isLoading || movementsQuery.isLoading || valueSeriesQuery.isLoading;
  const warehouseCopy =
    user?.warehouseId ?? rolePanelCopy[activeRole].warehouseCopy;

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-4">
      <DashboardHeaderBlock
        activeRole={activeRole}
        roles={userRoles}
        setActiveRole={setSelectedRole}
        totalAvailableQty={stats.totalAvailableQty}
        warehouseCopy={warehouseCopy}
      />

      {hasApiError ? <DashboardError /> : null}

      {isLoading ? (
        <DashboardSkeleton />
      ) : activeRole === "ADMIN" || activeRole === "MANAGER" ? (
        <ExecutiveDashboard
          inventoryValueSeries={inventoryValueSeries}
          ledgerRows={ledgerRows}
          stats={stats}
          stockMovements={stockMovements}
        />
      ) : (
        <OperationalDashboard
          ledgerRows={ledgerRows}
          role={activeRole}
          stats={stats}
          stockMovements={stockMovements}
        />
      )}
    </div>
  );
}
