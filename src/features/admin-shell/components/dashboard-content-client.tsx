"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowDownToLine,
  ClipboardList,
  ShieldCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
} from "@/features/inventory/utils/stock";
import { formatDateTime } from "@/utils/format-date";

const icons = [ShieldCheck, ClipboardList, ArrowDownToLine, Activity];

export function DashboardContentClient() {
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

  const ledgerRows = ledgerQuery.data?.data ?? [];
  const stockMovements = movementsQuery.data?.data ?? [];
  const inventoryValueSeries = valueSeriesQuery.data?.data ?? [];
  const totalAvailableQty = ledgerRows.reduce(
    (total, row) =>
      total + calculateAvailableQty(row.quantity, row.reserved ?? row.reservedQty ?? 0),
    0,
  );
  const reservedQty = ledgerRows.reduce(
    (total, row) => total + (row.reserved ?? row.reservedQty ?? 0),
    0,
  );
  const lowStockCount = ledgerRows.filter(
    (row) =>
      calculateAvailableQty(row.quantity, row.reserved ?? row.reservedQty ?? 0) <=
      row.reorderPoint,
  ).length;
  const hasApiError =
    ledgerQuery.isError || movementsQuery.isError || valueSeriesQuery.isError;

  const dashboardMetrics = [
    {
      label: "Tồn khả dụng",
      value: totalAvailableQty.toLocaleString("vi-VN"),
      detail: "quantity - reserved_qty",
    },
    {
      label: "Dòng tồn kho",
      value: ledgerRows.length.toLocaleString("vi-VN"),
      detail: "Đọc từ /inventory/ledger",
    },
    {
      label: "Đang reserved",
      value: reservedQty.toLocaleString("vi-VN"),
      detail: "Đơn pending chỉ giữ reserved_qty",
    },
    {
      label: "Cần chú ý",
      value: lowStockCount.toLocaleString("vi-VN"),
      detail: "Available thấp hơn reorder point",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <Badge variant="secondary">Phase 1 WMS core</Badge>
          <h1 className="mt-2 text-2xl font-semibold tracking-normal">
            Tổng quan vận hành kho
          </h1>
          <p className="text-sm text-muted-foreground">
            Theo dõi tồn kho khả dụng, phiếu nhập, chuyển kho và convert ly.
          </p>
        </div>
        <div className="rounded-lg border bg-background px-3 py-2 text-sm">
          Tồn khả dụng:{" "}
          <span className="font-semibold">
            {totalAvailableQty.toLocaleString("vi-VN")}
          </span>
        </div>
      </div>

      {hasApiError ? (
        <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
          Chưa kết nối được wms-api hoặc phiên đăng nhập đã hết hạn.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {dashboardMetrics.map((metric, index) => {
          const Icon = icons[index];

          return (
            <Card key={metric.label}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3">
                  <CardDescription>{metric.label}</CardDescription>
                  <Icon className="size-4 text-teal-700" />
                </div>
                <CardTitle className="text-2xl">{metric.value}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {metric.detail}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Giá trị tồn kho theo nhóm</CardTitle>
            <CardDescription>
              Đọc từ report API, không dùng dữ liệu mock.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StockValueChart data={inventoryValueSeries} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stock movement gần nhất</CardTitle>
            <CardDescription>
              Mọi thay đổi stock đều có ref_id và ref_type.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {stockMovements.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Chưa có stock movement từ wms-api.
              </div>
            ) : null}

            {stockMovements.map((movement) => (
              <div key={movement.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">{movement.productName}</div>
                  <Badge variant="outline">
                    {getMoveTypeLabel(movement.moveType)}
                  </Badge>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {movement.warehouseName} · {movement.quantity} ·{" "}
                  {movement.refId}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {formatDateTime(movement.createdAt)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tồn kho cần chú ý</CardTitle>
          <CardDescription>
            UI hiển thị quantity, reserved_qty và available_qty; không có thao
            tác sửa stock trực tiếp.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InventoryTable rows={ledgerRows} />
        </CardContent>
      </Card>
    </div>
  );
}
