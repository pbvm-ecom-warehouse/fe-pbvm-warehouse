"use client";

import { FormEvent, type ReactNode, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardCheck,
  ClipboardList,
  Eye,
  LoaderCircle,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import {
  EvidenceImageGallery,
  EvidenceImagePicker,
} from "@/components/evidence-images";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  EmptyState,
  PageHeader,
  PermissionNotice,
  StatusBadge,
  TablePanel,
  TableSkeleton,
} from "@/features/admin-shell/components/operations-ui";
import { getApiErrorMessage } from "@/lib/api-contract";
import { hasAnyRole } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { statusLabel, statusTone } from "@/lib/wms-ui-labels";
import { useSessionUser } from "@/hooks/use-session-user";

import {
  approveScrapNote,
  createScrapNote,
  getScrapNote,
  listScrapNotes,
  rejectScrapNote,
  SCRAP_NOTE_STATUSES,
  type ScrapNote,
  type ScrapNoteStatus,
} from "../services/scrap-note.service";
import {
  approveStockCount,
  countStockCountItem,
  createStockCount,
  getStockCount,
  listStockCounts,
  STOCK_COUNT_STATUSES,
  type StockCount,
  type StockCountItem,
  type StockCountStatus,
} from "../services/stock-count.service";

const PAGE_SIZE = 20;

const stockCountKeys = {
  detail: (id: string) => ["stock-counts", "detail", id] as const,
  list: (params: { page: number; status: StockCountStatus | "ALL" }) =>
    ["stock-counts", "list", params] as const,
};

const scrapNoteKeys = {
  detail: (id: string) => ["scrap-notes", "detail", id] as const,
  list: (params: { page: number; status: ScrapNoteStatus | "ALL" }) =>
    ["scrap-notes", "list", params] as const,
};

const defaultStockCountForm = {
  note: "",
  zoneId: "",
};

const defaultCountForm = {
  actualQty: "",
  lotId: "",
  reason: "",
  shelfId: "",
};

const defaultScrapForm = {
  itemId: "",
  lotId: "",
  note: "",
  quantity: "1",
  reason: "",
  shelfId: "",
};

function formatError(error: unknown) {
  return getApiErrorMessage(error) ?? "Không kết nối được WMS.";
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function requiredText(value: string) {
  return value.trim();
}

function parsePositiveNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function parseNonNegativeNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function formatDate(value: string | undefined) {
  if (!value) return "Chưa có";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("vi-VN").format(date);
}

function formatQty(value: number | null | undefined) {
  return typeof value === "number" ? value.toLocaleString("vi-VN") : "Chưa đếm";
}

function ErrorBanner({ error }: { error: unknown }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
      {formatError(error)}
    </div>
  );
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

export function AdjustmentsClient() {
  const user = useSessionUser();
  const queryClient = useQueryClient();
  const canUseStockCounts = hasAnyRole(user?.roles, [
    "ADMIN",
    "MANAGER",
    "COUNTER",
  ]);
  const canUseScrapNotes = hasAnyRole(user?.roles, [
    "ADMIN",
    "MANAGER",
    "COUNTER",
    "RECEIVER",
  ]);

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Kiểm kê"
        actions={
          <Button
            onClick={() => {
              void queryClient.invalidateQueries({
                queryKey: ["stock-counts"],
              });
              void queryClient.invalidateQueries({ queryKey: ["scrap-notes"] });
            }}
            type="button"
            variant="outline"
          >
            <RefreshCw data-icon="inline-start" />
            Làm mới
          </Button>
        }
      />

      {!canUseStockCounts && !canUseScrapNotes ? (
        <PermissionNotice>
          Bạn cần quyền phù hợp để xem phiếu kiểm kê hoặc phiếu hủy hàng.
        </PermissionNotice>
      ) : null}

      <Tabs
        className="space-y-4"
        defaultValue={canUseStockCounts ? "stock-counts" : "scrap-notes"}
      >
        <TabsList>
          <TabsTrigger value="stock-counts">Phiếu kiểm</TabsTrigger>
          <TabsTrigger value="scrap-notes">Phiếu hủy</TabsTrigger>
        </TabsList>
        <TabsContent value="stock-counts">
          <StockCountsSection canUseApi={canUseStockCounts} />
        </TabsContent>
        <TabsContent value="scrap-notes">
          <ScrapNotesSection canUseApi={canUseScrapNotes} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StockCountsSection({ canUseApi }: { canUseApi: boolean }) {
  const user = useSessionUser();
  const queryClient = useQueryClient();
  const canCreate = hasAnyRole(user?.roles, ["ADMIN", "MANAGER"]);
  const canCount = hasAnyRole(user?.roles, ["ADMIN", "COUNTER"]);
  const canApprove = hasAnyRole(user?.roles, ["ADMIN", "MANAGER"]);
  const [statusFilter, setStatusFilter] = useState<StockCountStatus | "ALL">(
    "ALL",
  );
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(defaultStockCountForm);
  const [countTarget, setCountTarget] = useState<StockCountItem | null>(null);
  const [countForm, setCountForm] = useState(defaultCountForm);
  const [countImages, setCountImages] = useState<File[]>([]);
  const [approveReason, setApproveReason] = useState("");

  const listQuery = useQuery({
    enabled: canUseApi,
    queryFn: () =>
      listStockCounts({
        limit: PAGE_SIZE,
        page,
        status: statusFilter,
      }),
    queryKey: stockCountKeys.list({
      page,
      status: statusFilter,
    }),
  });

  const stockCounts = useMemo(
    () => listQuery.data?.data ?? [],
    [listQuery.data?.data],
  );
  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activeId = selectedId || stockCounts[0]?.id || "";

  const detailQuery = useQuery({
    enabled: canUseApi && Boolean(activeId),
    queryFn: () => getStockCount(activeId),
    queryKey: stockCountKeys.detail(activeId),
  });
  const detail =
    detailQuery.data ?? stockCounts.find((item) => item.id === activeId);

  const createMutation = useMutation({
    mutationFn: () =>
      createStockCount({
        note: optionalText(createForm.note),
        zoneId: optionalText(createForm.zoneId),
      }),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: (stockCount) => {
      setCreateForm(defaultStockCountForm);
      setCreateOpen(false);
      setSelectedId(stockCount.id);
      void queryClient.invalidateQueries({ queryKey: ["stock-counts"] });
      toast.success("Đã tạo phiếu kiểm");
    },
  });

  const countMutation = useMutation({
    mutationFn: ({
      itemId,
      stockCountId,
    }: {
      itemId: string;
      stockCountId: string;
    }) =>
      countStockCountItem({
        itemId,
        stockCountId,
        input: {
          actualQty: parseNonNegativeNumber(countForm.actualQty),
          images: countImages,
          lotId: optionalText(countForm.lotId),
          reason: optionalText(countForm.reason),
          shelfId: requiredText(countForm.shelfId),
        },
      }),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: () => {
      setCountTarget(null);
      setCountForm(defaultCountForm);
      setCountImages([]);
      void queryClient.invalidateQueries({ queryKey: ["stock-counts"] });
      toast.success("Đã ghi nhận số đếm");
    },
  });

  const approveMutation = useMutation({
    mutationFn: (stockCountId: string) =>
      approveStockCount(stockCountId, { reason: optionalText(approveReason) }),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: () => {
      setApproveReason("");
      void queryClient.invalidateQueries({ queryKey: ["stock-counts"] });
      toast.success("Đã duyệt phiếu kiểm");
    },
  });

  function handleFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
  }

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    createMutation.mutate();
  }

  function openCountDialog(item: StockCountItem) {
    setCountTarget(item);
    setCountImages([]);
    setCountForm({
      actualQty: item.actualQty?.toString() ?? "",
      lotId: item.lotId ?? "",
      reason: item.reason ?? "",
      shelfId: item.shelfId,
    });
  }

  function handleCount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeId || !countTarget || !countForm.shelfId.trim()) {
      toast.error("Cần chọn dòng kiểm và mã vị trí.");
      return;
    }

    countMutation.mutate({
      itemId: countTarget.itemId,
      stockCountId: activeId,
    });
  }

  return (
    <div className="space-y-4">
      {!canUseApi ? (
        <PermissionNotice>
          Bạn cần quyền kiểm kê để xem danh sách phiếu kiểm.
        </PermissionNotice>
      ) : null}

      {listQuery.error ? <ErrorBanner error={listQuery.error} /> : null}

      <TablePanel
        count={`${total} bản ghi · trang ${page}/${totalPages}`}
        title={
          <span className="flex items-center gap-2">
            <ClipboardCheck className="size-4 text-primary" />
            Phiếu kiểm kho
          </span>
        }
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <form
            className="grid flex-1 gap-3 md:grid-cols-[220px_1fr_auto]"
            onSubmit={handleFilter}
          >
            <SelectFilter
              label="Trạng thái"
              value={statusFilter}
              onChange={(value) => {
                setPage(1);
                setStatusFilter(value as StockCountStatus | "ALL");
              }}
            >
              <SelectItem value="ALL">Tất cả</SelectItem>
              {STOCK_COUNT_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {statusLabel(status)}
                </SelectItem>
              ))}
            </SelectFilter>
            <Button className="self-end" disabled={!canUseApi} type="submit">
              <Search data-icon="inline-start" />
              Lọc
            </Button>
          </form>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button disabled={!canCreate}>
                <Plus data-icon="inline-start" />
                Tạo phiếu kiểm
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tạo phiếu kiểm</DialogTitle>
                <DialogDescription>
                  Hệ thống sẽ tạo các dòng kiểm theo khu vực đã chọn.
                </DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={handleCreate}>
                <TextField
                  id="stock-count-create-zone"
                  label="Mã khu vực"
                  required={false}
                  value={createForm.zoneId}
                  onChange={(zoneId) =>
                    setCreateForm((current) => ({ ...current, zoneId }))
                  }
                />
                <TextAreaField
                  id="stock-count-create-note"
                  label="Ghi chú"
                  value={createForm.note}
                  onChange={(note) =>
                    setCreateForm((current) => ({ ...current, note }))
                  }
                />
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">
                      Hủy
                    </Button>
                  </DialogClose>
                  <Button disabled={createMutation.isPending} type="submit">
                    {createMutation.isPending ? (
                      <LoaderCircle
                        className="animate-spin"
                        data-icon="inline-start"
                      />
                    ) : (
                      <Plus data-icon="inline-start" />
                    )}
                    Tạo phiếu kiểm
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {listQuery.isLoading ? (
          <TableSkeleton columns={5} />
        ) : (
          <StockCountTable
            activeId={activeId}
            items={stockCounts}
            onSelect={setSelectedId}
          />
        )}

        <Pager page={page} totalPages={totalPages} onPageChange={setPage} />
      </TablePanel>

      {detailQuery.error ? <ErrorBanner error={detailQuery.error} /> : null}

      {detail ? (
        <StockCountDetail
          canApprove={canApprove}
          canCount={canCount}
          detail={detail}
          approveBusy={approveMutation.isPending}
          approveReason={approveReason}
          onApprove={() => approveMutation.mutate(detail.id)}
          onApproveReasonChange={setApproveReason}
          onCount={openCountDialog}
        />
      ) : (
        <EmptyState title="Chọn phiếu kiểm để xem chi tiết" />
      )}

      <Dialog
        open={Boolean(countTarget)}
        onOpenChange={(open) => !open && setCountTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nhập số đếm</DialogTitle>
            <DialogDescription>
              {countTarget?.sku ?? "Dòng kiểm"} · quét hoặc nhập mã vị trí.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleCount}>
            <TextField
              id="stock-count-line-shelf"
              label="Mã vị trí"
              value={countForm.shelfId}
              onChange={(shelfId) =>
                setCountForm((current) => ({ ...current, shelfId }))
              }
            />
            <TextField
              id="stock-count-line-actual"
              label="Số thực đếm"
              type="number"
              value={countForm.actualQty}
              onChange={(actualQty) =>
                setCountForm((current) => ({ ...current, actualQty }))
              }
            />
            <TextField
              id="stock-count-line-lot"
              label="Mã lô"
              required={false}
              value={countForm.lotId}
              onChange={(lotId) =>
                setCountForm((current) => ({ ...current, lotId }))
              }
            />
            <TextAreaField
              id="stock-count-line-reason"
              label="Lý do lệch"
              required={false}
              value={countForm.reason}
              onChange={(reason) =>
                setCountForm((current) => ({ ...current, reason }))
              }
            />
            <EvidenceImagePicker
              files={countImages}
              id="stock-count-line-images"
              onChange={setCountImages}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Hủy
                </Button>
              </DialogClose>
              <Button
                disabled={!canCount || countMutation.isPending}
                type="submit"
              >
                {countMutation.isPending ? (
                  <LoaderCircle
                    className="animate-spin"
                    data-icon="inline-start"
                  />
                ) : (
                  <Save data-icon="inline-start" />
                )}
                Lưu số đếm
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StockCountTable({
  activeId,
  items,
  onSelect,
}: {
  activeId: string;
  items: StockCount[];
  onSelect: (id: string) => void;
}) {
  return (
    <Table scrollable>
      <TableHeader>
        <TableRow>
          <TableHead>Mã phiếu</TableHead>
          <TableHead>Khu vực</TableHead>
          <TableHead>Trạng thái</TableHead>
          <TableHead>Số dòng</TableHead>
          <TableHead className="text-right">Thao tác</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 ? (
          <EmptyRow colSpan={5} label="Chưa có phiếu kiểm." />
        ) : (
          items.map((item) => (
            <TableRow
              className={cn(
                "cursor-pointer hover:bg-muted/35",
                activeId === item.id && "bg-primary/5",
              )}
              key={item.id}
              onClick={() => onSelect(item.id)}
            >
              <TableCell className="font-mono font-semibold">
                {item.id}
              </TableCell>
              <TableCell>{item.zoneId ?? "Toàn kho"}</TableCell>
              <TableCell>
                <StatusBadge tone={statusTone(item.status)}>
                  {statusLabel(item.status)}
                </StatusBadge>
              </TableCell>
              <TableCell>{item.items.length}</TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(item.id);
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

function StockCountDetail({
  approveBusy,
  approveReason,
  canApprove,
  canCount,
  detail,
  onApprove,
  onApproveReasonChange,
  onCount,
}: {
  approveBusy: boolean;
  approveReason: string;
  canApprove: boolean;
  canCount: boolean;
  detail: StockCount;
  onApprove: () => void;
  onApproveReasonChange: (value: string) => void;
  onCount: (item: StockCountItem) => void;
}) {
  return (
    <Card>
      <CardHeader className="border-b bg-muted/20">
        <CardTitle className="text-base">{detail.id}</CardTitle>
        <CardDescription>
          Tạo ngày {formatDate(detail.createdAt)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="grid gap-3 md:grid-cols-4">
          <InfoBox label="Trạng thái" value={statusLabel(detail.status)} />
          <InfoBox label="Khu vực" value={detail.zoneId ?? "Toàn kho"} />
          <InfoBox label="Người tạo" value={detail.createdBy} />
          <InfoBox label="Số dòng" value={detail.items.length.toString()} />
        </div>

        <div className="overflow-x-auto rounded-lg border border-border/70">
          <Table scrollable>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Mã vị trí</TableHead>
                <TableHead>Tồn hệ thống</TableHead>
                <TableHead>Thực đếm</TableHead>
                <TableHead>Chênh lệch</TableHead>
                <TableHead>Ảnh minh chứng</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.items.length === 0 ? (
                <EmptyRow colSpan={7} label="Phiếu kiểm chưa có dòng hàng." />
              ) : (
                detail.items.map((item) => (
                  <TableRow key={`${item.itemId}-${item.shelfId}`}>
                    <TableCell className="font-mono font-semibold">
                      {item.sku}
                    </TableCell>
                    <TableCell>{item.shelfId}</TableCell>
                    <TableCell>{formatQty(item.systemQty)}</TableCell>
                    <TableCell>{formatQty(item.actualQty)}</TableCell>
                    <TableCell>{formatQty(item.delta)}</TableCell>
                    <TableCell className="min-w-48">
                      <EvidenceImageGallery
                        emptyLabel="Không có ảnh"
                        images={item.images}
                        label={`${item.images?.length ?? 0} ảnh`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <Button
                          disabled={!canCount || detail.status === "APPROVED"}
                          onClick={() => onCount(item)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          <ClipboardList data-icon="inline-start" />
                          Nhập đếm
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <form
          className="grid gap-3 rounded-lg border border-border/70 bg-muted/15 p-3 md:grid-cols-[1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            onApprove();
          }}
        >
          <TextField
            id="stock-count-approve-reason"
            label="Lý do duyệt"
            required={false}
            value={approveReason}
            onChange={onApproveReasonChange}
          />
          <Button
            className="self-end"
            disabled={
              !canApprove || detail.status === "APPROVED" || approveBusy
            }
            type="submit"
          >
            {approveBusy ? (
              <LoaderCircle className="animate-spin" data-icon="inline-start" />
            ) : (
              <ShieldCheck data-icon="inline-start" />
            )}
            Duyệt phiếu
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ScrapNotesSection({ canUseApi }: { canUseApi: boolean }) {
  const user = useSessionUser();
  const queryClient = useQueryClient();
  const canCreate = hasAnyRole(user?.roles, ["ADMIN", "COUNTER", "RECEIVER"]);
  const canApprove = hasAnyRole(user?.roles, ["ADMIN", "MANAGER"]);
  const [statusFilter, setStatusFilter] = useState<ScrapNoteStatus | "ALL">(
    "ALL",
  );
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(defaultScrapForm);
  const [scrapImages, setScrapImages] = useState<File[]>([]);
  const [rejectReason, setRejectReason] = useState("");

  const listQuery = useQuery({
    enabled: canUseApi,
    queryFn: () =>
      listScrapNotes({
        limit: PAGE_SIZE,
        page,
        status: statusFilter,
      }),
    queryKey: scrapNoteKeys.list({
      page,
      status: statusFilter,
    }),
  });

  const scrapNotes = useMemo(
    () => listQuery.data?.data ?? [],
    [listQuery.data?.data],
  );
  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activeId = selectedId || scrapNotes[0]?.id || "";

  const detailQuery = useQuery({
    enabled: canUseApi && Boolean(activeId),
    queryFn: () => getScrapNote(activeId),
    queryKey: scrapNoteKeys.detail(activeId),
  });
  const detail =
    detailQuery.data ?? scrapNotes.find((item) => item.id === activeId);

  const createMutation = useMutation({
    mutationFn: () =>
      createScrapNote({
        note: optionalText(createForm.note),
        itemImages: [scrapImages],
        items: [
          {
            itemId: requiredText(createForm.itemId),
            lotId: optionalText(createForm.lotId),
            quantity: parsePositiveNumber(createForm.quantity),
            reason: requiredText(createForm.reason),
            shelfId: requiredText(createForm.shelfId),
          },
        ],
      }),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: (scrapNote) => {
      setCreateForm(defaultScrapForm);
      setScrapImages([]);
      setCreateOpen(false);
      setSelectedId(scrapNote.id);
      void queryClient.invalidateQueries({ queryKey: ["scrap-notes"] });
      toast.success("Đã tạo phiếu hủy");
    },
  });

  const approveMutation = useMutation({
    mutationFn: (scrapNoteId: string) => approveScrapNote(scrapNoteId),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["scrap-notes"] });
      toast.success("Đã duyệt phiếu hủy");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (scrapNoteId: string) =>
      rejectScrapNote(scrapNoteId, {
        rejectReason: requiredText(rejectReason),
      }),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: () => {
      setRejectReason("");
      void queryClient.invalidateQueries({ queryKey: ["scrap-notes"] });
      toast.success("Đã từ chối phiếu hủy");
    },
  });

  function handleFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
  }

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !createForm.itemId.trim() ||
      !createForm.shelfId.trim() ||
      !createForm.reason.trim()
    ) {
      toast.error("Cần nhập mặt hàng, vị trí và lý do hủy.");
      return;
    }

    createMutation.mutate();
  }

  return (
    <div className="space-y-4">
      {!canUseApi ? (
        <PermissionNotice>
          Bạn cần quyền phù hợp để xem phiếu hủy hàng.
        </PermissionNotice>
      ) : null}

      {listQuery.error ? <ErrorBanner error={listQuery.error} /> : null}

      <TablePanel
        count={`${total} bản ghi · trang ${page}/${totalPages}`}
        title={
          <span className="flex items-center gap-2">
            <Trash2 className="size-4 text-primary" />
            Phiếu hủy hàng
          </span>
        }
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <form
            className="grid flex-1 gap-3 md:grid-cols-[220px_1fr_auto]"
            onSubmit={handleFilter}
          >
            <SelectFilter
              label="Trạng thái"
              value={statusFilter}
              onChange={(value) => {
                setPage(1);
                setStatusFilter(value as ScrapNoteStatus | "ALL");
              }}
            >
              <SelectItem value="ALL">Tất cả</SelectItem>
              {SCRAP_NOTE_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {statusLabel(status)}
                </SelectItem>
              ))}
            </SelectFilter>
            <Button className="self-end" disabled={!canUseApi} type="submit">
              <Search data-icon="inline-start" />
              Lọc
            </Button>
          </form>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button disabled={!canCreate}>
                <Plus data-icon="inline-start" />
                Tạo phiếu hủy
              </Button>
            </DialogTrigger>
            <DialogContent size="lg" className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Tạo phiếu hủy hàng</DialogTitle>
                <DialogDescription>
                  Ghi nhận hàng hỏng, vỡ hoặc hết hạn để quản lý duyệt trừ tồn.
                </DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={handleCreate}>
                <div className="grid gap-3 md:grid-cols-2">
                  <TextField
                    id="scrap-create-item"
                    label="Mã mặt hàng"
                    value={createForm.itemId}
                    onChange={(itemId) =>
                      setCreateForm((current) => ({ ...current, itemId }))
                    }
                  />
                  <TextField
                    id="scrap-create-shelf"
                    label="Mã vị trí"
                    value={createForm.shelfId}
                    onChange={(shelfId) =>
                      setCreateForm((current) => ({ ...current, shelfId }))
                    }
                  />
                  <TextField
                    id="scrap-create-lot"
                    label="Mã lô"
                    required={false}
                    value={createForm.lotId}
                    onChange={(lotId) =>
                      setCreateForm((current) => ({ ...current, lotId }))
                    }
                  />
                  <TextField
                    id="scrap-create-qty"
                    label="Số lượng hủy"
                    type="number"
                    value={createForm.quantity}
                    onChange={(quantity) =>
                      setCreateForm((current) => ({ ...current, quantity }))
                    }
                  />
                </div>
                <TextAreaField
                  id="scrap-create-reason"
                  label="Lý do hủy"
                  value={createForm.reason}
                  onChange={(reason) =>
                    setCreateForm((current) => ({ ...current, reason }))
                  }
                />
                <TextAreaField
                  id="scrap-create-note"
                  label="Ghi chú phiếu"
                  required={false}
                  value={createForm.note}
                  onChange={(note) =>
                    setCreateForm((current) => ({ ...current, note }))
                  }
                />
                <EvidenceImagePicker
                  files={scrapImages}
                  id="scrap-create-images"
                  onChange={setScrapImages}
                />
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">
                      Hủy
                    </Button>
                  </DialogClose>
                  <Button disabled={createMutation.isPending} type="submit">
                    {createMutation.isPending ? (
                      <LoaderCircle
                        className="animate-spin"
                        data-icon="inline-start"
                      />
                    ) : (
                      <Plus data-icon="inline-start" />
                    )}
                    Tạo phiếu hủy
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {listQuery.isLoading ? (
          <TableSkeleton columns={5} />
        ) : (
          <ScrapNoteTable
            activeId={activeId}
            items={scrapNotes}
            onSelect={setSelectedId}
          />
        )}

        <Pager page={page} totalPages={totalPages} onPageChange={setPage} />
      </TablePanel>

      {detailQuery.error ? <ErrorBanner error={detailQuery.error} /> : null}

      {detail ? (
        <ScrapNoteDetail
          approveBusy={approveMutation.isPending}
          canApprove={canApprove}
          detail={detail}
          rejectBusy={rejectMutation.isPending}
          rejectReason={rejectReason}
          onApprove={() => approveMutation.mutate(detail.id)}
          onReject={() => {
            if (!rejectReason.trim()) {
              toast.error("Cần nhập lý do từ chối.");
              return;
            }

            rejectMutation.mutate(detail.id);
          }}
          onRejectReasonChange={setRejectReason}
        />
      ) : (
        <EmptyState title="Chọn phiếu hủy để xem chi tiết" />
      )}
    </div>
  );
}

function ScrapNoteTable({
  activeId,
  items,
  onSelect,
}: {
  activeId: string;
  items: ScrapNote[];
  onSelect: (id: string) => void;
}) {
  return (
    <Table scrollable>
      <TableHeader>
        <TableRow>
          <TableHead>Mã phiếu</TableHead>
          <TableHead>Trạng thái</TableHead>
          <TableHead>Số dòng</TableHead>
          <TableHead>Ngày tạo</TableHead>
          <TableHead className="text-right">Thao tác</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 ? (
          <EmptyRow colSpan={5} label="Chưa có phiếu hủy." />
        ) : (
          items.map((item) => (
            <TableRow
              className={cn(
                "cursor-pointer hover:bg-muted/35",
                activeId === item.id && "bg-primary/5",
              )}
              key={item.id}
              onClick={() => onSelect(item.id)}
            >
              <TableCell className="font-mono font-semibold">
                {item.id}
              </TableCell>
              <TableCell>
                <StatusBadge tone={statusTone(item.status)}>
                  {statusLabel(item.status)}
                </StatusBadge>
              </TableCell>
              <TableCell>{item.items.length}</TableCell>
              <TableCell>{formatDate(item.createdAt)}</TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(item.id);
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

function ScrapNoteDetail({
  approveBusy,
  canApprove,
  detail,
  onApprove,
  onReject,
  onRejectReasonChange,
  rejectBusy,
  rejectReason,
}: {
  approveBusy: boolean;
  canApprove: boolean;
  detail: ScrapNote;
  onApprove: () => void;
  onReject: () => void;
  onRejectReasonChange: (value: string) => void;
  rejectBusy: boolean;
  rejectReason: string;
}) {
  return (
    <Card>
      <CardHeader className="border-b bg-muted/20">
        <CardTitle className="text-base">{detail.id}</CardTitle>
        <CardDescription>
          Tạo ngày {formatDate(detail.createdAt)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="grid gap-3 md:grid-cols-4">
          <InfoBox label="Trạng thái" value={statusLabel(detail.status)} />
          <InfoBox label="Người tạo" value={detail.createdBy} />
          <InfoBox
            label="Người duyệt"
            value={detail.approvedBy ?? "Chưa duyệt"}
          />
          <InfoBox label="Số dòng" value={detail.items.length.toString()} />
        </div>

        {detail.rejectReason ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            Lý do từ chối: {detail.rejectReason}
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-lg border border-border/70">
          <Table scrollable>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Mã mặt hàng</TableHead>
                <TableHead>Mã vị trí</TableHead>
                <TableHead>Mã lô</TableHead>
                <TableHead>Số lượng</TableHead>
                <TableHead>Lý do</TableHead>
                <TableHead>Ảnh minh chứng</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.items.length === 0 ? (
                <EmptyRow colSpan={7} label="Phiếu hủy chưa có dòng hàng." />
              ) : (
                detail.items.map((item) => (
                  <TableRow key={`${item.itemId}-${item.shelfId}`}>
                    <TableCell className="font-mono font-semibold">
                      {item.sku}
                    </TableCell>
                    <TableCell>{item.itemId}</TableCell>
                    <TableCell>{item.shelfId}</TableCell>
                    <TableCell>{item.lotId ?? "Không có"}</TableCell>
                    <TableCell>{formatQty(item.quantity)}</TableCell>
                    <TableCell>{item.reason}</TableCell>
                    <TableCell className="min-w-48">
                      <EvidenceImageGallery
                        emptyLabel="Không có ảnh"
                        images={item.images}
                        label={`${item.images?.length ?? 0} ảnh`}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="grid gap-3 rounded-lg border border-border/70 bg-muted/15 p-3 lg:grid-cols-[1fr_auto_auto]">
          <TextField
            id="scrap-note-reject-reason"
            label="Lý do từ chối"
            required={false}
            value={rejectReason}
            onChange={onRejectReasonChange}
          />
          <Button
            className="self-end"
            disabled={!canApprove || detail.status !== "DRAFT" || approveBusy}
            onClick={onApprove}
            type="button"
          >
            {approveBusy ? (
              <LoaderCircle className="animate-spin" data-icon="inline-start" />
            ) : (
              <ShieldCheck data-icon="inline-start" />
            )}
            Duyệt hủy
          </Button>
          <Button
            className="self-end"
            disabled={!canApprove || detail.status !== "DRAFT" || rejectBusy}
            onClick={onReject}
            type="button"
            variant="destructive"
          >
            {rejectBusy ? (
              <LoaderCircle className="animate-spin" data-icon="inline-start" />
            ) : (
              <XCircle data-icon="inline-start" />
            )}
            Từ chối
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SelectFilter({
  children,
  label,
  onChange,
  value,
}: {
  children: ReactNode;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
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

function TextAreaField({
  id,
  label,
  onChange,
  required = true,
  value,
}: {
  id: string;
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  value: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/15 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold">{value}</div>
    </div>
  );
}

function Pager({
  onPageChange,
  page,
  totalPages,
}: {
  onPageChange: (page: number) => void;
  page: number;
  totalPages: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Button
        disabled={page <= 1}
        onClick={() => onPageChange(Math.max(1, page - 1))}
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
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        type="button"
        variant="outline"
      >
        Trang sau
      </Button>
    </div>
  );
}
