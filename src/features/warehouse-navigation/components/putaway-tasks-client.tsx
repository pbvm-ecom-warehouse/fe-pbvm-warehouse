"use client";

import { useMemo, useState } from "react";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Boxes,
  CalendarDays,
  LoaderCircle,
  PackageSearch,
  RefreshCw,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PageHeader,
  PermissionNotice,
} from "@/features/admin-shell/components/operations-ui";
import {
  getGoodsReceiptNote,
  type GoodsReceiptNote,
} from "@/features/purchases/services/goods-receipt-note.service";
import { useSessionUser } from "@/hooks/use-session-user";
import { getApiErrorCode, getApiErrorMessage } from "@/lib/api-contract";
import { hasAnyRole } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { listPutawaySuggestionResult } from "../services/putaway-navigation.service";
import {
  confirmPutawayLine,
  listPutawayTasks,
  type PutawayTaskStatus,
} from "../services/putaway-task.service";
import { buildPutawayWorkItems } from "../utils/putaway-work-items";
import { WarehouseOperationWorkspace } from "./warehouse-operation-workspace";

const keys = {
  list: (status: PutawayTaskStatus) =>
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

export function PutawayTasksClient() {
  const user = useSessionUser();
  const queryClient = useQueryClient();
  const canView = hasAnyRole(user?.roles, ["ADMIN", "MANAGER", "RECEIVER"]);
  const canConfirm = hasAnyRole(user?.roles, ["ADMIN", "RECEIVER"]);
  const [status, setStatus] = useState<PutawayTaskStatus>("PENDING");
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState("");

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
    includeCompleted: status === "COMPLETED",
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
  const effectiveSelectedKey = visibleItems.some(
    (item) => item.key === selectedKey,
  )
    ? selectedKey
    : (visibleItems[0]?.key ?? "");
  const selected = visibleItems.find(
    (item) => item.key === effectiveSelectedKey,
  );
  const receiptsLoading = receiptQueries.some((query) => query.isLoading);
  const firstReceiptError = receiptQueries.find((query) => query.error)?.error;

  const suggestionQuery = useQuery({
    enabled: canConfirm && status === "PENDING" && Boolean(selected),
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

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={
          <Badge
            className="border-blue-200 bg-blue-50 text-blue-700"
            variant="outline"
          >
            Vận hành kho 2D
          </Badge>
        }
        title="Cất hàng"
        actions={
          <Button variant="outline" onClick={() => void refresh()}>
            <RefreshCw data-icon="inline-start" />
            Làm mới
          </Button>
        }
      />
      {!canConfirm ? (
        <PermissionNotice>
          Manager được theo dõi tiến độ; chỉ Admin và Receiver được quét xác
          nhận.
        </PermissionNotice>
      ) : null}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(300px,360px)_minmax(0,1fr)]">
        <Card className="overflow-hidden xl:sticky xl:top-4">
          <CardHeader className="border-b bg-slate-950 text-white">
            <CardTitle className="flex items-center gap-2 text-base">
              <PackageSearch className="size-4 text-amber-400" />
              Danh sách mặt hàng
            </CardTitle>
            <CardDescription className="text-slate-300">
              Chọn một dòng để xem vị trí, đường đi và sức chứa.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <div className="grid gap-2 sm:grid-cols-[1fr_140px] xl:grid-cols-1">
              <label className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  aria-label="Tìm mặt hàng cất"
                  className="pl-9"
                  placeholder="SKU, tên, lô, phiếu nhập"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <Select
                value={status}
                onValueChange={(value) => {
                  setStatus(value as PutawayTaskStatus);
                  setSelectedKey("");
                }}
              >
                <SelectTrigger aria-label="Trạng thái cất hàng">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">Đang cất</SelectItem>
                  <SelectItem value="COMPLETED">Đã hoàn tất</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {tasksQuery.error || firstReceiptError ? (
              <ErrorBanner error={tasksQuery.error ?? firstReceiptError} />
            ) : null}
            {tasksQuery.isLoading || receiptsLoading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <LoaderCircle className="mr-2 inline size-4 animate-spin" />
                Đang ghép lệnh với phiếu nhập...
              </div>
            ) : visibleItems.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                <Boxes className="mx-auto mb-2 size-6" />
                Không có mặt hàng phù hợp.
              </div>
            ) : (
              <div className="max-h-[62vh] space-y-2 overflow-y-auto pr-1">
                {visibleItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={cn(
                      "w-full rounded-xl border p-3 text-left transition hover:border-blue-400 hover:bg-blue-50",
                      item.key === effectiveSelectedKey
                        ? "border-blue-600 bg-blue-50 ring-2 ring-blue-100"
                        : "bg-white",
                    )}
                    onClick={() => setSelectedKey(item.key)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-mono text-sm font-bold text-slate-950">
                          {item.sku}
                        </div>
                        <div className="mt-0.5 truncate text-sm font-medium">
                          {item.itemName}
                        </div>
                      </div>
                      <Badge variant="secondary">
                        {item.remainingQty} thùng
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{item.grnNumber}</span>
                      {item.lotNumber ? <span>Lô {item.lotNumber}</span> : null}
                      {item.itemType ? <span>Loại {item.itemType}</span> : null}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-4">
          {selected ? (
            <>
              <Card>
                <CardContent className="grid gap-3 pt-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Phiếu nhập
                    </div>
                    <div className="mt-1 font-mono text-sm font-semibold">
                      {selected.grnNumber}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Số lô</div>
                    <div className="mt-1 font-mono text-sm font-semibold">
                      {selected.lotNumber ?? "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Kích thước thùng
                    </div>
                    <div className="mt-1 text-sm font-semibold">
                      {selected.packageSpec
                        ? `${selected.packageSpec.depthCm} × ${selected.packageSpec.widthCm} × ${selected.packageSpec.heightCm} cm`
                        : "Chưa khai báo"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Ngày sản xuất
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold">
                      <CalendarDays className="size-3.5 text-blue-700" />
                      {selected.manufacturedDate ?? "—"}
                    </div>
                  </div>
                </CardContent>
              </Card>
              {status === "PENDING" && canConfirm ? (
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
                <Card>
                  <CardContent className="py-10 text-center text-sm text-muted-foreground">
                    {status === "COMPLETED"
                      ? "Dòng hàng này đã được cất hoàn tất."
                      : "Chế độ theo dõi không cho phép quét xác nhận."}
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-16 text-center text-sm text-muted-foreground">
                Chọn một mặt hàng để mở bản đồ kho.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
