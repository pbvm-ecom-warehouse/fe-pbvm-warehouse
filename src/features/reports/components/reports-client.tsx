"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, RefreshCw, RotateCcw } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  EmptyState,
  PageHeader,
  StatusBadge,
  TablePanel,
  TableSkeleton,
} from "@/features/admin-shell/components/operations-ui";
import {
  getLotReport,
  getPerformanceReport,
  getStockReport,
  type LotExpiryFlag,
  type LotReportQuery,
  type PerformanceReportQuery,
  type StockReportQuery,
} from "@/features/reports/services/report.service";
import {
  expiryFlagLabel,
  formatQuantity,
  formatReportDate,
  movementTypeLabel,
} from "@/features/reports/utils/report-formatters";
import { getApiErrorMessage } from "@/lib/api-contract";

type ReportTab = "stock" | "lots" | "performance";

type ListFilterDraft = {
  sku: string;
};

type LotFilterDraft = ListFilterDraft & {
  status: "" | "ACTIVE" | "EXPIRED";
};

type PerformanceFilterDraft = ListFilterDraft & {
  dateFrom: string;
  dateTo: string;
};

function toDateInputValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function createPerformanceDraft(): PerformanceFilterDraft {
  const dateTo = new Date();
  const dateFrom = new Date(dateTo);
  dateFrom.setDate(dateFrom.getDate() - 29);

  return {
    dateFrom: toDateInputValue(dateFrom),
    dateTo: toDateInputValue(dateTo),
    sku: "",
  };
}

function toOptionalText(value: string) {
  const trimmed = value.trim();
  return trimmed || undefined;
}

function toStockFilters(draft: ListFilterDraft): StockReportQuery {
  return {
    sku: toOptionalText(draft.sku),
  };
}

function toLotFilters(draft: LotFilterDraft): LotReportQuery {
  return {
    ...toStockFilters(draft),
    status: draft.status || undefined,
  };
}

function toPerformanceFilters(
  draft: PerformanceFilterDraft,
): PerformanceReportQuery {
  return {
    dateFrom: draft.dateFrom,
    dateTo: draft.dateTo,
    sku: toOptionalText(draft.sku),
  };
}

function expiryTone(flag: LotExpiryFlag) {
  return {
    expired: "danger",
    expiringSoon: "warning",
    ok: "success",
  }[flag] as "danger" | "warning" | "success";
}

function ReportError({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        <span>
          {getApiErrorMessage(error) ??
            "Không thể tải báo cáo. Vui lòng thử lại."}
        </span>
      </div>
      <Button onClick={onRetry} size="sm" type="button" variant="outline">
        Thử lại
      </Button>
    </div>
  );
}

function SkuField({
  onChange,
  value,
}: {
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="min-w-52 flex-1 space-y-1.5">
      <label
        className="text-xs font-medium text-foreground"
        htmlFor="report-sku"
      >
        SKU chính xác
      </label>
      <Input
        id="report-sku"
        onChange={(event) => onChange(event.target.value)}
        placeholder="Ví dụ: CUP-700ML"
        value={value}
      />
    </div>
  );
}

export function ReportsClient() {
  const [activeTab, setActiveTab] = useState<ReportTab>("stock");
  const [stockDraft, setStockDraft] = useState<ListFilterDraft>({
    sku: "",
  });
  const [stockFilters, setStockFilters] = useState<StockReportQuery>(() =>
    toStockFilters({ sku: "" }),
  );
  const [lotDraft, setLotDraft] = useState<LotFilterDraft>({
    sku: "",
    status: "",
  });
  const [lotFilters, setLotFilters] = useState<LotReportQuery>(() =>
    toLotFilters({ sku: "", status: "" }),
  );
  const [performanceDraft, setPerformanceDraft] =
    useState<PerformanceFilterDraft>(createPerformanceDraft);
  const [performanceFilters, setPerformanceFilters] =
    useState<PerformanceReportQuery>(() =>
      toPerformanceFilters(createPerformanceDraft()),
    );

  const stockQuery = useQuery({
    enabled: activeTab === "stock",
    queryKey: ["reports", "stock", stockFilters],
    queryFn: () => getStockReport(stockFilters),
  });
  const lotQuery = useQuery({
    enabled: activeTab === "lots",
    queryKey: ["reports", "lots", lotFilters],
    queryFn: () => getLotReport(lotFilters),
  });
  const performanceQuery = useQuery({
    enabled: activeTab === "performance",
    queryKey: ["reports", "performance", performanceFilters],
    queryFn: () => getPerformanceReport(performanceFilters),
  });

  const performanceRows = performanceQuery.data ?? [];
  const chartRows = performanceRows.map((row) => ({
    name: movementTypeLabel[row.type],
    totalQuantity: row.totalQuantity,
  }));

  function refreshActiveTab() {
    if (activeTab === "stock") {
      void stockQuery.refetch();
      return;
    }

    if (activeTab === "lots") {
      void lotQuery.refetch();
      return;
    }

    void performanceQuery.refetch();
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <PageHeader
          actions={
            <Button
              disabled={
                (activeTab === "stock" && stockQuery.isFetching) ||
                (activeTab === "lots" && lotQuery.isFetching) ||
                (activeTab === "performance" && performanceQuery.isFetching)
              }
              onClick={refreshActiveTab}
              type="button"
              variant="outline"
            >
              <RefreshCw />
              Làm mới
            </Button>
          }
          title="Báo cáo kho"
        />
        <p className="text-sm text-muted-foreground">
          Theo dõi tồn kho, hạn dùng và biến động nhập xuất.
        </p>
      </div>

      <Tabs
        onValueChange={(value) => setActiveTab(value as ReportTab)}
        value={activeTab}
      >
        <TabsList className="h-9 w-full justify-start gap-1 rounded-lg border bg-card p-1 sm:w-fit">
          <TabsTrigger
            className="px-3"
            onClick={() => setActiveTab("stock")}
            value="stock"
          >
            Tồn kho
          </TabsTrigger>
          <TabsTrigger
            className="px-3"
            onClick={() => setActiveTab("lots")}
            value="lots"
          >
            Theo lô
          </TabsTrigger>
          <TabsTrigger
            className="px-3"
            onClick={() => setActiveTab("performance")}
            value="performance"
          >
            Hiệu suất
          </TabsTrigger>
        </TabsList>

        <TabsContent className="mt-4 space-y-4" value="stock">
          <Card className="rounded-lg">
            <CardContent className="p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <SkuField
                  onChange={(sku) =>
                    setStockDraft((current) => ({ ...current, sku }))
                  }
                  value={stockDraft.sku}
                />
                <div className="flex gap-2">
                  <Button
                    onClick={() => setStockFilters(toStockFilters(stockDraft))}
                    type="button"
                  >
                    Áp dụng
                  </Button>
                  <Button
                    onClick={() => {
                      const next = { sku: "" };
                      setStockDraft(next);
                      setStockFilters(toStockFilters(next));
                    }}
                    type="button"
                    variant="outline"
                  >
                    <RotateCcw />
                    Đặt lại
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <TablePanel
            count={
              stockQuery.data ? `${stockQuery.data.length} dòng` : undefined
            }
            title="Tồn kho theo SKU"
          >
            {stockQuery.isPending ? (
              <TableSkeleton columns={7} rows={6} />
            ) : null}
            {stockQuery.isError ? (
              <ReportError
                error={stockQuery.error}
                onRetry={() => void stockQuery.refetch()}
              />
            ) : null}
            {stockQuery.data && stockQuery.data.length === 0 ? (
              <EmptyState title="Không có tồn kho phù hợp." />
            ) : null}
            {stockQuery.data && stockQuery.data.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Mặt hàng</TableHead>
                      <TableHead>Kho</TableHead>
                      <TableHead className="text-right">Tồn thực tế</TableHead>
                      <TableHead className="text-right">Đã giữ</TableHead>
                      <TableHead className="text-right">Hết hạn</TableHead>
                      <TableHead className="text-right">Khả dụng</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockQuery.data.map((row) => (
                      <TableRow key={row.sku}>
                        <TableCell className="font-mono font-medium">
                          {row.sku}
                        </TableCell>
                        <TableCell className="max-w-56 truncate font-medium">
                          {row.itemName}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {formatQuantity(row.onHand)}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {formatQuantity(row.reserved)}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {formatQuantity(row.expired)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold tabular-nums">
                          {formatQuantity(row.available)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            ) : null}
          </TablePanel>
        </TabsContent>

        <TabsContent className="mt-4 space-y-4" value="lots">
          <Card className="rounded-lg">
            <CardContent className="p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <SkuField
                  onChange={(sku) =>
                    setLotDraft((current) => ({ ...current, sku }))
                  }
                  value={lotDraft.sku}
                />
                <div className="min-w-40 space-y-1.5">
                  <label
                    className="text-xs font-medium text-foreground"
                    htmlFor="report-lot-status"
                  >
                    Trạng thái lô
                  </label>
                  <select
                    className="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-[0_8px_20px_-20px_rgba(15,23,42,0.38)] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20"
                    id="report-lot-status"
                    onChange={(event) =>
                      setLotDraft((current) => ({
                        ...current,
                        status: event.target.value as LotFilterDraft["status"],
                      }))
                    }
                    value={lotDraft.status}
                  >
                    <option value="">Tất cả trạng thái</option>
                    <option value="ACTIVE">Đang hoạt động</option>
                    <option value="EXPIRED">Đã hết hạn</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setLotFilters(toLotFilters(lotDraft))}
                    type="button"
                  >
                    Áp dụng
                  </Button>
                  <Button
                    onClick={() => {
                      const next = { sku: "", status: "" as const };
                      setLotDraft(next);
                      setLotFilters(toLotFilters(next));
                    }}
                    type="button"
                    variant="outline"
                  >
                    <RotateCcw />
                    Đặt lại
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <TablePanel
            count={lotQuery.data ? `${lotQuery.data.length} dòng` : undefined}
            title="Tồn kho theo lô"
          >
            {lotQuery.isPending ? <TableSkeleton columns={7} rows={6} /> : null}
            {lotQuery.isError ? (
              <ReportError
                error={lotQuery.error}
                onRetry={() => void lotQuery.refetch()}
              />
            ) : null}
            {lotQuery.data && lotQuery.data.length === 0 ? (
              <EmptyState title="Không có lô phù hợp." />
            ) : null}
            {lotQuery.data && lotQuery.data.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Mặt hàng</TableHead>
                      <TableHead>Số lô</TableHead>
                      <TableHead>Kho</TableHead>
                      <TableHead>Hạn dùng</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead className="text-right">Số lượng</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lotQuery.data.map((row) => (
                      <TableRow key={`${row.lotNumber}-${row.sku}`}>
                        <TableCell className="font-mono font-medium">
                          {row.sku}
                        </TableCell>
                        <TableCell className="max-w-52 truncate font-medium">
                          {row.itemName}
                        </TableCell>
                        <TableCell className="font-mono">
                          {row.lotNumber}
                        </TableCell>
                        <TableCell>
                          {formatReportDate(row.expiryDate)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge tone={expiryTone(row.expiryFlag)}>
                            {expiryFlagLabel[row.expiryFlag]}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold tabular-nums">
                          {formatQuantity(row.quantity)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            ) : null}
          </TablePanel>
        </TabsContent>

        <TabsContent className="mt-4 space-y-4" value="performance">
          <Card className="rounded-lg">
            <CardContent className="p-4">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(11rem,1fr)_minmax(11rem,1fr)_auto] lg:items-end">
                <div className="space-y-1.5">
                  <label
                    className="text-xs font-medium text-foreground"
                    htmlFor="report-date-from"
                  >
                    Từ ngày
                  </label>
                  <Input
                    id="report-date-from"
                    onChange={(event) =>
                      setPerformanceDraft((current) => ({
                        ...current,
                        dateFrom: event.target.value,
                      }))
                    }
                    type="date"
                    value={performanceDraft.dateFrom}
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    className="text-xs font-medium text-foreground"
                    htmlFor="report-date-to"
                  >
                    Đến ngày
                  </label>
                  <Input
                    id="report-date-to"
                    onChange={(event) =>
                      setPerformanceDraft((current) => ({
                        ...current,
                        dateTo: event.target.value,
                      }))
                    }
                    type="date"
                    value={performanceDraft.dateTo}
                  />
                </div>

                <SkuField
                  onChange={(sku) =>
                    setPerformanceDraft((current) => ({ ...current, sku }))
                  }
                  value={performanceDraft.sku}
                />
                <div className="flex gap-2">
                  <Button
                    onClick={() =>
                      setPerformanceFilters(
                        toPerformanceFilters(performanceDraft),
                      )
                    }
                    type="button"
                  >
                    Áp dụng
                  </Button>
                  <Button
                    onClick={() => {
                      const next = createPerformanceDraft();
                      setPerformanceDraft(next);
                      setPerformanceFilters(toPerformanceFilters(next));
                    }}
                    type="button"
                    variant="outline"
                  >
                    <RotateCcw />
                    Đặt lại
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <TablePanel title="Biến động theo nghiệp vụ">
            {performanceQuery.isPending ? (
              <TableSkeleton columns={3} rows={6} />
            ) : null}
            {performanceQuery.isError ? (
              <ReportError
                error={performanceQuery.error}
                onRetry={() => void performanceQuery.refetch()}
              />
            ) : null}
            {performanceQuery.data && performanceRows.length === 0 ? (
              <EmptyState title="Không có biến động trong kỳ đã chọn." />
            ) : null}
            {performanceQuery.data && performanceRows.length > 0 ? (
              <div className="space-y-5">
                <div
                  aria-label="Biểu đồ biến động theo nghiệp vụ"
                  className="h-64 min-w-0"
                >
                  <ResponsiveContainer height="100%" width="100%">
                    <BarChart
                      data={chartRows}
                      margin={{ bottom: 8, left: 0, right: 12, top: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="name"
                        interval={0}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis tick={{ fontSize: 11 }} width={48} />
                      <Tooltip
                        formatter={(value) => formatQuantity(Number(value))}
                      />
                      <ReferenceLine
                        stroke="hsl(var(--muted-foreground))"
                        y={0}
                      />
                      <Bar
                        dataKey="totalQuantity"
                        fill="hsl(var(--primary))"
                        radius={[3, 3, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nghiệp vụ</TableHead>
                      <TableHead className="text-right">
                        Tổng số lượng
                      </TableHead>
                      <TableHead className="text-right">Số bút toán</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {performanceRows.map((row) => (
                      <TableRow key={row.type}>
                        <TableCell className="font-medium">
                          {movementTypeLabel[row.type]}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold tabular-nums">
                          {formatQuantity(row.totalQuantity)}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {formatQuantity(row.movementCount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </TablePanel>
        </TabsContent>
      </Tabs>
    </div>
  );
}
