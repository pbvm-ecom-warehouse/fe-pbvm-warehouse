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
import { WarehouseOperationWorkspace } from "@/features/warehouse-navigation/components/warehouse-operation-workspace";
import { getApiErrorMessage } from "@/lib/api-contract";
import { hasAnyRole } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { statusLabel, statusTone } from "@/lib/wms-ui-labels";
import { useSessionUser } from "@/hooks/use-session-user";
import {
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
const keys = {
  list: (page: number, status: string) =>
    ["goods-issues", "list", page, status] as const,
  detail: (id: string) => ["goods-issues", "detail", id] as const,
  suggestions: (id: string, itemId: string) =>
    ["goods-issues", "suggestions", id, itemId] as const,
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
  const canView = hasAnyRole(user?.roles, ["ADMIN", "MANAGER", "PICKER"]);
  const canPick = hasAnyRole(user?.roles, ["ADMIN", "PICKER"]);
  const [status, setStatus] = useState<GoodsIssueStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [selectedIssueId, setSelectedIssueId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const issuesQuery = useQuery({
    enabled: canView,
    queryKey: keys.list(page, status),
    queryFn: () => listGoodsIssues({ page, limit: PAGE_SIZE, status }),
  });
  const issues = issuesQuery.data?.data ?? [];
  const selectedIssue = issues.find((issue) => issue.id === selectedIssueId);
  const detailQuery = useQuery({
    enabled: Boolean(selectedIssueId),
    queryKey: keys.detail(selectedIssueId),
    queryFn: () => getGoodsIssue(selectedIssueId),
  });
  const detail = detailQuery.data ?? selectedIssue;
  const selectedItem = detail?.items.find(
    (item) => item.itemId === selectedItemId,
  );
  const suggestionsQuery = useQuery({
    enabled: canPick && Boolean(selectedIssueId && selectedItemId),
    queryKey: keys.suggestions(selectedIssueId, selectedItemId),
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
    onError: (error) =>
      toast.error(getApiErrorMessage(error) ?? "Không thể xác nhận lấy hàng."),
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
  const total = issuesQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  function selectIssue(issue: GoodsIssue) {
    setSelectedIssueId(issue.id);
    setSelectedItemId("");
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
            <TableSkeleton columns={5} />
          ) : (
            <Table scrollable>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã phiếu</TableHead>
                  <TableHead>Mã đơn hàng</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Số dòng</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issues.length === 0 ? (
                  <EmptyRow colSpan={5} text="Chưa có phiếu xuất." />
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
                        {issue.id}
                      </TableCell>
                      <TableCell>{issue.orderId}</TableCell>
                      <TableCell>
                        <StatusBadge tone={statusTone(issue.status)}>
                          {statusLabel(issue.status)}
                        </StatusBadge>
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
      {detail ? (
        <Card>
          <CardHeader className="border-b bg-muted/20">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">
                  Mã đơn hàng: {detail.orderId}
                </CardTitle>
                <CardDescription className="mt-1">
                  {canPick
                    ? "Nhấn vào dòng hàng để xem vị trí lấy theo FEFO và đường đi."
                    : "Vai trò hiện tại chỉ xem thông tin."}
                </CardDescription>
              </div>
              <StatusBadge tone={statusTone(detail.status)}>
                {statusLabel(detail.status)}
              </StatusBadge>
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
                        "cursor-pointer hover:bg-accent/60",
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
      ) : null}
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
