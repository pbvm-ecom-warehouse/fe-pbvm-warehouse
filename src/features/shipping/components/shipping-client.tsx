"use client";

import { type FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Boxes,
  Eye,
  LoaderCircle,
  PackageCheck,
  RefreshCw,
  Search,
  Truck,
} from "lucide-react";
import { toast } from "sonner";

import { Barcode } from "@/components/barcode";
import { Badge } from "@/components/ui/badge";
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
import { EntityDetailDialog } from "@/features/admin-shell/components/entity-detail-dialog";
import {
  PageHeader,
  PermissionNotice,
  StatusBadge,
  TableSkeleton,
} from "@/features/admin-shell/components/operations-ui";
import { getGoodsIssue } from "@/features/goods-issues/services/goods-issue.service";
import { useSessionUser } from "@/hooks/use-session-user";
import { getApiErrorMessage } from "@/lib/api-contract";
import { hasAnyRole } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { businessCodeLabel } from "@/lib/wms-ui-labels";

import {
  createShipmentPackage,
  getShipment,
  listShipments,
  SHIPMENT_STATUSES,
  type Shipment,
  type ShipmentPackage,
  type ShipmentStatus,
} from "../services/shipping.service";

const PAGE_SIZE = 20;

const shipmentStatusLabels: Record<ShipmentStatus, string> = {
  DELIVERED: "Đã giao",
  FAILED: "Giao không thành công",
  IN_TRANSIT: "Đang giao",
  PENDING: "Chờ đóng kiện",
  PICKED_UP: "Đã nhận kiện",
  READY: "Sẵn sàng xếp chuyến",
  RETURNED: "Đã hoàn về kho",
  RETURNING: "Đang hoàn về kho",
};

function shipmentStatusTone(status: ShipmentStatus) {
  if (status === "DELIVERED") return "success" as const;
  if (status === "FAILED" || status === "RETURNED") return "danger" as const;
  if (status === "PENDING" || status === "RETURNING") return "warning" as const;
  return "info" as const;
}

function ErrorBanner({ error }: { error: unknown }) {
  return (
    <div
      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
      role="alert"
    >
      {getApiErrorMessage(error) ?? "Không kết nối được WMS."}
    </div>
  );
}

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <TableRow>
      <TableCell
        className="h-24 text-center text-sm text-muted-foreground"
        colSpan={colSpan}
      >
        {text}
      </TableCell>
    </TableRow>
  );
}

function recipientAddress(address: Record<string, unknown>) {
  const values = Object.values(address).filter(
    (value): value is string =>
      typeof value === "string" && value.trim().length > 0,
  );
  return values.join(", ") || "Chưa có địa chỉ";
}

function OwnerBadge({
  shipment,
  userId,
}: {
  shipment: Shipment;
  userId?: string;
}) {
  return (
    <Badge variant="outline">
      {!shipment.assignedShipperId
        ? "Chưa gán Shipper"
        : shipment.assignedShipperId === userId
          ? "Của bạn"
          : "Đã gán Shipper"}
    </Badge>
  );
}

function PackageCard({ packageInfo }: { packageInfo: ShipmentPackage }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
      <div className="grid gap-4 border-b bg-muted/20 p-4 md:grid-cols-[minmax(0,1fr)_320px] md:items-center">
        <div>
          <div className="flex items-center gap-2 font-semibold">
            <Box className="size-4 text-primary" />
            Kiện {packageInfo.barcode}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {packageInfo.allocations.length} dòng hàng · tạo lúc{" "}
            {new Date(packageInfo.createdAt).toLocaleString("vi-VN")}
          </p>
        </div>
        <Barcode value={packageInfo.barcode} />
      </div>
      <div className="p-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">Số lượng</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {packageInfo.allocations.map((allocation) => (
              <TableRow key={`${packageInfo.barcode}:${allocation.itemId}`}>
                <TableCell className="font-mono font-semibold">
                  {allocation.sku}
                </TableCell>
                <TableCell className="text-right">
                  {allocation.quantity}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function ShippingClient() {
  const user = useSessionUser();
  const queryClient = useQueryClient();
  const canView = hasAnyRole(user?.roles, ["ADMIN", "MANAGER", "SHIPPER"]);
  const isShipper = user?.roles.includes("SHIPPER") ?? false;
  const [status, setStatus] = useState<ShipmentStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [selectedShipmentId, setSelectedShipmentId] = useState("");
  const [packageOpen, setPackageOpen] = useState(false);
  const [allocationValues, setAllocationValues] = useState<
    Record<string, string>
  >({});

  const shipmentsQuery = useQuery({
    enabled: canView,
    queryFn: () =>
      listShipments({
        limit: PAGE_SIZE,
        page,
        shipmentStatus: status,
      }),
    queryKey: ["shipping", "shipments", page, status],
  });
  const shipments = shipmentsQuery.data?.data ?? [];
  const selectedListShipment = shipments.find(
    (shipment) => shipment.id === selectedShipmentId,
  );
  const shipmentQuery = useQuery({
    enabled: Boolean(selectedShipmentId),
    queryFn: () => getShipment(selectedShipmentId),
    queryKey: ["shipping", "shipment", selectedShipmentId],
  });
  const selectedShipment = shipmentQuery.data ?? selectedListShipment;
  const goodsIssueQuery = useQuery({
    enabled: Boolean(selectedShipment?.goodsIssueId),
    queryFn: () => getGoodsIssue(selectedShipment!.goodsIssueId),
    queryKey: ["goods-issues", "detail", selectedShipment?.goodsIssueId],
  });
  const existingPackages = useMemo(
    () => selectedShipment?.packages ?? [],
    [selectedShipment?.packages],
  );
  const packagedQuantityByItem = useMemo(() => {
    const totals = new Map<string, number>();
    existingPackages.forEach((packageInfo) => {
      packageInfo.allocations.forEach((allocation) => {
        totals.set(
          allocation.itemId,
          (totals.get(allocation.itemId) ?? 0) + allocation.quantity,
        );
      });
    });
    return totals;
  }, [existingPackages]);
  const remainingItems = useMemo(
    () =>
      (goodsIssueQuery.data?.items ?? [])
        .map((item) => ({
          ...item,
          remainingToPack: Math.max(
            0,
            item.quantity - (packagedQuantityByItem.get(item.itemId) ?? 0),
          ),
        }))
        .filter((item) => item.remainingToPack > 0),
    [goodsIssueQuery.data?.items, packagedQuantityByItem],
  );
  const canPack =
    isShipper &&
    Boolean(user?.id) &&
    selectedShipment?.assignedShipperId === user?.id &&
    selectedShipment?.shipmentStatus === "PENDING";

  const packageMutation = useMutation({
    mutationFn: () => {
      const allocations = remainingItems
        .map((item) => ({
          itemId: item.itemId,
          quantity: Number(allocationValues[item.itemId] ?? 0),
        }))
        .filter(
          (item) =>
            Number.isInteger(item.quantity) && Number(item.quantity) > 0,
        );

      if (allocations.length === 0) {
        throw new Error("Nhập số lượng cho ít nhất một dòng hàng.");
      }

      const invalid = allocations.find((allocation) => {
        const source = remainingItems.find(
          (item) => item.itemId === allocation.itemId,
        );
        return !source || allocation.quantity > source.remainingToPack;
      });
      if (invalid) {
        throw new Error("Số lượng đóng kiện vượt quá số lượng còn lại.");
      }

      return createShipmentPackage(selectedShipmentId, { allocations });
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error) ?? "Không thể đóng kiện hàng."),
    onSuccess: async (updatedShipment) => {
      queryClient.setQueryData(
        ["shipping", "shipment", updatedShipment.id],
        updatedShipment,
      );
      setPackageOpen(false);
      setAllocationValues({});
      toast.success(
        updatedShipment.shipmentStatus === "READY"
          ? "Đã đóng đủ hàng. Vận đơn sẵn sàng xếp chuyến."
          : "Đã tạo kiện và mã vạch nội bộ.",
      );
      await queryClient.invalidateQueries({
        queryKey: ["shipping", "shipments"],
      });
    },
  });

  const total = shipmentsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function openPackageDialog() {
    setAllocationValues(
      Object.fromEntries(
        remainingItems.map((item) => [
          item.itemId,
          String(item.remainingToPack),
        ]),
      ),
    );
    setPackageOpen(true);
  }

  function closeDetail() {
    setSelectedShipmentId("");
    setPackageOpen(false);
    setAllocationValues({});
  }

  function handleFilter(event: FormEvent) {
    event.preventDefault();
    setPage(1);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Giao hàng"
        actions={
          <Button
            disabled={!canView}
            onClick={() =>
              void queryClient.invalidateQueries({
                queryKey: ["shipping", "shipments"],
              })
            }
            type="button"
            variant="outline"
          >
            {shipmentsQuery.isFetching ? (
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
          Bạn cần quyền Shipper, Manager hoặc Admin để xem giao hàng.
        </PermissionNotice>
      ) : null}
      {shipmentsQuery.error ? (
        <ErrorBanner error={shipmentsQuery.error} />
      ) : null}

      <Card className="min-w-0">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="flex items-center gap-2 text-base">
            <Truck className="size-4 text-primary" />
            Vận đơn kho
          </CardTitle>
          <CardDescription>
            {total} bản ghi · trang {page}/{totalPages}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <form
            className="grid gap-3 md:grid-cols-[240px_auto]"
            onSubmit={handleFilter}
          >
            <div className="space-y-2">
              <Label>Trạng thái</Label>
              <Select
                onValueChange={(value) => {
                  setStatus(value as ShipmentStatus | "ALL");
                  setPage(1);
                }}
                value={status}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tất cả</SelectItem>
                  {SHIPMENT_STATUSES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {shipmentStatusLabels[item]}
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

          {shipmentsQuery.isLoading ? (
            <TableSkeleton columns={6} />
          ) : (
            <Table scrollable>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã vận đơn kho</TableHead>
                  <TableHead>Mã đơn hàng</TableHead>
                  <TableHead>Người nhận</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Số kiện</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shipments.length === 0 ? (
                  <EmptyRow colSpan={6} text="Chưa có vận đơn phù hợp." />
                ) : (
                  shipments.map((shipment) => (
                    <TableRow
                      className={cn(
                        "cursor-pointer",
                        selectedShipmentId === shipment.id && "bg-primary/5",
                      )}
                      key={shipment.id}
                      onClick={() => setSelectedShipmentId(shipment.id)}
                    >
                      <TableCell className="font-mono font-semibold">
                        {businessCodeLabel(shipment.shipmentNumber)}
                      </TableCell>
                      <TableCell>
                        {businessCodeLabel(shipment.orderCode)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {shipment.recipient.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {shipment.recipient.phone}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          tone={shipmentStatusTone(shipment.shipmentStatus)}
                        >
                          {shipmentStatusLabels[shipment.shipmentStatus]}
                        </StatusBadge>
                      </TableCell>
                      <TableCell>{shipment.packages.length}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedShipmentId(shipment.id);
                          }}
                          size="sm"
                          type="button"
                          variant="outline"
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

      <div className="flex items-center justify-between">
        <Button
          disabled={page <= 1}
          onClick={() => setPage((value) => value - 1)}
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
          onClick={() => setPage((value) => value + 1)}
          type="button"
          variant="outline"
        >
          Trang sau
        </Button>
      </div>

      <EntityDetailDialog
        description={`Mã vận đơn kho: ${businessCodeLabel(selectedShipment?.shipmentNumber)}`}
        onOpenChange={(open) => {
          if (!open) closeDetail();
        }}
        open={Boolean(selectedShipmentId)}
        title="Chi tiết vận đơn và kiện hàng"
      >
        {shipmentQuery.isLoading && !selectedShipment ? (
          <TableSkeleton columns={4} />
        ) : null}
        {shipmentQuery.error ? (
          <ErrorBanner error={shipmentQuery.error} />
        ) : null}
        {selectedShipment ? (
          <div className="space-y-4">
            <Card>
              <CardHeader className="border-b bg-muted/20">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">
                      Đơn hàng {businessCodeLabel(selectedShipment.orderCode)}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {selectedShipment.recipient.name} ·{" "}
                      {selectedShipment.recipient.phone}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <OwnerBadge shipment={selectedShipment} userId={user?.id} />
                    <StatusBadge
                      tone={shipmentStatusTone(selectedShipment.shipmentStatus)}
                    >
                      {shipmentStatusLabels[selectedShipment.shipmentStatus]}
                    </StatusBadge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 pt-4 md:grid-cols-2">
                <div className="rounded-lg border bg-muted/15 p-3">
                  <div className="text-xs text-muted-foreground">
                    Địa chỉ giao
                  </div>
                  <div className="mt-1 text-sm font-medium">
                    {recipientAddress(selectedShipment.recipient.address)}
                  </div>
                </div>
                <div className="rounded-lg border bg-muted/15 p-3">
                  <div className="text-xs text-muted-foreground">
                    Thanh toán
                  </div>
                  <div className="mt-1 text-sm font-medium">
                    {selectedShipment.paymentMethod === "COD"
                      ? `COD ${selectedShipment.codAmount.toLocaleString("vi-VN")} đ`
                      : "Đã thanh toán trực tuyến"}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b bg-muted/20">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Boxes className="size-4 text-primary" />
                      Kiện hàng
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Mã vạch do WMS sinh sau khi đóng kiện.
                    </CardDescription>
                  </div>
                  {canPack ? (
                    <Button
                      disabled={
                        goodsIssueQuery.isLoading || remainingItems.length === 0
                      }
                      onClick={openPackageDialog}
                      type="button"
                    >
                      <PackageCheck data-icon="inline-start" />
                      Đóng kiện
                    </Button>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                {goodsIssueQuery.error ? (
                  <ErrorBanner error={goodsIssueQuery.error} />
                ) : null}
                {existingPackages.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                    Chưa có kiện hàng.
                  </div>
                ) : (
                  existingPackages.map((packageInfo) => (
                    <PackageCard
                      key={packageInfo.barcode}
                      packageInfo={packageInfo}
                    />
                  ))
                )}
                {!canPack ? (
                  <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                    {isShipper
                      ? "Chỉ Shipper được gán cho vận đơn ở trạng thái chờ mới có thể đóng kiện."
                      : "Manager và Admin chỉ xem thông tin đóng kiện."}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </EntityDetailDialog>

      <Dialog
        onOpenChange={(open) => {
          setPackageOpen(open);
          if (!open) setAllocationValues({});
        }}
        open={packageOpen}
      >
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Đóng kiện hàng</DialogTitle>
            <DialogDescription>
              Chọn số lượng của từng dòng. WMS sẽ sinh barcode mới cho kiện.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              packageMutation.mutate();
            }}
          >
            <Table scrollable containerClassName="max-h-[50dvh]">
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Còn cần đóng</TableHead>
                  <TableHead className="w-40">Số lượng</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {remainingItems.map((item) => (
                  <TableRow key={item.itemId}>
                    <TableCell className="font-mono font-semibold">
                      {item.sku}
                    </TableCell>
                    <TableCell>{item.remainingToPack}</TableCell>
                    <TableCell>
                      <Input
                        aria-label={`Số lượng ${item.sku}`}
                        inputMode="numeric"
                        max={item.remainingToPack}
                        min={0}
                        onChange={(event) =>
                          setAllocationValues((values) => ({
                            ...values,
                            [item.itemId]: event.target.value,
                          }))
                        }
                        type="number"
                        value={allocationValues[item.itemId] ?? ""}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <DialogFooter>
              <Button disabled={packageMutation.isPending} type="submit">
                {packageMutation.isPending ? (
                  <LoaderCircle
                    className="animate-spin"
                    data-icon="inline-start"
                  />
                ) : (
                  <Box data-icon="inline-start" />
                )}
                Tạo kiện và barcode
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
