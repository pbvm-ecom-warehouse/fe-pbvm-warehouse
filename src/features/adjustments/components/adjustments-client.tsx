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
  PageHeader,
  PermissionNotice,
  StatusBadge,
  TablePanel,
  TableSkeleton,
} from "@/features/admin-shell/components/operations-ui";
import { EntityDetailDialog } from "@/features/admin-shell/components/entity-detail-dialog";
import { invalidateScrapMutationQueries } from "@/features/warehouse-navigation/utils/invalidate-warehouse-queries";
import { getApiErrorCode, getApiErrorMessage } from "@/lib/api-contract";
import { hasAnyRole } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import {
  businessCodeLabel,
  stockCountStatusLabel,
  stockCountStatusTone,
  statusLabel,
  statusTone,
} from "@/lib/wms-ui-labels";
import { useSessionUser } from "@/hooks/use-session-user";

import {
  approveScrapNote,
  createStockCountScrap,
  disposeScrapNote,
  getScrapNote,
  listScrapNotes,
  moveScrapItemToScrap,
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
  reason: "",
  shelfId: "",
};

const defaultScrapForm = {
  itemBarcode: "",
  quantity: "1",
  reason: "",
  shelfId: "",
};

const ADJUSTMENT_ERROR_MESSAGES: Record<string, string> = {
  SCRAP_NOTE_BARCODE_MISMATCH: "Barcode không thuộc SKU của dòng kiểm kê này.",
  SCRAP_NOTE_QTY_EXCEEDS_ACTUAL:
    "Số lượng hủy không được vượt quá số lượng thực tế đã đếm.",
  SCRAP_NOTE_SOURCE_LINE_NOT_COUNTED:
    "Cần nhập số đếm thực tế trước khi đề xuất hủy.",
  SCRAP_NOTE_SOURCE_NOT_APPROVED:
    "Cần duyệt phiếu kiểm nguồn trước khi duyệt phiếu hủy.",
};

function formatError(error: unknown) {
  const code = getApiErrorCode(error);
  if (code && ADJUSTMENT_ERROR_MESSAGES[code]) {
    return ADJUSTMENT_ERROR_MESSAGES[code];
  }
  return getApiErrorMessage(error) ?? "Không kết nối được WMS.";
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function requiredText(value: string) {
  return value.trim();
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
  const canCreateScrap = hasAnyRole(user?.roles, ["ADMIN", "COUNTER"]);
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
  const [scrapTarget, setScrapTarget] = useState<StockCountItem | null>(null);
  const [scrapForm, setScrapForm] = useState(defaultScrapForm);
  const [scrapImages, setScrapImages] = useState<File[]>([]);

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
  const activeId = selectedId;

  const detailQuery = useQuery({
    enabled: canUseApi && Boolean(activeId),
    queryFn: () => getStockCount(activeId),
    queryKey: stockCountKeys.detail(activeId),
  });
  const detail = detailQuery.data;

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
          cellId: countTarget?.cellId ?? "",
          images: countImages,
          lotId: countTarget?.lotId ?? undefined,
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

  const scrapMutation = useMutation({
    mutationFn: () => {
      if (!activeId || !scrapTarget) {
        throw new Error("Chưa chọn dòng kiểm kê để đề xuất hủy.");
      }
      return createStockCountScrap({
        input: {
          cellId: scrapTarget.cellId ?? "",
          images: scrapImages,
          itemBarcode: requiredText(scrapForm.itemBarcode),
          lotId: scrapTarget.lotId ?? undefined,
          quantity: Number(scrapForm.quantity),
          reason: requiredText(scrapForm.reason),
          shelfId: requiredText(scrapForm.shelfId),
        },
        itemId: scrapTarget.itemId,
        stockCountId: activeId,
      });
    },
    onError: (error) => toast.error(formatError(error)),
    onSuccess: async () => {
      setScrapTarget(null);
      setScrapForm(defaultScrapForm);
      setScrapImages([]);
      await invalidateScrapMutationQueries(queryClient);
      toast.success("Đã gửi đề xuất hủy");
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
      reason: item.reason ?? "",
      shelfId: item.shelfId,
    });
  }

  function openScrapDialog(item: StockCountItem) {
    setScrapTarget(item);
    setScrapImages([]);
    setScrapForm({
      itemBarcode: "",
      quantity: "1",
      reason: "",
      shelfId: item.shelfId,
    });
  }

  function closeScrapDialog() {
    setScrapTarget(null);
    setScrapForm(defaultScrapForm);
    setScrapImages([]);
  }

  function handleScrapCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!scrapForm.itemBarcode.trim() || !scrapForm.reason.trim()) {
      toast.error("Cần quét barcode SKU và nhập lý do hủy.");
      return;
    }
    if (!scrapTarget?.cellId) {
      toast.error("Dòng kiểm thiếu khoang nguồn. Hãy làm mới phiếu kiểm.");
      return;
    }
    const quantity = Number(scrapForm.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      toast.error("Số lượng hủy phải là số nguyên từ 1 trở lên.");
      return;
    }
    if (
      typeof scrapTarget?.actualQty === "number" &&
      quantity > scrapTarget.actualQty
    ) {
      toast.error("Số lượng hủy không được vượt số thực đếm.");
      return;
    }
    scrapMutation.mutate();
  }

  function handleCount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeId || !countTarget || !countTarget.cellId) {
      toast.error("Dòng kiểm thiếu khoang lưu hàng. Hãy làm mới phiếu kiểm.");
      return;
    }

    countMutation.mutate({
      itemId: countTarget.itemId,
      stockCountId: activeId,
    });
  }

  function closeStockCountDetail() {
    setSelectedId("");
    setCountTarget(null);
    setCountForm(defaultCountForm);
    setCountImages([]);
    setScrapTarget(null);
    setScrapForm(defaultScrapForm);
    setScrapImages([]);
    setApproveReason("");
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
                  {stockCountStatusLabel(status)}
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

      <EntityDetailDialog
        description={`Mã phiếu kiểm: ${businessCodeLabel(detail?.stockCountNumber)}`}
        onOpenChange={(open) => {
          if (!open) closeStockCountDetail();
        }}
        open={Boolean(selectedId)}
        title="Chi tiết phiếu kiểm kho"
      >
        {detailQuery.isLoading && !detail ? (
          <TableSkeleton columns={7} />
        ) : null}
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
            canCreateScrap={canCreateScrap}
            onCreateScrap={openScrapDialog}
          />
        ) : null}
      </EntityDetailDialog>

      <Dialog
        open={Boolean(scrapTarget)}
        onOpenChange={(open) => !open && closeScrapDialog()}
      >
        <DialogContent size="lg" className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Đề xuất hủy từ dòng kiểm kê</DialogTitle>
            <DialogDescription>
              Quét barcode của đúng SKU trước khi gửi đề xuất.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleScrapCreate}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <InfoBox label="SKU" value={scrapTarget?.sku ?? "Chưa có"} />
              <InfoBox
                label="Vị trí"
                value={scrapTarget?.shelfId ?? "Chưa có"}
              />
              <InfoBox
                label="Khoang nguồn"
                value={scrapTarget?.cellId ?? "Chưa có"}
              />
              <InfoBox label="Lô" value={scrapTarget?.lotId ?? "Không có"} />
              <InfoBox
                label="Số thực đếm"
                value={formatQty(scrapTarget?.actualQty)}
              />
            </div>
            <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
              Số thực đếm gồm toàn bộ hàng nhìn thấy, kể cả hàng hỏng. Số lượng
              đề xuất sẽ được trừ riêng sau khi phiếu kiểm và phiếu hủy được
              duyệt.
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <TextField
                id="stock-count-scrap-barcode"
                label="Barcode SKU"
                value={scrapForm.itemBarcode}
                onChange={(itemBarcode) =>
                  setScrapForm((current) => ({ ...current, itemBarcode }))
                }
              />
              <TextField
                id="stock-count-scrap-qty"
                label="Số lượng hủy"
                type="number"
                value={scrapForm.quantity}
                onChange={(quantity) =>
                  setScrapForm((current) => ({ ...current, quantity }))
                }
              />
            </div>
            <TextAreaField
              id="stock-count-scrap-reason"
              label="Lý do hủy"
              value={scrapForm.reason}
              onChange={(reason) =>
                setScrapForm((current) => ({ ...current, reason }))
              }
            />
            <EvidenceImagePicker
              files={scrapImages}
              id="stock-count-scrap-images"
              onChange={setScrapImages}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Hủy
                </Button>
              </DialogClose>
              <Button disabled={scrapMutation.isPending} type="submit">
                {scrapMutation.isPending ? (
                  <LoaderCircle
                    className="animate-spin"
                    data-icon="inline-start"
                  />
                ) : (
                  <Trash2 data-icon="inline-start" />
                )}
                Gửi đề xuất hủy
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(countTarget)}
        onOpenChange={(open) => !open && setCountTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nhập số đếm</DialogTitle>
            <DialogDescription>
              {countTarget?.sku ?? "Dòng kiểm"} · ghi nhận đúng khoang của dòng
              kiểm.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleCount}>
            <TextField
              id="stock-count-line-shelf"
              disabled
              label="Vị trí nguồn"
              value={countForm.shelfId}
              onChange={(shelfId) =>
                setCountForm((current) => ({ ...current, shelfId }))
              }
            />
            <InfoBox
              label="Khoang nguồn"
              value={countTarget?.cellId ?? "Chưa có"}
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
            <InfoBox label="Mã lô" value={countTarget?.lotId ?? "Không có"} />
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
          <TableHead>Mã phiếu kiểm</TableHead>
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
                {businessCodeLabel(item.stockCountNumber)}
              </TableCell>
              <TableCell>{item.zoneId ?? "Toàn kho"}</TableCell>
              <TableCell>
                <StatusBadge tone={stockCountStatusTone(item.status)}>
                  {stockCountStatusLabel(item.status)}
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
  canCreateScrap,
  detail,
  onApprove,
  onApproveReasonChange,
  onCount,
  onCreateScrap,
}: {
  approveBusy: boolean;
  approveReason: string;
  canApprove: boolean;
  canCount: boolean;
  canCreateScrap: boolean;
  detail: StockCount;
  onApprove: () => void;
  onApproveReasonChange: (value: string) => void;
  onCount: (item: StockCountItem) => void;
  onCreateScrap: (item: StockCountItem) => void;
}) {
  return (
    <Card>
      <CardHeader className="border-b bg-muted/20">
        <CardTitle className="text-base">
          Mã phiếu kiểm: {businessCodeLabel(detail.stockCountNumber)}
        </CardTitle>
        <CardDescription>
          Tạo ngày {formatDate(detail.createdAt)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="grid gap-3 md:grid-cols-4">
          <InfoBox
            label="Trạng thái"
            value={stockCountStatusLabel(detail.status)}
          />
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
                <TableHead>Khoang</TableHead>
                <TableHead>Mã lô</TableHead>
                <TableHead>Tồn hệ thống</TableHead>
                <TableHead>Thực đếm</TableHead>
                <TableHead>Chênh lệch</TableHead>
                <TableHead>Ảnh minh chứng</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.items.length === 0 ? (
                <EmptyRow colSpan={9} label="Phiếu kiểm chưa có dòng hàng." />
              ) : (
                detail.items.map((item) => (
                  <TableRow
                    key={`${item.itemId}-${item.shelfId}-${item.cellId ?? "legacy"}-${item.lotId ?? "no-lot"}`}
                  >
                    <TableCell className="font-mono font-semibold">
                      {item.sku}
                    </TableCell>
                    <TableCell>{item.shelfId}</TableCell>
                    <TableCell>{item.cellId ?? "Phiếu cũ"}</TableCell>
                    <TableCell>{item.lotId ?? "Không có"}</TableCell>
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
                      {detail.status === "CANCELLED" ? (
                        <span className="block text-right text-sm text-muted-foreground">
                          Không có thao tác
                        </span>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <Button
                            disabled={
                              !canCount ||
                              !["DRAFT", "IN_PROGRESS"].includes(
                                detail.status,
                              ) ||
                              !item.cellId
                            }
                            onClick={() => onCount(item)}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            <ClipboardList data-icon="inline-start" />
                            Nhập đếm
                          </Button>
                          <Button
                            disabled={
                              !canCreateScrap ||
                              detail.status === "APPROVED" ||
                              !item.cellId ||
                              typeof item.actualQty !== "number"
                            }
                            onClick={() => onCreateScrap(item)}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            <Trash2 data-icon="inline-start" />
                            Đề xuất hủy
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {detail.status !== "CANCELLED" ? (
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
                !canApprove || detail.status !== "COMPLETED" || approveBusy
              }
              type="submit"
            >
              {approveBusy ? (
                <LoaderCircle
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : (
                <ShieldCheck data-icon="inline-start" />
              )}
              Duyệt phiếu
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ScrapNotesSection({ canUseApi }: { canUseApi: boolean }) {
  const user = useSessionUser();
  const queryClient = useQueryClient();
  const canApprove = hasAnyRole(user?.roles, ["ADMIN", "MANAGER"]);
  const canMoveToScrap = hasAnyRole(user?.roles, ["ADMIN", "COUNTER"]);
  const canDispose = hasAnyRole(user?.roles, ["ADMIN", "MANAGER"]);
  const [statusFilter, setStatusFilter] = useState<ScrapNoteStatus | "ALL">(
    "ALL",
  );
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState("");
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
  const activeId = selectedId;

  const detailQuery = useQuery({
    enabled: canUseApi && Boolean(activeId),
    queryFn: () => getScrapNote(activeId),
    queryKey: scrapNoteKeys.detail(activeId),
  });
  const detail = detailQuery.data;
  const sourceStockCountQuery = useQuery({
    enabled: Boolean(detail?.sourceStockCountId),
    queryFn: () => getStockCount(detail!.sourceStockCountId!),
    queryKey: stockCountKeys.detail(detail?.sourceStockCountId ?? ""),
  });
  const sourceApprovalReady =
    !detail?.sourceStockCountId ||
    sourceStockCountQuery.data?.status === "APPROVED";

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
    onSuccess: async () => {
      setRejectReason("");
      await invalidateScrapMutationQueries(queryClient);
      toast.success("Đã từ chối phiếu hủy");
    },
  });

  const moveMutation = useMutation({
    mutationFn: ({
      input,
      itemId,
      scrapNoteId,
    }: {
      input: {
        itemBarcode: string;
        sourceCellBarcode: string;
        targetCellBarcode: string;
      };
      itemId: string;
      scrapNoteId: string;
    }) => moveScrapItemToScrap(scrapNoteId, itemId, input),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: async () => {
      await invalidateScrapMutationQueries(queryClient);
      toast.success("Đã chuyển hàng vào khu hủy");
    },
  });

  const disposeMutation = useMutation({
    mutationFn: (scrapNoteId: string) => disposeScrapNote(scrapNoteId),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: async () => {
      await invalidateScrapMutationQueries(queryClient);
      toast.success("Đã xác nhận tiêu hủy");
    },
  });

  function handleFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
  }

  function closeScrapNoteDetail() {
    setSelectedId("");
    setRejectReason("");
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
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
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

      <EntityDetailDialog
        description={`Mã phiếu hủy: ${businessCodeLabel(detail?.scrapNoteNumber)}`}
        onOpenChange={(open) => {
          if (!open) closeScrapNoteDetail();
        }}
        open={Boolean(selectedId)}
        title="Chi tiết phiếu hủy hàng"
      >
        {detailQuery.isLoading && !detail ? (
          <TableSkeleton columns={7} />
        ) : null}
        {detailQuery.error ? <ErrorBanner error={detailQuery.error} /> : null}
        {sourceStockCountQuery.error ? (
          <ErrorBanner error={sourceStockCountQuery.error} />
        ) : null}
        {detail ? (
          <ScrapNoteDetail
            approveBusy={approveMutation.isPending}
            approvalSourceReady={sourceApprovalReady}
            canApprove={canApprove}
            canDispose={canDispose}
            canMoveToScrap={canMoveToScrap}
            detail={detail}
            disposeBusy={disposeMutation.isPending}
            moveBusy={moveMutation.isPending}
            sourceStockCountNumber={
              sourceStockCountQuery.data?.stockCountNumber
            }
            rejectBusy={rejectMutation.isPending}
            rejectReason={rejectReason}
            onApprove={() => approveMutation.mutate(detail.id)}
            onDispose={() => disposeMutation.mutate(detail.id)}
            onMove={(itemId, input) =>
              moveMutation.mutate({ input, itemId, scrapNoteId: detail.id })
            }
            onReject={() => {
              if (!rejectReason.trim()) {
                toast.error("Cần nhập lý do từ chối.");
                return;
              }

              rejectMutation.mutate(detail.id);
            }}
            onRejectReasonChange={setRejectReason}
          />
        ) : null}
      </EntityDetailDialog>
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
          <TableHead>Mã phiếu hủy</TableHead>
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
                {businessCodeLabel(item.scrapNoteNumber)}
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
  approvalSourceReady,
  canApprove,
  canDispose,
  canMoveToScrap,
  detail,
  disposeBusy,
  moveBusy,
  onApprove,
  onDispose,
  onMove,
  onReject,
  onRejectReasonChange,
  rejectBusy,
  rejectReason,
  sourceStockCountNumber,
}: {
  approveBusy: boolean;
  approvalSourceReady: boolean;
  canApprove: boolean;
  canDispose: boolean;
  canMoveToScrap: boolean;
  detail: ScrapNote;
  disposeBusy: boolean;
  moveBusy: boolean;
  onApprove: () => void;
  onDispose: () => void;
  onMove: (
    itemId: string,
    input: {
      itemBarcode: string;
      sourceCellBarcode: string;
      targetCellBarcode: string;
    },
  ) => void;
  onReject: () => void;
  onRejectReasonChange: (value: string) => void;
  rejectBusy: boolean;
  rejectReason: string;
  sourceStockCountNumber?: string | null;
}) {
  return (
    <Card>
      <CardHeader className="border-b bg-muted/20">
        <CardTitle className="text-base">
          Mã phiếu hủy: {businessCodeLabel(detail.scrapNoteNumber)}
        </CardTitle>
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

        {detail.sourceStockCountId ? (
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_2fr]">
            <InfoBox
              label="Mã phiếu kiểm nguồn"
              value={businessCodeLabel(sourceStockCountNumber)}
            />
            {!approvalSourceReady ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Cần duyệt phiếu kiểm nguồn trước khi duyệt phiếu hủy.
              </div>
            ) : null}
          </div>
        ) : null}

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
                <TableHead>Khoang nguồn</TableHead>
                <TableHead>Khoang SCRAP</TableHead>
                <TableHead>Mã lô</TableHead>
                <TableHead>Số lượng</TableHead>
                <TableHead>Lý do</TableHead>
                <TableHead>Ảnh minh chứng</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.items.length === 0 ? (
                <EmptyRow colSpan={9} label="Phiếu hủy chưa có dòng hàng." />
              ) : (
                detail.items.map((item) => (
                  <TableRow
                    key={`${item.itemId}-${item.shelfId}-${item.sourceCellId ?? "no-source"}-${item.lotId ?? "no-lot"}`}
                  >
                    <TableCell className="font-mono font-semibold">
                      {item.sku}
                    </TableCell>
                    <TableCell>{item.itemId}</TableCell>
                    <TableCell>{item.shelfId}</TableCell>
                    <TableCell>{item.sourceCellId ?? "Chưa khóa"}</TableCell>
                    <TableCell>{item.scrapCellId ?? "Chưa chuyển"}</TableCell>
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

        <ScrapLifecycleActions
          canDispose={canDispose}
          canMoveToScrap={canMoveToScrap}
          detail={detail}
          disposeBusy={disposeBusy}
          moveBusy={moveBusy}
          onDispose={onDispose}
          onMove={onMove}
        />

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
            disabled={
              !canApprove ||
              !approvalSourceReady ||
              detail.status !== "DRAFT" ||
              approveBusy
            }
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

function ScrapLifecycleActions({
  canDispose,
  canMoveToScrap,
  detail,
  disposeBusy,
  moveBusy,
  onDispose,
  onMove,
}: {
  canDispose: boolean;
  canMoveToScrap: boolean;
  detail: ScrapNote;
  disposeBusy: boolean;
  moveBusy: boolean;
  onDispose: () => void;
  onMove: (
    itemId: string,
    input: {
      itemBarcode: string;
      sourceCellBarcode: string;
      targetCellBarcode: string;
    },
  ) => void;
}) {
  const [itemBarcode, setItemBarcode] = useState("");
  const [sourceCellBarcode, setSourceCellBarcode] = useState("");
  const [targetCellBarcode, setTargetCellBarcode] = useState("");
  const pendingItem = detail.items.find((item) => !item.scrapCellId);

  if (detail.status === "APPROVED") {
    return (
      <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
        <div>
          <p className="font-medium">Chuyển vào khu hủy</p>
          <p className="text-sm text-muted-foreground">
            Counter quét hàng, khoang nguồn đã khóa và khoang đích thuộc zone
            SCRAP.
          </p>
        </div>
        {pendingItem ? (
          <div className="grid gap-3 md:grid-cols-3">
            <TextField
              id="scrap-move-item-barcode"
              label="Barcode hàng"
              value={itemBarcode}
              onChange={setItemBarcode}
            />
            <TextField
              id="scrap-move-source-cell"
              label="Barcode khoang nguồn"
              value={sourceCellBarcode}
              onChange={setSourceCellBarcode}
            />
            <TextField
              id="scrap-move-target-cell"
              label="Barcode khoang SCRAP"
              value={targetCellBarcode}
              onChange={setTargetCellBarcode}
            />
            <Button
              disabled={
                !canMoveToScrap ||
                moveBusy ||
                !itemBarcode.trim() ||
                !sourceCellBarcode.trim() ||
                !targetCellBarcode.trim()
              }
              onClick={() =>
                onMove(pendingItem.itemId, {
                  itemBarcode: itemBarcode.trim(),
                  sourceCellBarcode: sourceCellBarcode.trim(),
                  targetCellBarcode: targetCellBarcode.trim(),
                })
              }
              type="button"
            >
              {moveBusy ? <LoaderCircle className="animate-spin" /> : null}
              Chuyển vào SCRAP
            </Button>
          </div>
        ) : (
          <p className="text-sm text-emerald-700">Các dòng đã vào khu hủy.</p>
        )}
      </div>
    );
  }

  if (detail.status === "QUARANTINED") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
        <p className="text-sm text-muted-foreground">
          Hàng đã được cách ly tại khu SCRAP, chờ Manager xác nhận tiêu hủy.
        </p>
        <Button
          disabled={!canDispose || disposeBusy}
          onClick={onDispose}
          type="button"
          variant="destructive"
        >
          {disposeBusy ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
          Xác nhận tiêu hủy
        </Button>
      </div>
    );
  }

  return null;
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
  disabled = false,
  id,
  label,
  onChange,
  required = true,
  type = "text",
  value,
}: {
  disabled?: boolean;
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
        disabled={disabled}
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
