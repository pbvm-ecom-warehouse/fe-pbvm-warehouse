"use client";

import { useState } from "react";

import {
  CheckCircle2,
  ClipboardCheck,
  Eye,
  LoaderCircle,
  Pencil,
  Plus,
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

import type {
  GoodsReceiptNote,
  GoodsReceiptNoteItem,
} from "../services/goods-receipt-note.service";
import { GoodsReceiptPutawayPanel } from "./goods-receipt-putaway-panel";

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
  canConfirm,
  canCreate,
  confirmBusyId,
  grns,
  loading,
  onApprove,
  onConfirm,
  onCreate,
  onEdit,
  onReject,
  onSelect,
  rejectBusyId,
}: {
  approveBusyId?: string;
  canApprove: boolean;
  canConfirm: boolean;
  canCreate: boolean;
  confirmBusyId?: string;
  grns: GoodsReceiptNote[];
  loading: boolean;
  rejectBusyId?: string;
  onApprove: (grnId: string) => void;
  onConfirm: (grnId: string) => void;
  onCreate: () => void;
  onEdit: (grn: GoodsReceiptNote) => void;
  onReject: (grnId: string, reason: string) => void;
  onSelect: (grn: GoodsReceiptNote) => void;
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
              <CardDescription>{grns.length} bản ghi</CardDescription>
            </div>
            {canCreate ? (
              <Button onClick={onCreate} type="button">
                <Plus data-icon="inline-start" />
                Tạo phiếu nhập
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="pt-4">
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
                          {canConfirm &&
                          (grn.status === "DRAFT" ||
                            grn.status === "REJECTED") ? (
                            <>
                              {grn.status === "REJECTED" ? (
                                <Button
                                  onClick={() => onEdit(grn)}
                                  size="sm"
                                  type="button"
                                  variant="outline"
                                >
                                  <Pencil data-icon="inline-start" />
                                  Chỉnh sửa
                                </Button>
                              ) : null}
                              <Button
                                disabled={confirmBusyId === grn.id}
                                onClick={() => onConfirm(grn.id)}
                                size="sm"
                                type="button"
                                variant="outline"
                              >
                                {confirmBusyId === grn.id ? (
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
      <DialogContent size="3xl" className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Chi tiết phiếu nhập</DialogTitle>
          <DialogDescription>{grn.grnNumber}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 text-sm sm:grid-cols-3">
          <Info
            label="Đơn mua"
            value={grn.purchaseOrderNumber ?? grn.purchaseOrderId}
          />
          <Info label="NCC" value={grn.supplierName ?? "Chưa xác định"} />
          <Info label="Trạng thái" value={statusLabel(grn.status)} />
          <Info label="Ngày tạo" value={formatDate(grn.createdAt)} />
          <Info label="Ngày cập nhật" value={formatDate(grn.updatedAt)} />
          <Info label="Số dòng" value={String(grn.items.length)} />
          <Info
            label="Tổng số thùng"
            value={String(grn.totalPackageCount ?? "—")}
          />
          <Info
            label="Tổng thể tích"
            value={
              grn.totalVolumeCm3 == null
                ? "—"
                : `${(grn.totalVolumeCm3 / 1_000_000).toLocaleString("vi-VN", {
                    maximumFractionDigits: 3,
                  })} m³`
            }
          />
        </div>

        {grn.rejectionReason ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <div className="font-semibold text-destructive">Lý do từ chối</div>
            <p className="mt-1 text-muted-foreground">{grn.rejectionReason}</p>
          </div>
        ) : null}

        <Table scrollable>
          <TableHeader>
            <TableRow>
              <TableHead>Mặt hàng</TableHead>
              <TableHead>Thực nhập</TableHead>
              <TableHead>Đối chiếu PO</TableHead>
              <TableHead>Đơn giá</TableHead>
              <TableHead>Mã lô</TableHead>
              <TableHead>Hạn sử dụng</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {grn.items.map((item) => (
              <GoodsReceiptItemRow
                item={item}
                key={`${item.itemId}-${item.sku}-${item.lotNumber}`}
              />
            ))}
          </TableBody>
        </Table>

        <GoodsReceiptPutawayPanel grn={grn} />
        <div className="space-y-2">
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

function GoodsReceiptItemRow({ item }: { item: GoodsReceiptNoteItem }) {
  const thumbnail = item.images?.find(Boolean);
  const hasPoReference = item.expectedQty != null;

  return (
    <TableRow>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          {thumbnail ? (
            <span
              aria-hidden
              className="size-8 shrink-0 rounded-md border bg-muted bg-cover bg-center"
              style={{ backgroundImage: `url("${thumbnail}")` }}
            />
          ) : null}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 truncate">
              {item.itemName ?? item.sku}
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
      </TableCell>
      <TableCell>{item.actualQty} thùng</TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {hasPoReference ? (
          <>
            Đặt: {item.expectedQty} · Đã nhận: {item.receivedQty ?? 0} · Còn:{" "}
            {item.remainingQty ?? 0}
          </>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell>{formatCurrency(item.unitPrice)}</TableCell>
      <TableCell>{item.lotNumber || "Không có"}</TableCell>
      <TableCell>{formatDate(item.expiryDate)}</TableCell>
    </TableRow>
  );
}
