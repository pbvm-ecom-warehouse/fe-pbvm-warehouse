"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Barcode,
  ClipboardList,
  Eye,
  LoaderCircle,
  PackageSearch,
  RefreshCw,
  Save,
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
  type PickSuggestion,
} from "../services/goods-issue.service";

const PAGE_SIZE = 20;

const goodsIssueKeys = {
  detail: (goodsIssueId: string) =>
    ["goods-issues", "detail", goodsIssueId] as const,
  list: (params: { page: number; status: GoodsIssueStatus | "ALL" }) =>
    ["goods-issues", "list", params] as const,
  suggestions: (goodsIssueId: string, itemId: string) =>
    ["goods-issues", "suggestions", goodsIssueId, itemId] as const,
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

function formatDate(value: string | undefined) {
  if (!value) return "Chưa có";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("vi-VN").format(date);
}

function parsePositiveNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
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

export function GoodsIssuesClient() {
  const user = useSessionUser();
  const queryClient = useQueryClient();
  const canUseGoodsIssueApi = hasAnyRole(user?.roles, [
    "ADMIN",
    "MANAGER",
    "PICKER",
  ]);
  const [statusFilter, setStatusFilter] = useState<GoodsIssueStatus | "ALL">(
    "ALL",
  );
  const [page, setPage] = useState(1);
  const [selectedIssueId, setSelectedIssueId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [confirmForm, setConfirmForm] = useState(defaultConfirmForm);
  const [selectedShelfCode, setSelectedShelfCode] = useState<string | null>(
    null,
  );

  const issuesQuery = useQuery({
    enabled: canUseGoodsIssueApi,
    queryFn: () =>
      listGoodsIssues({
        limit: PAGE_SIZE,
        page,
        status: statusFilter,
      }),
    queryKey: goodsIssueKeys.list({ page, status: statusFilter }),
  });

  const issues = useMemo(
    () => issuesQuery.data?.data ?? [],
    [issuesQuery.data],
  );
  const selectedIssue =
    issues.find((issue) => issue.id === selectedIssueId) ?? issues[0];
  const activeIssueId = selectedIssue?.id ?? "";
  const total = issuesQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const detailQuery = useQuery({
    enabled: canUseGoodsIssueApi && Boolean(activeIssueId),
    queryFn: () => getGoodsIssue(activeIssueId),
    queryKey: goodsIssueKeys.detail(activeIssueId),
  });
  const detail = detailQuery.data ?? selectedIssue;
  const selectedItem = selectedItemId
    ? detail?.items.find((item) => item.itemId === selectedItemId)
    : undefined;
  const activeItemId = selectedItem?.itemId ?? "";
  const suggestionsQuery = useQuery({
    enabled:
      canUseGoodsIssueApi && Boolean(activeIssueId) && Boolean(activeItemId),
    queryFn: () =>
      listGoodsIssuePickSuggestions({
        goodsIssueId: activeIssueId,
        itemId: activeItemId,
      }),
    queryKey: goodsIssueKeys.suggestions(activeIssueId, activeItemId),
  });
  const pickSuggestions = useMemo(
    () => suggestionsQuery.data ?? [],
    [suggestionsQuery.data],
  );

  const confirmMutation = useMutation({
    mutationFn: () =>
      confirmGoodsIssueLine(activeIssueId, {
        itemBarcode: confirmForm.itemBarcode.trim(),
        lotId: optionalText(confirmForm.lotId),
        quantity: parsePositiveNumber(confirmForm.quantity),
        shelfCode: confirmForm.shelfCode.trim(),
      }),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: () => {
      setConfirmForm(defaultConfirmForm);
      void queryClient.invalidateQueries({ queryKey: ["goods-issues"] });
      toast.success("Đã xác nhận dòng xuất kho");
    },
  });

  function handleFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
  }

  function handleConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeIssueId || !confirmForm.itemBarcode || !confirmForm.shelfCode) {
      toast.error("Cần quét mã vạch mặt hàng và mã vị trí.");
      return;
    }

    confirmMutation.mutate();
  }

  function selectIssue(issue: GoodsIssue) {
    setSelectedIssueId(issue.id);
    setSelectedItemId("");
    setConfirmForm(defaultConfirmForm);
    setSelectedShelfCode(null);
  }

  function selectItem(item: GoodsIssueItem) {
    setSelectedItemId(item.itemId);
    setConfirmForm({
      itemBarcode: "",
      lotId: "",
      quantity: String(Math.max(1, item.remainingQty)),
      shelfCode: "",
    });
    setSelectedShelfCode(null);
  }

  function selectSuggestion(suggestion: PickSuggestion) {
    setSelectedShelfCode(suggestion.shelfCode);
    setConfirmForm((current) => ({
      ...current,
      lotId: suggestion.lotId ?? "",
      quantity: String(
        Math.min(suggestion.quantity, selectedItem?.remainingQty ?? 1),
      ),
      shelfCode: suggestion.shelfCode,
    }));
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Xuất kho"
        actions={
          <Button
            disabled={!canUseGoodsIssueApi}
            onClick={() =>
              void queryClient.invalidateQueries({ queryKey: ["goods-issues"] })
            }
            type="button"
            variant="outline"
          >
            {issuesQuery.isFetching || detailQuery.isFetching ? (
              <LoaderCircle className="animate-spin" data-icon="inline-start" />
            ) : (
              <RefreshCw data-icon="inline-start" />
            )}
            Làm mới
          </Button>
        }
      />

      {!canUseGoodsIssueApi ? (
        <PermissionNotice>
          Bạn cần quyền phù hợp để xem và xử lý phiếu xuất.
        </PermissionNotice>
      ) : null}

      {issuesQuery.error ? <ErrorBanner error={issuesQuery.error} /> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
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
                    value={statusFilter}
                    onValueChange={(value) => {
                      setPage(1);
                      setStatusFilter(value as GoodsIssueStatus | "ALL");
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Tất cả</SelectItem>
                      {GOODS_ISSUE_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {statusLabel(status)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="self-end"
                  disabled={!canUseGoodsIssueApi}
                  type="submit"
                >
                  <Search data-icon="inline-start" />
                  Lọc
                </Button>
              </form>

              {issuesQuery.isLoading ? (
                <TableSkeleton columns={4} />
              ) : (
                <GoodsIssueTable
                  issues={issues}
                  selectedId={activeIssueId}
                  onSelect={selectIssue}
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
            <GoodsIssueDetail
              detail={detail}
              selectedItemId={activeItemId}
              onSelectItem={selectItem}
            />
          ) : null}
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <PackageSearch className="size-4 text-primary" />
                Vị trí lấy hàng
              </CardTitle>
              <CardDescription>
                {selectedItem?.sku ?? "Chọn dòng hàng để xem vị trí"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {suggestionsQuery.isLoading ? (
                <TableSkeleton columns={2} rows={3} />
              ) : null}
              {suggestionsQuery.error ? (
                <ErrorBanner error={suggestionsQuery.error} />
              ) : null}
              {!selectedItem ? (
                <EmptyState title="Chọn dòng hàng để xem vị trí" />
              ) : pickSuggestions.length === 0 &&
                !suggestionsQuery.isLoading ? (
                <EmptyState title="Chưa có gợi ý vị trí" />
              ) : null}
              {pickSuggestions.map((suggestion) => (
                <button
                  className={cn(
                    "grid w-full gap-2 rounded-lg border border-border/70 p-3 text-left text-sm transition hover:bg-accent/60",
                    selectedShelfCode === suggestion.shelfCode &&
                      "border-primary bg-primary/5",
                  )}
                  key={`${suggestion.shelfId}-${suggestion.lotId ?? "none"}`}
                  onClick={() => selectSuggestion(suggestion)}
                  type="button"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-mono font-semibold">
                      {suggestion.shelfCode}
                    </span>
                    <Badge variant="outline">
                      {suggestion.quantity.toLocaleString("vi-VN")}
                    </Badge>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Mã lô {suggestion.lotNumber ?? "chưa khai"} · HSD{" "}
                    {formatDate(suggestion.expiryDate ?? undefined)}
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>

          {selectedItem ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Barcode className="size-4 text-primary" />
                  Xác nhận dòng xuất
                </CardTitle>
                <CardDescription>
                  Quét SKU, quét vị trí và nhập số lượng thực lấy.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-3" onSubmit={handleConfirm}>
                  <TextField
                    id="goods-issue-barcode"
                    label="Mã vạch mặt hàng"
                    value={confirmForm.itemBarcode}
                    onChange={(itemBarcode) =>
                      setConfirmForm((current) => ({ ...current, itemBarcode }))
                    }
                  />
                  <TextField
                    id="goods-issue-shelf"
                    label="Mã vị trí"
                    value={confirmForm.shelfCode}
                    onChange={(shelfCode) =>
                      setConfirmForm((current) => ({ ...current, shelfCode }))
                    }
                  />
                  <TextField
                    id="goods-issue-qty"
                    label="Số lượng"
                    type="number"
                    value={confirmForm.quantity}
                    onChange={(quantity) =>
                      setConfirmForm((current) => ({ ...current, quantity }))
                    }
                  />
                  <TextField
                    id="goods-issue-lot"
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
                      !canUseGoodsIssueApi ||
                      !activeIssueId ||
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

function GoodsIssueTable({
  issues,
  onSelect,
  selectedId,
}: {
  issues: GoodsIssue[];
  onSelect: (issue: GoodsIssue) => void;
  selectedId: string;
}) {
  return (
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
          <EmptyRow colSpan={5} label="Chưa có phiếu xuất." />
        ) : (
          issues.map((issue) => (
            <TableRow
              className={cn(
                "cursor-pointer",
                selectedId === issue.id && "bg-primary/5",
              )}
              key={issue.id}
              onClick={() => onSelect(issue)}
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
                  type="button"
                  variant="outline"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(issue);
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

function GoodsIssueDetail({
  detail,
  onSelectItem,
  selectedItemId,
}: {
  detail: GoodsIssue;
  onSelectItem: (item: GoodsIssueItem) => void;
  selectedItemId: string;
}) {
  return (
    <Card>
      <CardHeader className="border-b bg-muted/20">
        <CardTitle className="text-base">{detail.orderId}</CardTitle>
        <CardDescription>{statusLabel(detail.status)}</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <Table scrollable>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Số lượng</TableHead>
              <TableHead>Còn lại</TableHead>
              <TableHead>Đơn vị</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {detail.items.length === 0 ? (
              <EmptyRow colSpan={4} label="Phiếu xuất chưa có dòng hàng." />
            ) : (
              detail.items.map((item) => (
                <TableRow
                  className={cn(
                    "cursor-pointer",
                    selectedItemId === item.itemId && "bg-primary/5",
                  )}
                  key={item.itemId}
                  onClick={() => onSelectItem(item)}
                >
                  <TableCell className="font-mono font-semibold">
                    {item.sku}
                  </TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>{item.remainingQty}</TableCell>
                  <TableCell>{item.unit ?? "cái"}</TableCell>
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
