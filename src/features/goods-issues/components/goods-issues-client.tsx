"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardList,
  Eye,
  LoaderCircle,
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
  PageHeader,
  PermissionNotice,
  StatusBadge,
  TableSkeleton,
} from "@/features/admin-shell/components/operations-ui";
import { EntityDetailDialog } from "@/features/admin-shell/components/entity-detail-dialog";
import { WarehouseOperationWorkspace } from "@/features/warehouse-navigation/components/warehouse-operation-workspace";
import { listAllWmsUsers } from "@/features/staff/services/staff.service";
import { getApiErrorCode, getApiErrorMessage } from "@/lib/api-contract";
import { hasAnyRole } from "@/lib/rbac";
import { getSessionQueryScope } from "@/lib/session-query-scope";
import { cn } from "@/lib/utils";
import {
  businessCodeLabel,
  statusLabel,
  statusTone,
} from "@/lib/wms-ui-labels";
import { useSessionUser } from "@/hooks/use-session-user";
import {
  assignGoodsIssue,
  confirmGoodsIssueLine,
  getGoodsIssue,
  GOODS_ISSUE_STATUSES,
  listGoodsIssuePickSuggestions,
  listGoodsIssues,
  type GoodsIssue,
  type GoodsIssueItem,
  type GoodsIssueStatus,
} from "../services/goods-issue.service";

const PAGE_SIZE = 20;
const STALE_PICK_SOURCE_CODES = new Set([
  "GOODS_ISSUE_SOURCE_QUARANTINED",
  "GOODS_ISSUE_SOURCE_NOT_PICKABLE",
  "STOCK_INSUFFICIENT",
]);
const keys = {
  list: (scope: string, page: number, status: string) =>
    ["goods-issues", scope, "list", page, status] as const,
  detail: (scope: string, id: string) =>
    ["goods-issues", scope, "detail", id] as const,
  suggestions: (scope: string, id: string, itemId: string) =>
    ["goods-issues", scope, "suggestions", id, itemId] as const,
};

function ErrorBanner({ error }: { error: unknown }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
      {getApiErrorMessage(error) ?? "Không kết nối được WMS."}
    </div>
  );
}
function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <TableRow>
      <TableCell
        colSpan={colSpan}
        className="h-20 text-center text-muted-foreground"
      >
        {text}
      </TableCell>
    </TableRow>
  );
}

export function GoodsIssuesClient() {
  const user = useSessionUser();
  const queryClient = useQueryClient();
  const sessionScope = getSessionQueryScope(user);
  const canView = hasAnyRole(user?.roles, ["ADMIN", "MANAGER", "SHIPPER"]);
  const canAssign = hasAnyRole(user?.roles, ["ADMIN", "MANAGER"]);
  const isShipper = user?.roles.includes("SHIPPER") ?? false;
  const [status, setStatus] = useState<GoodsIssueStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [selectedIssueId, setSelectedIssueId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [selectedShipperId, setSelectedShipperId] = useState("");
  const issuesQuery = useQuery({
    enabled: canView,
    queryKey: keys.list(sessionScope, page, status),
    queryFn: () => listGoodsIssues({ page, limit: PAGE_SIZE, status }),
  });
  const issues = issuesQuery.data?.data ?? [];
  const selectedIssue = issues.find((issue) => issue.id === selectedIssueId);
  const detailQuery = useQuery({
    enabled: Boolean(selectedIssueId),
    queryKey: keys.detail(sessionScope, selectedIssueId),
    queryFn: () => getGoodsIssue(selectedIssueId),
  });
  const detail = detailQuery.data ?? selectedIssue;
  const shippersQuery = useQuery({
    enabled: canAssign,
    queryKey: ["staff", sessionScope, "shipper-options"],
    queryFn: () => listAllWmsUsers({ role: "SHIPPER", status: "ACTIVE" }),
  });
  const shippers = shippersQuery.data?.data ?? [];
  const assignedShipper = shippers.find(
    (shipper) => shipper.id === detail?.assignedShipperId,
  );
  const isOwner =
    Boolean(user?.id) && detail?.assignedShipperId === user?.id && isShipper;
  const canPick = isOwner && detail?.status === "PICKING";
  const selectedItem = detail?.items.find(
    (item) => item.itemId === selectedItemId,
  );
  const suggestionsQuery = useQuery({
    enabled: canPick && Boolean(selectedIssueId && selectedItemId),
    queryKey: keys.suggestions(sessionScope, selectedIssueId, selectedItemId),
    queryFn: () =>
      listGoodsIssuePickSuggestions({
        goodsIssueId: selectedIssueId,
        itemId: selectedItemId,
      }),
  });
  const suggestions = suggestionsQuery.data ?? [];
  const remainingPackageCount = selectedItem
    ? Math.max(1, Math.floor(selectedItem.remainingQty))
    : 1;
  const confirmMutation = useMutation({
    mutationFn: async (input: {
      itemBarcode: string;
      cellBarcode: string;
      quantity: number;
      suggestedCellId?: string;
    }) => {
      const source =
        suggestions.find((item) => item.cellCode === input.cellBarcode) ??
        suggestions[0];
      return confirmGoodsIssueLine(selectedIssueId, {
        ...input,
        ...(source?.lotId ? { lotId: source.lotId } : {}),
      });
    },
    onError: async (error) => {
      const errorCode = getApiErrorCode(error);
      if (errorCode && STALE_PICK_SOURCE_CODES.has(errorCode)) {
        toast.error(
          errorCode === "GOODS_ISSUE_SOURCE_QUARANTINED"
            ? "Kiện hàng này đang chờ hủy. Đã tải lại vị trí FEFO khác để Shipper tiếp tục lấy hàng."
            : "Vị trí lấy hàng không còn khả dụng hoặc không đủ tồn. Đã tải lại gợi ý FEFO.",
        );
        await Promise.all([
          queryClient.invalidateQueries({
            exact: true,
            queryKey: keys.suggestions(
              sessionScope,
              selectedIssueId,
              selectedItemId,
            ),
          }),
          queryClient.invalidateQueries({
            exact: true,
            queryKey: keys.detail(sessionScope, selectedIssueId),
          }),
          queryClient.invalidateQueries({
            queryKey: ["goods-issues", sessionScope, "list"],
          }),
          queryClient.invalidateQueries({
            queryKey: ["warehouse-operation", "rack-cells"],
          }),
        ]);
        return;
      }
      toast.error(getApiErrorMessage(error) ?? "Không thể xác nhận lấy hàng.");
    },
    onSuccess: async () => {
      toast.success("Đã xác nhận lấy hàng đúng khoang.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["goods-issues"] }),
        queryClient.invalidateQueries({
          queryKey: ["warehouse-operation", "rack-cells"],
        }),
      ]);
    },
  });
  const assignMutation = useMutation({
    mutationFn: () => assignGoodsIssue(selectedIssueId, selectedShipperId),
    onError: (error) =>
      toast.error(getApiErrorMessage(error) ?? "Không thể gán phiếu xuất."),
    onSuccess: async (assignedIssue) => {
      queryClient.setQueryData(
        keys.detail(sessionScope, assignedIssue.id),
        assignedIssue,
      );
      setSelectedShipperId("");
      toast.success("Đã gán phiếu xuất cho Shipper.");
      await queryClient.invalidateQueries({ queryKey: ["goods-issues"] });
    },
  });
  const total = issuesQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  function selectIssue(issue: GoodsIssue) {
    setSelectedIssueId(issue.id);
    setSelectedItemId("");
    setSelectedShipperId("");
  }
  function closeIssueDetail() {
    setSelectedIssueId("");
    setSelectedItemId("");
    setSelectedShipperId("");
  }
  function handleFilter(event: FormEvent) {
    event.preventDefault();
    setPage(1);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Xuất kho"
        actions={
          <Button
            variant="outline"
            disabled={!canView}
            onClick={() =>
              void queryClient.invalidateQueries({ queryKey: ["goods-issues"] })
            }
            type="button"
          >
            {issuesQuery.isFetching ? (
              <LoaderCircle className="animate-spin" data-icon="inline-start" />
            ) : (
              <RefreshCw data-icon="inline-start" />
            )}
            Làm mới
          </Button>
        }
      />
      {!canView ? (
        <PermissionNotice>
          Bạn cần quyền phù hợp để xem và xử lý phiếu xuất.
        </PermissionNotice>
      ) : null}
      {issuesQuery.error ? <ErrorBanner error={issuesQuery.error} /> : null}
      <Card>
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="size-4 text-primary" />
            Phiếu xuất kho
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
                value={status}
                onValueChange={(value) => {
                  setStatus(value as GoodsIssueStatus | "ALL");
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tất cả</SelectItem>
                  {GOODS_ISSUE_STATUSES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {statusLabel(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="self-end" type="submit">
              <Search data-icon="inline-start" />
              Lọc
            </Button>
          </form>
          {issuesQuery.isLoading ? (
            <TableSkeleton columns={6} />
          ) : (
            <Table scrollable>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã phiếu xuất</TableHead>
                  <TableHead>Mã đơn hàng</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Shipper</TableHead>
                  <TableHead>Số dòng</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issues.length === 0 ? (
                  <EmptyRow colSpan={6} text="Chưa có phiếu xuất." />
                ) : (
                  issues.map((issue) => (
                    <TableRow
                      key={issue.id}
                      className={cn(
                        "cursor-pointer",
                        selectedIssueId === issue.id && "bg-primary/5",
                      )}
                      onClick={() => selectIssue(issue)}
                    >
                      <TableCell className="font-mono font-semibold">
                        {businessCodeLabel(issue.goodsIssueNumber)}
                      </TableCell>
                      <TableCell>
                        {businessCodeLabel(issue.orderCode)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge tone={statusTone(issue.status)}>
                          {statusLabel(issue.status)}
                        </StatusBadge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {!issue.assignedShipperId
                            ? "Chưa gán Shipper"
                            : issue.assignedShipperId === user?.id
                              ? "Của bạn"
                              : shippers.find(
                                  (shipper) =>
                                    shipper.id === issue.assignedShipperId,
                                )?.name ||
                                shippers.find(
                                  (shipper) =>
                                    shipper.id === issue.assignedShipperId,
                                )?.username ||
                                "Đã gán Shipper"}
                        </Badge>
                      </TableCell>
                      <TableCell>{issue.items.length}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(event) => {
                            event.stopPropagation();
                            selectIssue(issue);
                          }}
                          type="button"
                        >
                          <Eye data-icon="inline-start" />
                          Xem chi tiết
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <EntityDetailDialog
        description={`Mã phiếu xuất: ${businessCodeLabel(detail?.goodsIssueNumber)}`}
        onOpenChange={(open) => {
          if (!open) closeIssueDetail();
        }}
        open={Boolean(selectedIssueId)}
        title="Chi tiết phiếu xuất kho"
      >
        {detailQuery.isLoading && !detail ? (
          <TableSkeleton columns={4} />
        ) : null}
        {detailQuery.error ? <ErrorBanner error={detailQuery.error} /> : null}
        {detail ? (
          <div className="space-y-4">
            <Card>
              <CardHeader className="border-b bg-muted/20">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">
                      Mã đơn hàng: {businessCodeLabel(detail.orderCode)}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {isOwner
                        ? "Nhấn vào dòng hàng để xem vị trí lấy theo FEFO và đường đi."
                        : detail.assignedShipperId
                          ? `Phiếu đã được gán cho ${
                              assignedShipper?.name ||
                              assignedShipper?.username ||
                              "Shipper"
                            }.`
                          : "Admin/Manager cần gán Shipper trước khi bắt đầu lấy hàng."}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">
                      {!detail.assignedShipperId
                        ? "Chưa gán Shipper"
                        : isOwner
                          ? "Của bạn"
                          : assignedShipper?.name ||
                            assignedShipper?.username ||
                            "Đã gán Shipper"}
                    </Badge>
                    <StatusBadge tone={statusTone(detail.status)}>
                      {statusLabel(detail.status)}
                    </StatusBadge>
                    {canAssign &&
                    !detail.assignedShipperId &&
                    detail.status === "PENDING" ? (
                      <div className="min-w-64 space-y-2">
                        {shippersQuery.isError ? (
                          <div
                            className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
                            role="alert"
                          >
                            <span>Không tải được danh sách Shipper.</span>
                            <Button
                              aria-label="Thử tải lại Shipper"
                              onClick={() => void shippersQuery.refetch()}
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              Thử lại
                            </Button>
                          </div>
                        ) : (
                          <>
                            {shippersQuery.isLoading ? (
                              <p className="text-xs text-muted-foreground">
                                Đang tải danh sách Shipper...
                              </p>
                            ) : shippers.length === 0 ? (
                              <p className="text-xs text-amber-700">
                                Không có Shipper đang hoạt động để gán.
                              </p>
                            ) : null}
                            <div className="flex items-center gap-2">
                              <Select
                                disabled={
                                  shippersQuery.isLoading ||
                                  shippers.length === 0
                                }
                                value={selectedShipperId}
                                onValueChange={setSelectedShipperId}
                              >
                                <SelectTrigger aria-label="Chọn Shipper">
                                  <SelectValue placeholder="Chọn Shipper" />
                                </SelectTrigger>
                                <SelectContent>
                                  {shippers.map((shipper) => (
                                    <SelectItem
                                      key={shipper.id}
                                      value={shipper.id}
                                    >
                                      {shipper.name || shipper.username}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                disabled={
                                  !selectedShipperId ||
                                  assignMutation.isPending ||
                                  shippers.length === 0
                                }
                                onClick={() => assignMutation.mutate()}
                                type="button"
                              >
                                {assignMutation.isPending ? (
                                  <LoaderCircle
                                    className="animate-spin"
                                    data-icon="inline-start"
                                  />
                                ) : null}
                                Gán
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <Table scrollable>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Cần xuất</TableHead>
                      <TableHead>Còn lại</TableHead>
                      <TableHead>Đơn vị</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.items.length === 0 ? (
                      <EmptyRow colSpan={4} text="Phiếu chưa có dòng hàng." />
                    ) : (
                      detail.items.map((item: GoodsIssueItem) => (
                        <TableRow
                          key={item.itemId}
                          className={cn(
                            canPick && "cursor-pointer hover:bg-accent/60",
                            selectedItemId === item.itemId &&
                              "border-l-4 border-l-primary bg-primary/10",
                          )}
                          onClick={() => {
                            if (canPick) setSelectedItemId(item.itemId);
                          }}
                        >
                          <TableCell className="font-mono font-semibold">
                            {item.sku}
                          </TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{item.remainingQty}</Badge>
                          </TableCell>
                          <TableCell>thùng</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            {selectedItem && canPick ? (
              <WarehouseOperationWorkspace
                key={`${selectedIssueId}:${selectedItemId}`}
                operation="PICK"
                sku={selectedItem.sku}
                remainingPackageCount={remainingPackageCount}
                suggestions={suggestions.map((item) => ({
                  ...item,
                  capacity: item.quantity,
                }))}
                suggestionsLoading={suggestionsQuery.isLoading}
                suggestionsError={suggestionsQuery.error}
                pending={confirmMutation.isPending}
                onConfirm={async (value) => {
                  await confirmMutation.mutateAsync({
                    itemBarcode: value.itemBarcode,
                    cellBarcode: value.cellBarcode,
                    quantity: value.quantity,
                    suggestedCellId: value.suggestedCellId,
                  });
                }}
              />
            ) : null}
          </div>
        ) : null}
      </EntityDetailDialog>
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          disabled={page <= 1}
          onClick={() => setPage((value) => value - 1)}
          type="button"
        >
          Trang trước
        </Button>
        <span className="text-sm text-muted-foreground">
          {page}/{totalPages}
        </span>
        <Button
          variant="outline"
          disabled={page >= totalPages}
          onClick={() => setPage((value) => value + 1)}
          type="button"
        >
          Trang sau
        </Button>
      </div>
    </div>
  );
}
