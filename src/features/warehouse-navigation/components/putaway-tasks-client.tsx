"use client";

import { useMemo, useState } from "react";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArrowLeft,
  Boxes,
  CalendarDays,
  Eye,
  LoaderCircle,
  RefreshCw,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  PageHeader,
  PermissionNotice,
  StatusBadge,
} from "@/features/admin-shell/components/operations-ui";
import {
  getGoodsReceiptNote,
  type GoodsReceiptNote,
} from "@/features/purchases/services/goods-receipt-note.service";
import { useSessionUser } from "@/hooks/use-session-user";
import { getApiErrorCode, getApiErrorMessage } from "@/lib/api-contract";
import { hasAnyRole } from "@/lib/rbac";
import { statusLabel, statusTone } from "@/lib/wms-ui-labels";
import { fetchWarehouseLayout } from "@/features/warehouse-layout/services/warehouse-layout.service";
import { listPutawaySuggestionResult } from "../services/putaway-navigation.service";
import {
  confirmPutawayLine,
  listPutawayTasks,
  type PutawayTaskStatus,
} from "../services/putaway-task.service";
import {
  getNavigationPath,
  listRackCells,
} from "../services/warehouse-operations.service";
import { buildPutawayWorkItems } from "../utils/putaway-work-items";
import { InventoryReconciliationPanel } from "./inventory-reconciliation-panel";
import { WarehouseOperationWorkspace } from "./warehouse-operation-workspace";

const keys = {
  list: (status: PutawayTaskStatus | "ALL") =>
    ["putaway-tasks", "list", status] as const,
  receipt: (id: string) => ["goods-receipt-notes", "detail", id] as const,
  suggestions: (key: string, remainingQty: number) =>
    ["putaway-suggestions", key, remainingQty] as const,
};

function ErrorBanner({ error }: { error: unknown }) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
      {getApiErrorMessage(error) ?? "Không tải được dữ liệu cất hàng."}
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("vi-VN").format(date);
}

export function PutawayTasksClient() {
  const user = useSessionUser();
  const queryClient = useQueryClient();
  const canView = hasAnyRole(user?.roles, ["ADMIN", "MANAGER", "RECEIVER"]);
  const canConfirm = hasAnyRole(user?.roles, ["ADMIN", "RECEIVER"]);
  const [status, setStatus] = useState<PutawayTaskStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [activeTab, setActiveTab] = useState("putaway-tasks");

  const tasksQuery = useQuery({
    enabled: canView,
    queryKey: keys.list(status),
    queryFn: () => listPutawayTasks({ status, page: 1, limit: 100 }),
  });
  const tasks = useMemo(() => tasksQuery.data?.data ?? [], [tasksQuery.data]);
  const grnIds = useMemo(
    () => [...new Set(tasks.map((task) => task.grnId).filter(Boolean))],
    [tasks],
  );
  const receiptQueries = useQueries({
    queries: grnIds.map((grnId) => ({
      enabled: canView,
      queryKey: keys.receipt(grnId),
      queryFn: () => getGoodsReceiptNote(grnId),
    })),
  });
  const receipts = receiptQueries
    .map((query) => query.data)
    .filter((receipt): receipt is GoodsReceiptNote => Boolean(receipt));
  const workItems = buildPutawayWorkItems(tasks, receipts, {
    includeCompleted: status !== "PENDING",
  });
  const normalizedSearch = search.trim().toLocaleLowerCase("vi");
  const visibleItems = normalizedSearch
    ? workItems.filter((item) =>
        [item.sku, item.itemName, item.lotNumber, item.grnNumber]
          .filter(Boolean)
          .some((value) =>
            value!.toLocaleLowerCase("vi").includes(normalizedSearch),
          ),
      )
    : workItems;
  const selected = workItems.find((item) => item.key === selectedKey);
  const receiptsLoading = receiptQueries.some((query) => query.isLoading);
  const firstReceiptError = receiptQueries.find((query) => query.error)?.error;
  const selectedStatus = selected?.taskStatus ?? "PENDING";
  const isCompletedDetail = selectedStatus === "COMPLETED";

  const suggestionQuery = useQuery({
    enabled: canConfirm && !isCompletedDetail && Boolean(selected),
    queryKey: keys.suggestions(
      selected?.key ?? "none",
      selected?.remainingQty ?? 0,
    ),
    queryFn: () =>
      listPutawaySuggestionResult({
        sku: selected!.sku,
        packageCount: Math.max(1, selected!.remainingQty),
        lotId: selected!.lotId,
        packageSpec: selected!.packageSpec,
      }),
  });
  const layoutQuery = useQuery({
    enabled: canView && isCompletedDetail,
    queryKey: ["warehouse-operation", "layout"],
    queryFn: fetchWarehouseLayout,
  });
  const completedRackCellQueries = useQueries({
    queries: (layoutQuery.data?.racks ?? []).map((rack) => ({
      enabled: canView && isCompletedDetail,
      queryKey: ["warehouse-operation", "rack-cells", "completed", rack.id],
      queryFn: () => listRackCells(rack.id),
    })),
  });
  const completedMatches = (() => {
    if (!selected || !isCompletedDetail) return [];

    return completedRackCellQueries.flatMap((query) =>
      (query.data ?? []).flatMap((cell) => {
        const matchedContents = cell.contents.filter((content) => {
          const sameSku = content.sku === selected.sku;
          const sameLot = selected.lotNumber
            ? content.lotNumber === selected.lotNumber
            : true;
          return sameSku && sameLot;
        });

        if (matchedContents.length === 0) {
          return [];
        }

        return [
          {
            cell,
            matchedQuantity: matchedContents.reduce(
              (total, content) => total + content.quantity,
              0,
            ),
          },
        ];
      }),
    );
  })();
  const completedRackIds = [
    ...new Set(completedMatches.map((match) => match.cell.rackId)),
  ];
  const completedPathQueries = useQueries({
    queries: completedRackIds.map((rackId) => ({
      enabled: canView && isCompletedDetail,
      queryKey: ["warehouse-operation", "path", "completed", rackId],
      queryFn: () => getNavigationPath(rackId),
    })),
  });
  const completedPathsByRackId = new Map(
    completedRackIds.map((rackId, index) => [
      rackId,
      completedPathQueries[index]?.data,
    ]),
  );
  const completedSuggestions = (() => {
    const suggestions = completedMatches.flatMap((match) => {
      const path = completedPathsByRackId.get(match.cell.rackId);
      if (!path) return [];

      return [
        {
          cellId: match.cell.id,
          cellCode: match.cell.code,
          rackId: match.cell.rackId,
          level: match.cell.level,
          bay: match.cell.bay,
          path,
          quantity: match.matchedQuantity,
          fillPercent: match.cell.fillPercent,
          reason: `Đã cất tại đây · ${match.matchedQuantity} thùng`,
          lotNumber: selected?.lotNumber ?? null,
          expiryDate: selected?.expiryDate ?? null,
        },
      ];
    });

    return suggestions.sort(
      (left, right) => left.path.distanceM - right.path.distanceM,
    );
  })();

  const confirmMutation = useMutation({
    mutationFn: async (input: {
      itemBarcode: string;
      cellBarcode: string;
      quantity: number;
      suggestedCellId?: string;
      actualCellId?: string;
    }) => {
      if (!selected || !canConfirm) throw new Error("Không có quyền cất hàng.");
      return confirmPutawayLine(selected.taskId, {
        itemBarcode: input.itemBarcode,
        cellBarcode: input.cellBarcode,
        quantity: input.quantity,
        suggestedCellId: input.suggestedCellId,
        lotId: selected.lotId,
      });
    },
    onError: async (error) => {
      const code = getApiErrorCode(error);
      const messages: Partial<Record<string, string>> = {
        PUTAWAY_CELL_CAPACITY_EXCEEDED:
          "Khoang vừa hết chỗ. Đã tải lại sức chứa và gợi ý kế tiếp.",
        GRN_PACKAGE_SPEC_REQUIRED:
          "Mặt hàng chưa có đủ kích thước thùng để tính sức chứa.",
      };
      toast.error(
        (code && messages[code]) ||
          getApiErrorMessage(error) ||
          "Không thể lưu cất hàng.",
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["putaway-suggestions"] }),
        queryClient.invalidateQueries({
          queryKey: ["warehouse-operation", "rack-cells"],
        }),
      ]);
    },
    onSuccess: async () => {
      toast.success("Đã lưu thùng hàng vào khoang.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["putaway-tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["putaway-suggestions"] }),
        queryClient.invalidateQueries({ queryKey: ["goods-receipt-notes"] }),
        queryClient.invalidateQueries({
          queryKey: ["warehouse-operation", "rack-cells"],
        }),
      ]);
    },
  });

  async function refresh() {
    await Promise.all([
      tasksQuery.refetch(),
      ...receiptQueries.map((query) => query.refetch()),
      ...(selected && canConfirm && status === "PENDING"
        ? [suggestionQuery.refetch()]
        : []),
    ]);
  }

  if (!canView) {
    return (
      <PermissionNotice>
        Chỉ Admin, Manager và Receiver được xem lệnh cất hàng.
      </PermissionNotice>
    );
  }

  const viewingDetail = activeTab === "putaway-tasks" && Boolean(selected);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cất hàng"
        actions={
          activeTab === "putaway-tasks" ? (
            <div className="flex flex-wrap items-center gap-2">
              {viewingDetail ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedKey("");
                  }}
                >
                  <ArrowLeft data-icon="inline-start" />
                  Quay lại danh sách
                </Button>
              ) : null}
              <Button variant="outline" onClick={() => void refresh()}>
                <RefreshCw data-icon="inline-start" />
                Làm mới
              </Button>
            </div>
          ) : null
        }
      />

      <Tabs
        className="space-y-4"
        value={activeTab}
        onValueChange={setActiveTab}
      >
        <TabsList>
          <TabsTrigger value="putaway-tasks">Lệnh cất hàng</TabsTrigger>
          <TabsTrigger value="inventory-reconciliation">
            Phân khoang tồn cũ
          </TabsTrigger>
        </TabsList>
        <TabsContent className="space-y-4" value="putaway-tasks">
          {!canConfirm ? (
            <PermissionNotice>
              Manager được theo dõi tiến độ; chỉ Admin và Receiver được quét xác
              nhận.
            </PermissionNotice>
          ) : null}
          {tasksQuery.error || firstReceiptError ? (
            <ErrorBanner error={tasksQuery.error ?? firstReceiptError} />
          ) : null}

          {viewingDetail && selected ? (
            <div className="space-y-4">
              <Card>
                <CardHeader className="border-b bg-muted/20">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1.5">
                      <CardTitle className="text-base">
                        {selected.itemName}
                      </CardTitle>
                      <div className="font-mono text-sm text-muted-foreground">
                        {selected.sku}
                      </div>
                    </div>
                    <StatusBadge tone={statusTone(selectedStatus)}>
                      {selectedStatus === "PENDING"
                        ? "Đang cất"
                        : statusLabel(selectedStatus)}
                    </StatusBadge>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3 pt-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="text-xs text-muted-foreground">
                      Phiếu nhập
                    </div>
                    <div className="mt-1 font-mono text-sm font-medium">
                      {selected.grnNumber}
                    </div>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="text-xs text-muted-foreground">Số lô</div>
                    <div className="mt-1 font-mono text-sm font-medium">
                      {selected.lotNumber ?? "—"}
                    </div>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="text-xs text-muted-foreground">
                      Kích thước thùng
                    </div>
                    <div className="mt-1 text-sm font-medium">
                      {selected.packageSpec
                        ? `${selected.packageSpec.depthCm} × ${selected.packageSpec.widthCm} × ${selected.packageSpec.heightCm} cm`
                        : "Chưa khai báo"}
                    </div>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="text-xs text-muted-foreground">
                      Ngày sản xuất
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-sm font-medium">
                      <CalendarDays className="size-3.5 text-primary" />
                      {formatDate(selected.manufacturedDate)}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {selectedStatus === "PENDING" && canConfirm ? (
                <WarehouseOperationWorkspace
                  key={selected.key}
                  operation="PUTAWAY"
                  sku={selected.sku}
                  remainingPackageCount={selected.remainingQty}
                  packageSpec={selected.packageSpec}
                  suggestions={suggestionQuery.data?.suggestions ?? []}
                  suggestionsLoading={suggestionQuery.isLoading}
                  suggestionsError={suggestionQuery.error}
                  pending={confirmMutation.isPending}
                  onConfirm={async (input) => {
                    await confirmMutation.mutateAsync(input);
                  }}
                />
              ) : (
                <WarehouseOperationWorkspace
                  key={`${selected.key}:readonly`}
                  operation="PUTAWAY"
                  sku={selected.sku}
                  remainingPackageCount={selected.remainingQty}
                  packageSpec={selected.packageSpec}
                  suggestions={completedSuggestions}
                  suggestionsLoading={
                    layoutQuery.isLoading ||
                    completedRackCellQueries.some((query) => query.isLoading) ||
                    completedPathQueries.some((query) => query.isLoading)
                  }
                  suggestionsError={
                    layoutQuery.error ??
                    completedRackCellQueries.find((query) => query.error)
                      ?.error ??
                    completedPathQueries.find((query) => query.error)?.error
                  }
                  readOnly
                  readOnlyMessage={
                    selectedStatus === "COMPLETED"
                      ? completedSuggestions.length > 0
                        ? "Dòng hàng này đã được cất hoàn tất. Bản đồ bên dưới hiển thị vị trí đang chứa hàng."
                        : "Dòng hàng này đã được cất hoàn tất nhưng chưa tìm thấy vị trí tồn thực tế khớp trên sơ đồ."
                      : "Chế độ theo dõi không cho phép quét xác nhận."
                  }
                  onConfirm={async () => {}}
                />
              )}
            </div>
          ) : (
            <Card>
              <CardHeader className="border-b bg-muted/20">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Boxes className="size-4 text-primary" />
                      Danh sách mặt hàng
                    </CardTitle>
                    <div className="text-sm text-muted-foreground">
                      Chọn một dòng để mở bản đồ cất hàng trong cùng tab.
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {visibleItems.length} mặt hàng
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="grid gap-2 md:grid-cols-[minmax(0,320px)_180px]">
                  <label className="relative">
                    <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      aria-label="Tìm mặt hàng cất"
                      className="pl-9"
                      placeholder="Tìm SKU, lô, phiếu nhập..."
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </label>
                  <Select
                    value={status}
                    onValueChange={(value) => {
                      setStatus(value as PutawayTaskStatus | "ALL");
                      setSelectedKey("");
                    }}
                  >
                    <SelectTrigger aria-label="Trạng thái cất hàng">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Tất cả</SelectItem>
                      <SelectItem value="PENDING">Đang cất</SelectItem>
                      <SelectItem value="COMPLETED">Đã hoàn tất</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {tasksQuery.isLoading || receiptsLoading ? (
                  <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
                    <LoaderCircle className="size-4 animate-spin" />
                    Đang ghép lệnh với phiếu nhập...
                  </div>
                ) : (
                  <Table scrollable>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Mặt hàng</TableHead>
                        <TableHead>Số lô</TableHead>
                        <TableHead>Số phiếu nhập</TableHead>
                        <TableHead>Trạng thái</TableHead>
                        <TableHead>SL còn lại</TableHead>
                        <TableHead>Ngày sản xuất</TableHead>
                        <TableHead className="w-40 text-right">
                          Thao tác
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleItems.length === 0 ? (
                        <TableRow>
                          <TableCell
                            className="h-24 text-center text-muted-foreground"
                            colSpan={8}
                          >
                            Không có mặt hàng phù hợp.
                          </TableCell>
                        </TableRow>
                      ) : (
                        visibleItems.map((item) => (
                          <TableRow key={item.key}>
                            <TableCell className="font-mono font-medium">
                              {item.sku}
                            </TableCell>
                            <TableCell className="font-medium">
                              {item.itemName}
                            </TableCell>
                            <TableCell className="font-mono">
                              {item.lotNumber ?? "—"}
                            </TableCell>
                            <TableCell className="font-mono">
                              {item.grnNumber}
                            </TableCell>
                            <TableCell>
                              <StatusBadge tone={statusTone(item.taskStatus)}>
                                {item.taskStatus === "PENDING"
                                  ? "Đang cất"
                                  : statusLabel(item.taskStatus)}
                              </StatusBadge>
                            </TableCell>
                            <TableCell>{item.remainingQty} thùng</TableCell>
                            <TableCell>
                              {formatDate(item.manufacturedDate)}
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end">
                                <Button
                                  size="sm"
                                  type="button"
                                  variant="outline"
                                  onClick={() => setSelectedKey(item.key)}
                                >
                                  <Eye data-icon="inline-start" />
                                  Mở bản đồ
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="inventory-reconciliation">
          <InventoryReconciliationPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
