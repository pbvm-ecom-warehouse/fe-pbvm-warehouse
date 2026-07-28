"use client";

import { useState } from "react";

import {
  CheckCircle2,
  ClipboardCheck,
  Eye,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  XCircle,
} from "lucide-react";

import { EvidenceImageGallery } from "@/components/evidence-images";
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
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/features/admin-shell/components/operations-ui";
import { statusLabel, statusTone } from "@/lib/wms-ui-labels";

import {
  GOODS_RECEIPT_NOTE_STATUSES,
  type GoodsReceiptNote,
  type GoodsReceiptNoteItem,
  type GoodsReceiptNoteStatus,
} from "../services/goods-receipt-note.service";

function formatCurrency(value?: number) {
  if (value == null) return "—";
  return `${value.toLocaleString("vi-VN")} đ`;
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Chưa có";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("vi-VN").format(date);
}

export function GoodsReceiptNotesList({
  approveBusyId,
  canApprove,
  canCreate,
  canSubmit,
  filters,
  grns,
  loading,
  onApprove,
  onCreate,
  onEdit,
  onFilterChange,
  onFilterSubmit,
  onPageChange,
  onReject,
  onSelect,
  onSubmit,
  page,
  purchaseOrderOptions,
  rejectBusyId,
  submitBusyId,
  total,
  totalPages,
}: {
  approveBusyId?: string;
  canApprove: boolean;
  canCreate: boolean;
  canSubmit: boolean;
  filters: { status: GoodsReceiptNoteStatus | "ALL"; purchaseOrderId: string };
  grns: GoodsReceiptNote[];
  loading: boolean;
  page: number;
  purchaseOrderOptions: { id: string; label: string }[];
  rejectBusyId?: string;
  submitBusyId?: string;
  total: number;
  totalPages: number;
  onApprove: (grnId: string) => void;
  onCreate: () => void;
  onEdit: (grn: GoodsReceiptNote) => void;
  onFilterChange: (
    filters: Partial<{
      status: GoodsReceiptNoteStatus | "ALL";
      purchaseOrderId: string;
    }>,
  ) => void;
  onFilterSubmit: () => void;
  onPageChange: (page: number) => void;
  onReject: (grnId: string, reason: string) => void;
  onSelect: (grn: GoodsReceiptNote) => void;
  onSubmit: (grnId: string) => void;
}) {
  const [rejectTarget, setRejectTarget] = useState<GoodsReceiptNote>();
  const [rejectReason, setRejectReason] = useState("");

  return (
    <>
      <Card>
        <CardHeader className="border-b bg-muted/20">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5">
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardCheck className="size-4 text-primary" />
                Phiếu nhập
              </CardTitle>
              <CardDescription>{total} bản ghi</CardDescription>
            </div>
            {canCreate ? (
              <Button onClick={onCreate} type="button">
                <Plus data-icon="inline-start" />
                Tạo phiếu nhập
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <form
            className="grid gap-3 md:grid-cols-[200px_1fr_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              onFilterSubmit();
            }}
          >
            <div className="space-y-2">
              <Label>Trạng thái</Label>
              <Select
                value={filters.status}
                onValueChange={(value) =>
                  onFilterChange({
                    status: value as GoodsReceiptNoteStatus | "ALL",
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tất cả</SelectItem>
                  {GOODS_RECEIPT_NOTE_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {statusLabel(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Đơn mua</Label>
              <Select
                value={filters.purchaseOrderId || "ALL"}
                onValueChange={(value) =>
                  onFilterChange({
                    purchaseOrderId: value === "ALL" ? "" : value,
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tất cả</SelectItem>
                  {purchaseOrderOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
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

          {loading ? (
            <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Đang tải phiếu nhập...
            </div>
          ) : (
            <Table scrollable>
              <TableHeader>
                <TableRow>
                  <TableHead>Số phiếu nhập</TableHead>
                  <TableHead>Số đơn mua</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Ngày tạo</TableHead>
                  <TableHead className="w-72 text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grns.length === 0 ? (
                  <TableRow>
                    <TableCell
                      className="h-24 text-center text-muted-foreground"
                      colSpan={5}
                    >
                      Chưa có phiếu nhập.
                    </TableCell>
                  </TableRow>
                ) : (
                  grns.map((grn) => (
                    <TableRow key={grn.id}>
                      <TableCell className="font-medium">
                        {grn.grnNumber}
                      </TableCell>
                      <TableCell>
                        {grn.purchaseOrderNumber ?? grn.purchaseOrderId}
                      </TableCell>
                      <TableCell>
                        <StatusBadge tone={statusTone(grn.status)}>
                          {statusLabel(grn.status)}
                        </StatusBadge>
                      </TableCell>
                      <TableCell>{formatDate(grn.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            aria-label={`Xem chi tiết phiếu nhập ${grn.grnNumber}`}
                            onClick={() => onSelect(grn)}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            <Eye data-icon="inline-start" />
                            Xem chi tiết
                          </Button>
                          {canSubmit &&
                          (grn.status === "DRAFT" ||
                            grn.status === "REJECTED") ? (
                            <>
                              <Button
                                onClick={() => onEdit(grn)}
                                size="sm"
                                type="button"
                                variant="outline"
                              >
                                <Pencil data-icon="inline-start" />
                                Chỉnh sửa
                              </Button>
                              <Button
                                disabled={submitBusyId === grn.id}
                                onClick={() => onSubmit(grn.id)}
                                size="sm"
                                type="button"
                                variant="outline"
                              >
                                {submitBusyId === grn.id ? (
                                  <LoaderCircle
                                    className="animate-spin"
                                    data-icon="inline-start"
                                  />
                                ) : (
                                  <CheckCircle2 data-icon="inline-start" />
                                )}
                                Gửi duyệt
                              </Button>
                            </>
                          ) : null}
                          {canApprove && grn.status === "PENDING_APPROVAL" ? (
                            <>
                              <Button
                                disabled={rejectBusyId === grn.id}
                                onClick={() => {
                                  setRejectTarget(grn);
                                  setRejectReason("");
                                }}
                                size="sm"
                                type="button"
                                variant="destructive"
                              >
                                <XCircle data-icon="inline-start" />
                                Từ chối
                              </Button>
                              <Button
                                disabled={approveBusyId === grn.id}
                                onClick={() => onApprove(grn.id)}
                                size="sm"
                                type="button"
                              >
                                {approveBusyId === grn.id ? (
                                  <LoaderCircle
                                    className="animate-spin"
                                    data-icon="inline-start"
                                  />
                                ) : (
                                  <ClipboardCheck data-icon="inline-start" />
                                )}
                                Duyệt
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
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
        </CardContent>
      </Card>
      <Dialog
        open={Boolean(rejectTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(undefined);
            setRejectReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Từ chối phiếu nhập</DialogTitle>
            <DialogDescription>
              Ghi rõ lý do để Receiver chỉnh sửa và gửi duyệt lại
              {rejectTarget ? ` cho ${rejectTarget.grnNumber}.` : "."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="grn-rejection-reason">Lý do từ chối</Label>
            <Textarea
              id="grn-rejection-reason"
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="Ví dụ: ảnh biên nhận chưa rõ, số thùng không khớp PO..."
              rows={4}
              value={rejectReason}
            />
          </div>
          <DialogFooter>
            <Button
              onClick={() => setRejectTarget(undefined)}
              type="button"
              variant="outline"
            >
              Hủy
            </Button>
            <Button
              disabled={
                rejectReason.trim().length < 3 ||
                rejectBusyId === rejectTarget?.id
              }
              onClick={() => {
                if (!rejectTarget) return;
                onReject(rejectTarget.id, rejectReason.trim());
              }}
              type="button"
              variant="destructive"
            >
              {rejectBusyId === rejectTarget?.id ? (
                <LoaderCircle
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : (
                <XCircle data-icon="inline-start" />
              )}
              Xác nhận từ chối
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
export function GoodsReceiptNoteDetailDialog({
  grn,
  onOpenChange,
}: {
  grn: GoodsReceiptNote;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent size="3xl" className="max-h-[90dvh] overflow-y-auto p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Chi tiết phiếu nhập</DialogTitle>
          <DialogDescription>{grn.grnNumber}</DialogDescription>
        </DialogHeader>

        <div className="divide-y divide-border/70 rounded-xl border border-border/70">
          <div className="flex flex-wrap items-start justify-between gap-3 py-4 pr-14 pl-5">
            <div>
              <div className="text-xs text-muted-foreground">Phiếu nhập</div>
              <div className="text-lg font-semibold">{grn.grnNumber}</div>
            </div>
            <StatusBadge tone={statusTone(grn.status)}>
              {statusLabel(grn.status)}
            </StatusBadge>
          </div>

          <div className="grid gap-3 px-5 py-4 text-sm sm:grid-cols-2">
            <Info
              label="Đơn mua"
              value={grn.purchaseOrderNumber ?? grn.purchaseOrderId}
            />
            <Info label="NCC" value={grn.supplierName ?? "Chưa xác định"} />
            <Info label="Ngày tạo" value={formatDate(grn.createdAt)} />
            <Info label="Ngày cập nhật" value={formatDate(grn.updatedAt)} />
          </div>

          {grn.rejectionReason ? (
            <div className="bg-destructive/5 px-5 py-4 text-sm">
              <div className="font-semibold text-destructive">
                Lý do từ chối
              </div>
              <p className="mt-1 text-muted-foreground">
                {grn.rejectionReason}
              </p>
            </div>
          ) : null}

          <div className="space-y-3 px-5 py-4">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-semibold">Danh sách hàng nhập</h3>
              <span className="text-xs text-muted-foreground">
                {grn.items.length} dòng hàng
              </span>
            </div>
            <div className="space-y-3">
              {grn.items.map((item) => (
                <GoodsReceiptItemCardReadOnly
                  item={item}
                  key={`${item.itemId}-${item.sku}-${item.lotNumber}`}
                />
              ))}
            </div>
            <div className="flex items-center justify-between rounded-lg border-t-2 border-primary/30 bg-muted/40 px-4 py-3">
              <span className="text-sm font-semibold">Tổng cộng</span>
              <span className="text-sm font-semibold">
                {(grn.totalPackageCount ?? 0).toLocaleString("vi-VN")} thùng
              </span>
            </div>
          </div>

          <div className="space-y-2 px-5 py-4">
            <h3 className="text-sm font-semibold">
              Ảnh minh chứng{" "}
              {grn.purchaseOrderNumber
                ? `cho ${grn.purchaseOrderNumber}`
                : "nhận hàng"}
            </h3>
            <EvidenceImageGallery
              emptyLabel="Chưa có ảnh minh chứng"
              images={grn.images}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}

function GoodsReceiptItemCardReadOnly({
  item,
}: {
  item: GoodsReceiptNoteItem;
}) {
  const thumbnail = item.images?.find(Boolean);
  const hasPoReference = item.expectedQty != null;

  return (
    <div className="overflow-hidden rounded-lg border border-border/70">
      <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
        {thumbnail ? (
          <span
            aria-hidden
            className="size-8 shrink-0 rounded-md border bg-muted bg-cover bg-center"
            style={{ backgroundImage: `url("${thumbnail}")` }}
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">
              {item.itemName ?? item.sku}
            </span>
            {item.isPerishable ? (
              <span
                className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800"
                title="Mặt hàng có hạn sử dụng"
              >
                HSD
              </span>
            ) : null}
          </div>
          <div
            className="truncate font-mono text-xs text-muted-foreground"
            title={item.barcode ? `SKU · Mã vạch: ${item.barcode}` : "SKU"}
          >
            {item.sku}
            {item.barcode ? ` · ${item.barcode}` : ""}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 p-3 text-sm sm:grid-cols-4">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">Thực nhập</div>
          <div className="mt-0.5 font-medium">{item.actualQty} thùng</div>
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">Đối chiếu PO</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {hasPoReference ? (
              <>
                Đặt: {item.expectedQty} · Nhận: {item.receivedQty ?? 0} · Còn:{" "}
                {item.remainingQty ?? 0}
              </>
            ) : (
              "—"
            )}
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">Lô / Hạn dùng</div>
          <div className="mt-0.5 font-medium">
            {item.lotNumber || "Không có"}
          </div>
          <div className="text-xs text-muted-foreground">
            {formatDate(item.expiryDate)}
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">Đơn giá</div>
          <div className="mt-0.5 font-medium">
            {formatCurrency(item.unitPrice)}
          </div>
        </div>
      </div>
    </div>
  );
}
