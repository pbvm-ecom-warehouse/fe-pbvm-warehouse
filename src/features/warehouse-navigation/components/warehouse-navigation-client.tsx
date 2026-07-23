"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArrowRight,
  Barcode,
  ClipboardCheck,
  Eye,
  LoaderCircle,
  MapPinned,
  PackageCheck,
  RefreshCw,
  Save,
  Search,
  Warehouse,
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
import { Label } from "@/components/ui/label";
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
import {
  EmptyState,
  PageHeader,
  PermissionNotice,
  StatusBadge,
  TableSkeleton,
} from "@/features/admin-shell/components/operations-ui";
import {
  getWarehouseLayout,
  listShelfContents,
} from "@/features/warehouse-layout/services/warehouse-layout.service";
import {
  WarehouseArchitectureScene,
  type WarehouseSceneMode,
} from "@/features/warehouse-navigation/components/warehouse-architecture-scene";
import {
  getApiErrorMessage,
  isMissingBackendEndpoint,
} from "@/lib/api-contract";
import { hasAnyRole } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { statusLabel, statusTone } from "@/lib/wms-ui-labels";
import { useSessionUser } from "@/hooks/use-session-user";
import type { ShelfContentItem } from "@/types/api";

import {
  listPutawaySuggestionResult,
  type PutawayShelfSuggestion,
  type PutawaySuggestionWarning,
} from "../services/putaway-navigation.service";
import {
  confirmPutawayLine,
  getPutawayTask,
  listPutawayTasks,
  PUTAWAY_TASK_STATUSES,
  type PutawayTask,
  type PutawayTaskItem,
  type PutawayTaskStatus,
} from "../services/putaway-task.service";
import {
  buildLayoutPutawaySuggestions,
  groupShelvesByRack,
  layoutToWarehouseShelves,
  selectSuggestedShelf,
} from "../utils/putaway-navigation";

const PAGE_SIZE = 20;

const putawayKeys = {
  detail: (taskId: string) => ["putaway-tasks", "detail", taskId] as const,
  list: (params: { page: number; status: PutawayTaskStatus | "ALL" }) =>
    ["putaway-tasks", "list", params] as const,
  suggestions: ({
    itemId,
    quantity,
    sku,
    warehouseId,
  }: {
    itemId: string;
    quantity: number;
    sku: string;
    warehouseId: string;
  }) =>
    [
      "putaway-tasks",
      "suggestions",
      warehouseId,
      itemId,
      sku,
      quantity,
    ] as const,
};

const defaultConfirmForm = {
  itemBarcode: "",
  lotId: "",
  quantity: "1",
  shelfCode: "",
};

function formatError(error: unknown) {
  return getApiErrorMessage(error) ?? "Không kết nối được WMS.";
}

function parsePositiveNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function warningLabel(warning: PutawaySuggestionWarning | null | undefined) {
  if (warning === "ITEM_NO_DIMENSIONS") {
    return "Mặt hàng chưa có kích thước nên hệ thống chưa tính được vị trí tối ưu.";
  }

  if (warning === "NO_SHELF_FITS") {
    return "Chưa tìm thấy vị trí kệ phù hợp với kích thước mặt hàng.";
  }

  if (warning === "INSUFFICIENT_CAPACITY") {
    return "Có vị trí phù hợp nhưng chưa đủ sức chứa cho toàn bộ số lượng.";
  }

  return null;
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <TableRow>
      <TableCell
        className="h-20 text-center text-sm text-muted-foreground"
        colSpan={colSpan}
      >
        {label}
      </TableCell>
    </TableRow>
  );
}

function ErrorBanner({ error }: { error: unknown }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
      {formatError(error)}
    </div>
  );
}

function ShelfCodeFallback({
  shelfCode,
  text,
}: {
  shelfCode: string;
  text: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3">
      <div className="text-xs font-medium text-muted-foreground">
        Mã vị trí cần đến
      </div>
      <div className="mt-1 font-mono text-lg font-semibold text-primary">
        {shelfCode}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{text}</p>
    </div>
  );
}

export function WarehouseNavigationClient() {
  const user = useSessionUser();
  const queryClient = useQueryClient();
  const canUsePutawayApi = hasAnyRole(user?.roles, [
    "ADMIN",
    "MANAGER",
    "RECEIVER",
  ]);
  const canManageStructure = hasAnyRole(user?.roles, ["MANAGER"]);
  const [statusFilter, setStatusFilter] = useState<PutawayTaskStatus | "ALL">(
    "PENDING",
  );
  const [page, setPage] = useState(1);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [confirmForm, setConfirmForm] = useState(defaultConfirmForm);
  const [sceneMode, setSceneMode] = useState<WarehouseSceneMode>("map");
  const [selectedRackCode, setSelectedRackCode] = useState<string | null>(null);
  const [selectedShelfCode, setSelectedShelfCode] = useState<string | null>(
    null,
  );

  const tasksQuery = useQuery({
    enabled: canUsePutawayApi,
    queryFn: () =>
      listPutawayTasks({
        limit: PAGE_SIZE,
        page,
        status: statusFilter,
      }),
    queryKey: putawayKeys.list({ page, status: statusFilter }),
  });

  const tasks = useMemo(() => tasksQuery.data?.data ?? [], [tasksQuery.data]);
  const selectedTask =
    tasks.find((task) => task.id === selectedTaskId) ?? tasks[0];
  const activeTaskId = selectedTask?.id ?? "";
  const total = tasksQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const detailQuery = useQuery({
    enabled: canUsePutawayApi && Boolean(activeTaskId),
    queryFn: () => getPutawayTask(activeTaskId),
    queryKey: putawayKeys.detail(activeTaskId),
  });
  const detail = detailQuery.data ?? selectedTask;
  const selectedItem = selectedItemId
    ? detail?.items.find((item) => item.itemId === selectedItemId)
    : undefined;
  const activeItemId = selectedItem?.itemId ?? "";
  const activeWarehouseId = detail?.warehouseId ?? "";
  const suggestionQty = selectedItem
    ? Math.max(1, selectedItem.remainingQty ?? selectedItem.quantity)
    : 1;

  const layoutQuery = useQuery({
    enabled: canUsePutawayApi && Boolean(activeWarehouseId),
    queryFn: () => getWarehouseLayout(activeWarehouseId, "published"),
    queryKey: ["warehouse-layout", activeWarehouseId, "published"],
    retry: false,
  });

  const suggestionsQuery = useQuery({
    enabled:
      canUsePutawayApi &&
      Boolean(activeWarehouseId) &&
      Boolean(activeItemId) &&
      Boolean(selectedItem?.sku),
    queryFn: () =>
      listPutawaySuggestionResult({
        quantity: suggestionQty,
        sku: selectedItem?.sku ?? "",
        warehouseId: activeWarehouseId,
      }),
    queryKey: putawayKeys.suggestions({
      itemId: activeItemId,
      quantity: suggestionQty,
      sku: selectedItem?.sku ?? "",
      warehouseId: activeWarehouseId,
    }),
    retry: false,
  });

  const apiSuggestions = useMemo(
    () => suggestionsQuery.data?.suggestions ?? [],
    [suggestionsQuery.data?.suggestions],
  );
  const layout = layoutQuery.data ?? null;
  const layoutShelves = useMemo(
    () => (layout ? layoutToWarehouseShelves(layout) : []),
    [layout],
  );
  const visualSuggestions = useMemo(
    () =>
      layout
        ? buildLayoutPutawaySuggestions({
            layout,
            suggestions: apiSuggestions,
          })
        : [],
    [apiSuggestions, layout],
  );
  const selectedVisualSuggestion = useMemo(
    () =>
      visualSuggestions.find(
        (suggestion) => suggestion.shelf.code === selectedShelfCode,
      ) ?? selectSuggestedShelf(visualSuggestions),
    [selectedShelfCode, visualSuggestions],
  );
  const activeSelectedShelfCode =
    selectedShelfCode ?? selectedVisualSuggestion?.shelf.code ?? null;
  const activeSelectedRackCode =
    selectedRackCode ?? selectedVisualSuggestion?.shelf.rackCode ?? null;
  const suggestedShelfCodes = useMemo(
    () => new Set(apiSuggestions.map((suggestion) => suggestion.shelfCode)),
    [apiSuggestions],
  );
  const rackGroup = useMemo(
    () =>
      activeSelectedRackCode
        ? (groupShelvesByRack(layoutShelves).find(
            (group) => group.rackCode === activeSelectedRackCode,
          ) ?? null)
        : null,
    [activeSelectedRackCode, layoutShelves],
  );
  const layoutSource = layout
    ? "api"
    : layoutQuery.error && isMissingBackendEndpoint(layoutQuery.error)
      ? "unsupported"
      : "missing";
  const contentQueries = useQueries({
    queries:
      sceneMode === "rack" && rackGroup && activeWarehouseId
        ? rackGroup.shelves.map((shelf) => ({
            enabled: true,
            queryFn: () =>
              listShelfContents({
                shelfCode: shelf.code,
                warehouseId: activeWarehouseId,
              }),
            queryKey: [
              "warehouse-shelf-contents",
              activeWarehouseId,
              shelf.code,
            ],
            retry: false,
          }))
        : [],
  });
  const contentsByShelf = useMemo(() => {
    const contents: Record<string, ShelfContentItem[] | undefined> = {};

    rackGroup?.shelves.forEach((shelf, index) => {
      const data = contentQueries[index]?.data;
      contents[shelf.code] = Array.isArray(data) ? data : [];
    });

    return contents;
  }, [contentQueries, rackGroup]);
  const loadingShelfCodes = useMemo(
    () =>
      new Set(
        rackGroup?.shelves
          .filter((_, index) => contentQueries[index]?.isLoading)
          .map((shelf) => shelf.code) ?? [],
      ),
    [contentQueries, rackGroup],
  );
  const erroredShelfCodes = useMemo(
    () =>
      new Set(
        rackGroup?.shelves
          .filter((_, index) => contentQueries[index]?.isError)
          .map((shelf) => shelf.code) ?? [],
      ),
    [contentQueries, rackGroup],
  );
  const unsupportedShelfCodes = useMemo(
    () =>
      new Set(
        rackGroup?.shelves
          .filter((_, index) =>
            isMissingBackendEndpoint(contentQueries[index]?.error),
          )
          .map((shelf) => shelf.code) ?? [],
      ),
    [contentQueries, rackGroup],
  );

  const confirmMutation = useMutation({
    mutationFn: () =>
      confirmPutawayLine(activeTaskId, {
        itemBarcode: confirmForm.itemBarcode.trim(),
        lotId: optionalText(confirmForm.lotId),
        quantity: parsePositiveNumber(confirmForm.quantity),
        shelfCode: confirmForm.shelfCode.trim(),
      }),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: () => {
      setConfirmForm(defaultConfirmForm);
      void queryClient.invalidateQueries({ queryKey: ["putaway-tasks"] });
      toast.success("Đã xác nhận dòng cất hàng");
    },
  });

  function handleFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
  }

  function handleConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeTaskId || !confirmForm.itemBarcode || !confirmForm.shelfCode) {
      toast.error("Cần quét mã vạch mặt hàng và mã vị trí.");
      return;
    }

    confirmMutation.mutate();
  }

  function selectTask(task: PutawayTask) {
    setSelectedTaskId(task.id);
    setSelectedItemId("");
    setConfirmForm(defaultConfirmForm);
    setSceneMode("map");
    setSelectedRackCode(null);
    setSelectedShelfCode(null);
  }

  function selectItem(item: PutawayTaskItem) {
    const qty = item.remainingQty ?? item.quantity;

    setSelectedItemId(item.itemId);
    setConfirmForm({
      itemBarcode: "",
      lotId: item.lotId ?? "",
      quantity: String(Math.max(1, qty)),
      shelfCode: "",
    });
    setSceneMode("map");
    setSelectedRackCode(null);
    setSelectedShelfCode(null);
  }

  function selectSuggestion(suggestion: PutawayShelfSuggestion) {
    const visualSuggestion = visualSuggestions.find(
      (item) => item.shelf.code === suggestion.shelfCode,
    );

    setSelectedShelfCode(suggestion.shelfCode);
    setSelectedRackCode(visualSuggestion?.shelf.rackCode ?? null);
    setSceneMode(visualSuggestion ? "rack" : "map");
    setConfirmForm((current) => ({
      ...current,
      quantity: String(
        Math.min(parsePositiveNumber(current.quantity), suggestion.capacity),
      ),
      shelfCode: suggestion.shelfCode,
    }));
  }

  function openRack(rackCode: string, shelfCode: string) {
    setSelectedRackCode(rackCode);
    setSelectedShelfCode(shelfCode);
    setConfirmForm((current) => ({ ...current, shelfCode }));
    setSceneMode("rack");
  }

  function selectShelfOnRack(shelfCode: string) {
    setSelectedShelfCode(shelfCode);
    setConfirmForm((current) => ({ ...current, shelfCode }));
  }

  function retryShelfContents(shelfCode: string) {
    void queryClient.invalidateQueries({
      queryKey: ["warehouse-shelf-contents", activeWarehouseId, shelfCode],
    });
  }

  const warning = warningLabel(suggestionsQuery.data?.warning);
  const fallbackShelfCode =
    selectedShelfCode ?? apiSuggestions[0]?.shelfCode ?? "";
  const shouldShowShelfFallback =
    Boolean(fallbackShelfCode) &&
    (!layout ||
      !visualSuggestions.some(
        (suggestion) => suggestion.shelf.code === fallbackShelfCode,
      ));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cất hàng"
        actions={
          <>
            <Button
              disabled={!canUsePutawayApi}
              onClick={() =>
                void queryClient.invalidateQueries({
                  queryKey: ["putaway-tasks"],
                })
              }
              type="button"
              variant="outline"
            >
              {tasksQuery.isFetching || detailQuery.isFetching ? (
                <LoaderCircle
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : (
                <RefreshCw data-icon="inline-start" />
              )}
              Làm mới
            </Button>
            {canManageStructure ? (
              <Button asChild variant="outline">
                <Link href="/warehouses">
                  <Warehouse data-icon="inline-start" />
                  Quản lý vị trí
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      {!canUsePutawayApi ? (
        <PermissionNotice>
          Bạn cần quyền phù hợp để xử lý cất hàng.
        </PermissionNotice>
      ) : null}

      {tasksQuery.error ? <ErrorBanner error={tasksQuery.error} /> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="border-b bg-muted/20">
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardCheck className="size-4 text-primary" />
                Phiếu cất hàng
              </CardTitle>
              <CardDescription>
                {total} bản ghi · trang {page}/{totalPages}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <form
                className="grid gap-3 md:grid-cols-[220px_auto]"
                onSubmit={handleFilter}
              >
                <div className="space-y-2">
                  <Label>Trạng thái</Label>
                  <Select
                    value={statusFilter}
                    onValueChange={(value) => {
                      setPage(1);
                      setStatusFilter(value as PutawayTaskStatus | "ALL");
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Tất cả</SelectItem>
                      {PUTAWAY_TASK_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {statusLabel(status)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="self-end"
                  disabled={!canUsePutawayApi}
                  type="submit"
                >
                  <Search data-icon="inline-start" />
                  Lọc
                </Button>
              </form>

              {tasksQuery.isLoading ? (
                <TableSkeleton columns={5} />
              ) : (
                <PutawayTaskTable
                  selectedId={activeTaskId}
                  tasks={tasks}
                  onSelect={selectTask}
                />
              )}

              <div className="flex items-center justify-between gap-3">
                <Button
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  type="button"
                  variant="outline"
                >
                  Trang trước
                </Button>
                <span className="text-sm text-muted-foreground">
                  {page}/{totalPages}
                </span>
                <Button
                  disabled={page >= totalPages}
                  onClick={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                  type="button"
                  variant="outline"
                >
                  Trang sau
                </Button>
              </div>
            </CardContent>
          </Card>

          {detail ? (
            <PutawayTaskDetail
              detail={detail}
              selectedItemId={selectedItem?.itemId ?? ""}
              onSelectItem={selectItem}
            />
          ) : null}

          {selectedItem && activeWarehouseId ? (
            <WarehouseArchitectureScene
              contentsByShelf={contentsByShelf}
              erroredShelfCodes={erroredShelfCodes}
              layout={layout}
              layoutSource={layoutSource}
              loadingShelfCodes={loadingShelfCodes}
              onBackToMap={() => setSceneMode("map")}
              onOpenRack={openRack}
              onRetryShelf={retryShelfContents}
              onSelectShelf={selectShelfOnRack}
              rackGroup={rackGroup}
              route={selectedVisualSuggestion?.route ?? null}
              sceneMode={sceneMode}
              selectedRackCode={activeSelectedRackCode}
              selectedShelfCode={activeSelectedShelfCode}
              suggestions={visualSuggestions}
              suggestedShelfCodes={suggestedShelfCodes}
              unsupportedShelfCodes={unsupportedShelfCodes}
            />
          ) : null}
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPinned className="size-4 text-primary" />
                Vị trí cất hàng
              </CardTitle>
              <CardDescription>
                {selectedItem?.sku ?? "Chọn dòng hàng để xem vị trí"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedItem ? (
                <EmptyState title="Chọn dòng hàng để xem vị trí" />
              ) : suggestionsQuery.isLoading ? (
                <TableSkeleton columns={2} rows={3} />
              ) : null}

              {suggestionsQuery.error ? (
                <ErrorBanner error={suggestionsQuery.error} />
              ) : null}
              {warning ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  {warning}
                </div>
              ) : null}
              {apiSuggestions.length === 0 && suggestionsQuery.isSuccess ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Chưa có vị trí phù hợp cho mặt hàng và số lượng này.
                </div>
              ) : null}
              {shouldShowShelfFallback ? (
                <ShelfCodeFallback
                  shelfCode={fallbackShelfCode}
                  text="Kho chưa có sơ đồ cho vị trí này. Nhân viên dùng mã vị trí để tìm kệ và quét xác nhận."
                />
              ) : null}
              <div className="grid gap-2">
                {apiSuggestions.map((suggestion) => (
                  <button
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-lg border border-border/70 p-3 text-left text-sm transition hover:bg-accent/60",
                      selectedShelfCode === suggestion.shelfCode &&
                        "border-primary bg-primary/5",
                    )}
                    key={suggestion.shelfCode}
                    onClick={() => selectSuggestion(suggestion)}
                    type="button"
                  >
                    <span className="font-mono font-semibold">
                      {suggestion.shelfCode}
                    </span>
                    <Badge variant="outline">
                      {suggestion.capacity.toLocaleString("vi-VN")} còn trống
                    </Badge>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {selectedItem ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Barcode className="size-4 text-primary" />
                  Xác nhận cất hàng
                </CardTitle>
                <CardDescription>
                  Quét mã vạch mặt hàng, quét mã vị trí và nhập số lượng thực
                  cất.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-3" onSubmit={handleConfirm}>
                  <TextField
                    id="putaway-confirm-barcode"
                    label="Mã vạch mặt hàng"
                    value={confirmForm.itemBarcode}
                    onChange={(itemBarcode) =>
                      setConfirmForm((current) => ({ ...current, itemBarcode }))
                    }
                  />
                  <TextField
                    id="putaway-confirm-shelf"
                    label="Mã vị trí"
                    value={confirmForm.shelfCode}
                    onChange={(shelfCode) =>
                      setConfirmForm((current) => ({ ...current, shelfCode }))
                    }
                  />
                  <TextField
                    id="putaway-confirm-qty"
                    label="Số lượng"
                    type="number"
                    value={confirmForm.quantity}
                    onChange={(quantity) =>
                      setConfirmForm((current) => ({ ...current, quantity }))
                    }
                  />
                  <TextField
                    id="putaway-confirm-lot"
                    label="Mã lô"
                    required={false}
                    value={confirmForm.lotId}
                    onChange={(lotId) =>
                      setConfirmForm((current) => ({ ...current, lotId }))
                    }
                  />
                  <Button
                    className="w-full"
                    disabled={
                      !canUsePutawayApi ||
                      !activeTaskId ||
                      confirmMutation.isPending
                    }
                    type="submit"
                  >
                    {confirmMutation.isPending ? (
                      <LoaderCircle
                        className="animate-spin"
                        data-icon="inline-start"
                      />
                    ) : (
                      <Save data-icon="inline-start" />
                    )}
                    Xác nhận
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function PutawayTaskTable({
  onSelect,
  selectedId,
  tasks,
}: {
  onSelect: (task: PutawayTask) => void;
  selectedId: string;
  tasks: PutawayTask[];
}) {
  return (
    <Table scrollable>
      <TableHeader>
        <TableRow>
          <TableHead>Mã phiếu</TableHead>
          <TableHead>Mã phiếu nhập</TableHead>
          <TableHead>Kho</TableHead>
          <TableHead>Trạng thái</TableHead>
          <TableHead>Số dòng</TableHead>
          <TableHead className="text-right">Thao tác</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.length === 0 ? (
          <EmptyRow colSpan={6} label="Chưa có phiếu cất hàng." />
        ) : (
          tasks.map((task) => (
            <TableRow
              className={cn(
                "cursor-pointer",
                selectedId === task.id && "bg-primary/5",
              )}
              key={task.id}
              onClick={() => onSelect(task)}
            >
              <TableCell className="font-mono font-semibold">
                {task.id}
              </TableCell>
              <TableCell>{task.grnId}</TableCell>
              <TableCell>{task.warehouseId}</TableCell>
              <TableCell>
                <StatusBadge tone={statusTone(task.status)}>
                  {statusLabel(task.status)}
                </StatusBadge>
              </TableCell>
              <TableCell>{task.items.length}</TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(task);
                  }}
                >
                  <Eye data-icon="inline-start" /> Xem chi tiết
                </Button>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

function PutawayTaskDetail({
  detail,
  onSelectItem,
  selectedItemId,
}: {
  detail: PutawayTask;
  onSelectItem: (item: PutawayTaskItem) => void;
  selectedItemId: string;
}) {
  return (
    <Card>
      <CardHeader className="border-b bg-muted/20">
        <CardTitle className="flex items-center gap-2 text-base">
          <PackageCheck className="size-4 text-primary" />
          Dòng cần cất hàng
        </CardTitle>
        <CardDescription>
          Phiếu nhập {detail.grnId} · Kho {detail.warehouseId}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <Table scrollable>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Số lượng</TableHead>
              <TableHead>Còn lại</TableHead>
              <TableHead>Mã lô</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {detail.items.length === 0 ? (
              <EmptyRow colSpan={4} label="Phiếu cất hàng chưa có dòng hàng." />
            ) : (
              detail.items.map((item) => (
                <TableRow
                  className={cn(
                    "cursor-pointer",
                    selectedItemId === item.itemId && "bg-primary/5",
                  )}
                  key={`${item.itemId}-${item.lotId ?? "none"}`}
                  onClick={() => onSelectItem(item)}
                >
                  <TableCell className="font-mono font-semibold">
                    {item.sku}
                  </TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>{item.remainingQty ?? item.quantity}</TableCell>
                  <TableCell>
                    {item.lotNumber ?? item.lotId ?? "Chưa khai"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function TextField({
  id,
  label,
  onChange,
  required = true,
  type = "text",
  value,
}: {
  id: string;
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  value: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        required={required}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
