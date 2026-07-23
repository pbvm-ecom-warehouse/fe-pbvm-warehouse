"use client";

import { type FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CirclePlus,
  Eye,
  LoaderCircle,
  Pencil,
  RefreshCw,
  Route,
  Truck,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  EmptyState,
  EntityDrawer,
  PageHeader,
  PermissionNotice,
  StatusBadge,
  TableSkeleton,
} from "@/features/admin-shell/components/operations-ui";
import { useSessionUser } from "@/hooks/use-session-user";
import { getApiErrorMessage } from "@/lib/api-contract";
import { hasAnyRole } from "@/lib/rbac";
import { cn } from "@/lib/utils";

import {
  assignShipmentCarrier,
  CARRIER_STATUSES,
  createCarrier,
  listCarriers,
  listShipments,
  updateCarrier,
  updateShipmentStatus,
  type Carrier,
  type CarrierStatus,
  type Shipment,
  type ShipmentStatus,
} from "../services/shipping.service";

const PAGE_SIZE = 20;

const shipmentStatusLabels: Record<ShipmentStatus, string> = {
  DELIVERED: "Đã giao",
  FAILED: "Giao không thành công",
  IN_TRANSIT: "Đang giao",
  PENDING: "Chờ bàn giao",
  PICKED_UP: "Đã nhận hàng",
  RETURNED: "Đã hoàn về",
  RETURNING: "Đang hoàn về",
};

const carrierStatusLabels: Record<CarrierStatus, string> = {
  ACTIVE: "Đang hoạt động",
  INACTIVE: "Ngừng hoạt động",
};

const nextShipmentStatuses: Record<ShipmentStatus, ShipmentStatus[]> = {
  DELIVERED: [],
  FAILED: ["IN_TRANSIT", "RETURNING"],
  IN_TRANSIT: ["DELIVERED", "FAILED"],
  PENDING: ["PICKED_UP"],
  PICKED_UP: ["IN_TRANSIT"],
  RETURNED: [],
  RETURNING: ["RETURNED"],
};

const defaultCarrierForm = {
  code: "",
  email: "",
  name: "",
  note: "",
  phone: "",
  status: "ACTIVE" as CarrierStatus,
};

function statusTone(status: ShipmentStatus | CarrierStatus) {
  if (status === "DELIVERED" || status === "ACTIVE") return "success" as const;
  if (status === "FAILED" || status === "RETURNED" || status === "INACTIVE") {
    return "danger" as const;
  }
  if (status === "PENDING" || status === "RETURNING") return "warning" as const;
  return "info" as const;
}

function formatError(error: unknown) {
  return getApiErrorMessage(error) ?? "Không kết nối được WMS.";
}

function toContactInfo(phone: string, email: string) {
  const contactInfo = {
    ...(email.trim() ? { email: email.trim() } : {}),
    ...(phone.trim() ? { phone: phone.trim() } : {}),
  };
  return Object.keys(contactInfo).length ? contactInfo : undefined;
}

function toCarrierForm(carrier?: Carrier) {
  return {
    code: carrier?.code ?? "",
    email:
      typeof carrier?.contactInfo?.email === "string"
        ? carrier.contactInfo.email
        : "",
    name: carrier?.name ?? "",
    note: carrier?.note ?? "",
    phone:
      typeof carrier?.contactInfo?.phone === "string"
        ? carrier.contactInfo.phone
        : "",
    status: carrier?.status ?? "ACTIVE",
  };
}

export function ShippingClient() {
  const user = useSessionUser();
  const queryClient = useQueryClient();
  const canViewShipping = hasAnyRole(user?.roles, [
    "ADMIN",
    "MANAGER",
    "SHIPPER",
  ]);
  const canOperateShipments = hasAnyRole(user?.roles, ["ADMIN", "SHIPPER"]);
  const canManageCarriers = hasAnyRole(user?.roles, ["ADMIN", "MANAGER"]);
  const [selectedShipmentId, setSelectedShipmentId] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [carrierOpen, setCarrierOpen] = useState(false);
  const [editingCarrier, setEditingCarrier] = useState<Carrier | null>(null);
  const [detailCarrier, setDetailCarrier] = useState<Carrier | null>(null);
  const [assignForm, setAssignForm] = useState({
    carrierId: "",
    trackingNumber: "",
  });
  const [statusForm, setStatusForm] = useState({ note: "", status: "" });
  const [carrierForm, setCarrierForm] = useState(defaultCarrierForm);

  const shipmentsQuery = useQuery({
    enabled: canViewShipping,
    queryFn: () => listShipments({ limit: PAGE_SIZE, page: 1 }),
    queryKey: ["shipping", "shipments"],
  });
  const carriersQuery = useQuery({
    enabled: canViewShipping,
    queryFn: () => listCarriers({ limit: PAGE_SIZE, page: 1 }),
    queryKey: ["shipping", "carriers"],
  });
  const shipments = useMemo(
    () => shipmentsQuery.data?.data ?? [],
    [shipmentsQuery.data],
  );
  const carriers = useMemo(
    () => carriersQuery.data?.data ?? [],
    [carriersQuery.data],
  );
  const selectedShipment =
    shipments.find((shipment) => shipment.id === selectedShipmentId) ??
    shipments[0];
  const activeCarriers = useMemo(
    () => carriers.filter((carrier) => carrier.status === "ACTIVE"),
    [carriers],
  );
  const nextStatuses = selectedShipment
    ? nextShipmentStatuses[selectedShipment.shipmentStatus]
    : [];

  const assignMutation = useMutation({
    mutationFn: () =>
      assignShipmentCarrier(selectedShipment?.id ?? "", assignForm),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: () => {
      setAssignOpen(false);
      void queryClient.invalidateQueries({
        queryKey: ["shipping", "shipments"],
      });
      toast.success("Đã gán hãng vận chuyển và mã vận đơn");
    },
  });
  const statusMutation = useMutation({
    mutationFn: () =>
      updateShipmentStatus(selectedShipment?.id ?? "", {
        note: statusForm.note.trim() || undefined,
        status: statusForm.status as ShipmentStatus,
      }),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: () => {
      setStatusOpen(false);
      void queryClient.invalidateQueries({
        queryKey: ["shipping", "shipments"],
      });
      toast.success("Đã cập nhật trạng thái giao hàng");
    },
  });
  const carrierMutation = useMutation({
    mutationFn: () => {
      const contactInfo = toContactInfo(carrierForm.phone, carrierForm.email);
      if (editingCarrier) {
        return updateCarrier(editingCarrier.id, {
          contactInfo,
          name: carrierForm.name.trim(),
          note: carrierForm.note.trim() || undefined,
          status: carrierForm.status,
        });
      }
      return createCarrier({
        code: carrierForm.code.trim(),
        contactInfo,
        name: carrierForm.name.trim(),
        note: carrierForm.note.trim() || undefined,
      });
    },
    onError: (error) => toast.error(formatError(error)),
    onSuccess: () => {
      setCarrierOpen(false);
      setEditingCarrier(null);
      void queryClient.invalidateQueries({
        queryKey: ["shipping", "carriers"],
      });
      toast.success(
        editingCarrier
          ? "Đã cập nhật hãng vận chuyển"
          : "Đã thêm hãng vận chuyển",
      );
    },
  });

  function openAssignDialog() {
    setAssignForm({
      carrierId: selectedShipment?.carrierId ?? "",
      trackingNumber: selectedShipment?.trackingNumber ?? "",
    });
    setAssignOpen(true);
  }

  function openStatusDialog() {
    setStatusForm({ note: "", status: nextStatuses[0] ?? "" });
    setStatusOpen(true);
  }

  function openCarrierDialog(carrier?: Carrier) {
    setEditingCarrier(carrier ?? null);
    setCarrierForm(toCarrierForm(carrier));
    setCarrierOpen(true);
  }

  function handleAssign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assignForm.carrierId || !assignForm.trackingNumber.trim()) {
      toast.error("Chọn hãng vận chuyển và nhập mã vận đơn.");
      return;
    }
    assignMutation.mutate();
  }

  function handleStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!statusForm.status) return;
    statusMutation.mutate();
  }

  function handleCarrierSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !carrierForm.name.trim() ||
      (!editingCarrier && !carrierForm.code.trim())
    )
      return;
    carrierMutation.mutate();
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Giao hàng"
        actions={
          <Button
            disabled={!canViewShipping}
            onClick={() =>
              void queryClient.invalidateQueries({ queryKey: ["shipping"] })
            }
            type="button"
            variant="outline"
          >
            {shipmentsQuery.isFetching || carriersQuery.isFetching ? (
              <LoaderCircle className="animate-spin" data-icon="inline-start" />
            ) : (
              <RefreshCw data-icon="inline-start" />
            )}
            Làm mới
          </Button>
        }
      />

      {!canViewShipping ? (
        <PermissionNotice>
          Bạn cần quyền giao hàng để xem khu vực này.
        </PermissionNotice>
      ) : null}

      <Tabs defaultValue="shipments">
        <TabsList className="h-9 rounded-lg border bg-card p-1">
          <TabsTrigger className="px-3" value="shipments">
            <Route data-icon="inline-start" />
            Vận đơn
          </TabsTrigger>
          <TabsTrigger className="px-3" value="carriers">
            <Truck data-icon="inline-start" />
            Hãng vận chuyển
          </TabsTrigger>
        </TabsList>

        <TabsContent className="mt-4" value="shipments">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
            <ShipmentTable
              isLoading={shipmentsQuery.isLoading}
              onSelect={(shipment) => setSelectedShipmentId(shipment.id)}
              selectedId={selectedShipment?.id ?? ""}
              shipments={shipments}
            />
            <ShipmentPanel
              canAdvance={nextStatuses.length > 0}
              canOperate={canOperateShipments}
              onAssign={openAssignDialog}
              onUpdateStatus={openStatusDialog}
              shipment={selectedShipment}
            />
          </div>
        </TabsContent>

        <TabsContent className="mt-4" value="carriers">
          <CarrierTable
            canManage={canManageCarriers}
            carriers={carriers}
            isLoading={carriersQuery.isLoading}
            onCreate={() => openCarrierDialog()}
            onEdit={openCarrierDialog}
            onView={setDetailCarrier}
          />
        </TabsContent>
      </Tabs>

      <EntityDrawer
        open={Boolean(detailCarrier)}
        onOpenChange={(open) => {
          if (!open) setDetailCarrier(null);
        }}
        title="Chi tiết hãng vận chuyển"
        description={
          detailCarrier
            ? `${detailCarrier.name} · ${detailCarrier.code}`
            : undefined
        }
      >
        {detailCarrier ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoRow label="Mã hãng" mono value={detailCarrier.code} />
            <InfoRow label="Tên hãng" value={detailCarrier.name} />
            <InfoRow
              label="Trạng thái"
              value={carrierStatusLabels[detailCarrier.status]}
            />
            <InfoRow
              label="Số điện thoại"
              value={
                typeof detailCarrier.contactInfo?.phone === "string"
                  ? detailCarrier.contactInfo.phone
                  : "Chưa khai báo"
              }
            />
            <InfoRow
              label="Email"
              value={
                typeof detailCarrier.contactInfo?.email === "string"
                  ? detailCarrier.contactInfo.email
                  : "Chưa khai báo"
              }
            />
            <InfoRow label="Ghi chú" value={detailCarrier.note ?? "Không có"} />
            <InfoRow
              label="Ngày tạo"
              value={
                detailCarrier.createdAt
                  ? new Date(detailCarrier.createdAt).toLocaleString("vi-VN")
                  : "Chưa có dữ liệu"
              }
            />
            <InfoRow
              label="Cập nhật"
              value={
                detailCarrier.updatedAt
                  ? new Date(detailCarrier.updatedAt).toLocaleString("vi-VN")
                  : "Chưa có dữ liệu"
              }
            />
          </div>
        ) : null}
      </EntityDrawer>
      <Dialog onOpenChange={setAssignOpen} open={assignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gán hãng vận chuyển</DialogTitle>
            <DialogDescription>
              Chọn hãng đang hoạt động và ghi nhận mã vận đơn.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleAssign}>
            <div className="space-y-2">
              <Label>Hãng vận chuyển</Label>
              <Select
                onValueChange={(carrierId) =>
                  setAssignForm((form) => ({ ...form, carrierId }))
                }
                value={assignForm.carrierId}
              >
                <SelectTrigger aria-label="Hãng vận chuyển">
                  <SelectValue placeholder="Chọn hãng" />
                </SelectTrigger>
                <SelectContent>
                  {activeCarriers.map((carrier) => (
                    <SelectItem key={carrier.id} value={carrier.id}>
                      {carrier.name} · {carrier.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="shipment-tracking">Mã vận đơn</Label>
              <Input
                id="shipment-tracking"
                onChange={(event) =>
                  setAssignForm((form) => ({
                    ...form,
                    trackingNumber: event.target.value,
                  }))
                }
                value={assignForm.trackingNumber}
              />
            </div>
            <DialogFooter>
              <Button disabled={assignMutation.isPending} type="submit">
                {assignMutation.isPending ? (
                  <LoaderCircle
                    className="animate-spin"
                    data-icon="inline-start"
                  />
                ) : null}
                Lưu gán hãng
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={setStatusOpen} open={statusOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cập nhật trạng thái giao hàng</DialogTitle>
            <DialogDescription>
              Chỉ hiển thị bước tiếp theo hợp lệ của vận đơn.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleStatus}>
            <div className="space-y-2">
              <Label>Trạng thái</Label>
              <Select
                onValueChange={(status) =>
                  setStatusForm((form) => ({ ...form, status }))
                }
                value={statusForm.status}
              >
                <SelectTrigger aria-label="Trạng thái">
                  <SelectValue placeholder="Chọn trạng thái" />
                </SelectTrigger>
                <SelectContent>
                  {nextStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {shipmentStatusLabels[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="shipment-status-note">Ghi chú</Label>
              <Input
                id="shipment-status-note"
                onChange={(event) =>
                  setStatusForm((form) => ({
                    ...form,
                    note: event.target.value,
                  }))
                }
                value={statusForm.note}
              />
            </div>
            <DialogFooter>
              <Button
                disabled={statusMutation.isPending || !statusForm.status}
                type="submit"
              >
                {statusMutation.isPending ? (
                  <LoaderCircle
                    className="animate-spin"
                    data-icon="inline-start"
                  />
                ) : null}
                Lưu trạng thái
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={setCarrierOpen} open={carrierOpen}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>
              {editingCarrier
                ? "Cập nhật hãng vận chuyển"
                : "Thêm hãng vận chuyển"}
            </DialogTitle>
            <DialogDescription>
              Thông tin liên hệ dùng khi điều phối và bàn giao vận đơn.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={handleCarrierSave}
          >
            <FormField
              id="carrier-name"
              label="Tên hãng"
              onChange={(name) => setCarrierForm((form) => ({ ...form, name }))}
              value={carrierForm.name}
            />
            <FormField
              disabled={Boolean(editingCarrier)}
              id="carrier-code"
              label="Mã hãng"
              onChange={(code) => setCarrierForm((form) => ({ ...form, code }))}
              value={carrierForm.code}
            />
            <FormField
              id="carrier-phone"
              label="Số điện thoại"
              onChange={(phone) =>
                setCarrierForm((form) => ({ ...form, phone }))
              }
              value={carrierForm.phone}
            />
            <FormField
              id="carrier-email"
              label="Email"
              onChange={(email) =>
                setCarrierForm((form) => ({ ...form, email }))
              }
              type="email"
              value={carrierForm.email}
            />
            {editingCarrier ? (
              <div className="space-y-2">
                <Label>Trạng thái</Label>
                <Select
                  onValueChange={(status) =>
                    setCarrierForm((form) => ({
                      ...form,
                      status: status as CarrierStatus,
                    }))
                  }
                  value={carrierForm.status}
                >
                  <SelectTrigger aria-label="Trạng thái hãng">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CARRIER_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {carrierStatusLabels[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="carrier-note">Ghi chú</Label>
              <Input
                id="carrier-note"
                onChange={(event) =>
                  setCarrierForm((form) => ({
                    ...form,
                    note: event.target.value,
                  }))
                }
                value={carrierForm.note}
              />
            </div>
            <DialogFooter className="sm:col-span-2">
              <Button disabled={carrierMutation.isPending} type="submit">
                {carrierMutation.isPending ? (
                  <LoaderCircle
                    className="animate-spin"
                    data-icon="inline-start"
                  />
                ) : null}
                {editingCarrier ? "Lưu thay đổi" : "Tạo hãng"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ShipmentTable({
  isLoading,
  onSelect,
  selectedId,
  shipments,
}: {
  isLoading: boolean;
  onSelect: (shipment: Shipment) => void;
  selectedId: string;
  shipments: Shipment[];
}) {
  return (
    <Card className="gap-0">
      <CardHeader className="border-b bg-muted/25 py-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Route className="size-4 text-primary" />
          Danh sách vận đơn
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {isLoading ? (
          <TableSkeleton columns={5} />
        ) : (
          <Table scrollable>
            <TableHeader>
              <TableRow>
                <TableHead>Mã đơn hàng</TableHead>
                <TableHead>Người nhận</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Mã vận đơn</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipments.length === 0 ? (
                <EmptyRow colSpan={5} label="Chưa có vận đơn phù hợp." />
              ) : (
                shipments.map((shipment) => (
                  <TableRow
                    className={cn(
                      "cursor-pointer",
                      selectedId === shipment.id && "bg-primary/5",
                    )}
                    key={shipment.id}
                    onClick={() => onSelect(shipment)}
                  >
                    <TableCell className="font-mono font-semibold">
                      {shipment.orderId}
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
                      <StatusBadge tone={statusTone(shipment.shipmentStatus)}>
                        {shipmentStatusLabels[shipment.shipmentStatus]}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {shipment.trackingNumber ?? "Chưa gán"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        type="button"
                        variant="outline"
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelect(shipment);
                        }}
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
  );
}
function ShipmentPanel({
  canAdvance,
  canOperate,
  onAssign,
  onUpdateStatus,
  shipment,
}: {
  canAdvance: boolean;
  canOperate: boolean;
  onAssign: () => void;
  onUpdateStatus: () => void;
  shipment: Shipment | undefined;
}) {
  if (!shipment)
    return (
      <EmptyState
        description="Chọn một vận đơn từ danh sách để xem thông tin bàn giao."
        title="Chưa chọn vận đơn"
      />
    );

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/25">
        <CardTitle className="flex items-center gap-2 text-base">
          <Truck className="size-4 text-primary" />
          Phiếu giao hàng
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        <InfoRow label="Mã đơn hàng" value={shipment.orderId} />
        <InfoRow
          label="Người nhận"
          value={`${shipment.recipient.name} · ${shipment.recipient.phone}`}
        />
        <InfoRow
          label="Mã vận đơn"
          mono
          value={shipment.trackingNumber ?? "Chưa gán"}
        />
        {canOperate ? (
          <div className="grid gap-2 border-t pt-4">
            <Button onClick={onAssign} type="button" variant="outline">
              <Truck data-icon="inline-start" />
              Gán hãng và mã vận đơn
            </Button>
            <Button
              disabled={!canAdvance}
              onClick={onUpdateStatus}
              type="button"
            >
              <Route data-icon="inline-start" />
              Cập nhật trạng thái
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
            Vai trò hiện tại chỉ xem thông tin vận đơn.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CarrierTable({
  canManage,
  carriers,
  isLoading,
  onCreate,
  onEdit,
  onView,
}: {
  canManage: boolean;
  carriers: Carrier[];
  isLoading: boolean;
  onCreate: () => void;
  onEdit: (carrier: Carrier) => void;
  onView: (carrier: Carrier) => void;
}) {
  return (
    <Card className="gap-0">
      <CardHeader className="border-b bg-muted/25 py-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Truck className="size-4 text-primary" />
            Danh mục hãng vận chuyển
          </CardTitle>
          {canManage ? (
            <Button onClick={onCreate} type="button">
              <CirclePlus data-icon="inline-start" />
              Thêm hãng vận chuyển
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {isLoading ? (
          <TableSkeleton columns={4} />
        ) : (
          <Table scrollable>
            <TableHeader>
              <TableRow>
                <TableHead>Mã hãng</TableHead>
                <TableHead>Hãng vận chuyển</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {carriers.length === 0 ? (
                <EmptyRow colSpan={4} label="Chưa có hãng vận chuyển." />
              ) : (
                carriers.map((carrier) => (
                  <TableRow key={carrier.id}>
                    <TableCell className="font-mono font-semibold">
                      {carrier.code}
                    </TableCell>
                    <TableCell>{carrier.name}</TableCell>
                    <TableCell>
                      <StatusBadge tone={statusTone(carrier.status)}>
                        {carrierStatusLabels[carrier.status]}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          onClick={() => onView(carrier)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          <Eye data-icon="inline-start" />
                          Xem chi tiết
                        </Button>
                        {canManage ? (
                          <Button
                            onClick={() => onEdit(carrier)}
                            size="sm"
                            type="button"
                            variant="ghost"
                          >
                            <Pencil data-icon="inline-start" />
                            Sửa
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
function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <TableRow>
      <TableCell
        className="h-24 text-center text-sm text-muted-foreground"
        colSpan={colSpan}
      >
        {label}
      </TableCell>
    </TableRow>
  );
}

function InfoRow({
  label,
  mono = false,
  value,
}: {
  label: string;
  mono?: boolean;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/15 px-3 py-2.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-1 break-words text-sm font-medium",
          mono && "font-mono",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function FormField({
  disabled,
  id,
  label,
  onChange,
  type = "text",
  value,
}: {
  disabled?: boolean;
  id: string;
  label: string;
  onChange: (value: string) => void;
  type?: string;
  value: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        disabled={disabled}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
    </div>
  );
}
