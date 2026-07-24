"use client";

import {
  CheckCircle2,
  ClipboardCheck,
  Eye,
  LoaderCircle,
  Plus,
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
import { StatusBadge } from "@/features/admin-shell/components/operations-ui";
import type { WarehouseItem } from "@/features/products/services/warehouse-items.service";
import { statusLabel, statusTone } from "@/lib/wms-ui-labels";

import type { GoodsReceiptNote } from "../services/goods-receipt-note.service";
import type { PurchaseOrder } from "../services/purchase-order.service";

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
  onSelect,
  purchaseOrderById,
}: {
  approveBusyId?: string;
  canApprove: boolean;
  canConfirm: boolean;
  canCreate: boolean;
  confirmBusyId?: string;
  grns: GoodsReceiptNote[];
  loading: boolean;
  onApprove: (grnId: string) => void;
  onConfirm: (grnId: string) => void;
  onCreate: () => void;
  onSelect: (grn: GoodsReceiptNote) => void;
  purchaseOrderById: Map<string, PurchaseOrder>;
}) {
  return (
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
                      {purchaseOrderById.get(grn.purchaseOrderId)?.poNumber ??
                        grn.purchaseOrderId}
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
                        {canConfirm && grn.status === "DRAFT" ? (
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
                            Xác nhận
                          </Button>
                        ) : null}
                        {canApprove && grn.status === "CONFIRMED" ? (
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
  );
}

export function GoodsReceiptNoteDetailDialog({
  grn,
  itemById,
  onOpenChange,
  purchaseOrder,
}: {
  grn: GoodsReceiptNote;
  itemById: Map<string, WarehouseItem>;
  onOpenChange: (open: boolean) => void;
  purchaseOrder?: PurchaseOrder;
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
            value={purchaseOrder?.poNumber ?? grn.purchaseOrderId}
          />
          <Info label="Trạng thái" value={statusLabel(grn.status)} />
          <Info label="Ngày tạo" value={formatDate(grn.createdAt)} />
          <Info label="Ngày cập nhật" value={formatDate(grn.updatedAt)} />
          <Info label="Số dòng" value={String(grn.items.length)} />
        </div>

        <Table scrollable>
          <TableHeader>
            <TableRow>
              <TableHead>Tên mặt hàng</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Thực nhập</TableHead>
              <TableHead>Đơn vị</TableHead>
              <TableHead>Mã lô</TableHead>
              <TableHead>Hạn sử dụng</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {grn.items.map((item) => (
              <TableRow key={`${item.itemId}-${item.sku}-${item.lotNumber}`}>
                <TableCell className="font-medium">
                  {itemById.get(item.itemId)?.name ?? item.sku}
                </TableCell>
                <TableCell>{item.sku}</TableCell>
                <TableCell>{item.actualQty}</TableCell>
                <TableCell>{item.unit}</TableCell>
                <TableCell>{item.lotNumber || "Không có"}</TableCell>
                <TableCell>{formatDate(item.expiryDate)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Ảnh minh chứng</h3>
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
