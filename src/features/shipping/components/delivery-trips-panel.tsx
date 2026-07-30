"use client";

import { useMemo, useState } from "react";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  LoaderCircle,
  MapPinned,
  PackageCheck,
  Play,
  Plus,
  Route,
  ScanLine,
  Sparkles,
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
import { Checkbox } from "@/components/ui/checkbox";
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
  StatusBadge,
  TableSkeleton,
} from "@/features/admin-shell/components/operations-ui";
import { listWmsUsers } from "@/features/staff/services/staff.service";
import { useSessionUser } from "@/hooks/use-session-user";
import { getApiErrorMessage } from "@/lib/api-contract";
import { businessCodeLabel } from "@/lib/wms-ui-labels";

import {
  createDeliveryTrip,
  DELIVERY_TRIP_STATUSES,
  getDeliveryTrip,
  listDeliveryTrips,
  markDeliveryTripReady,
  optimizeDeliveryTripRoute,
  scanDeliveryTripPackage,
  startDeliveryTrip,
  updateDeliveryTripRoute,
  type DeliveryTrip,
  type DeliveryTripStatus,
} from "../services/delivery-trip.service";
import {
  getShipment,
  listShipments,
  type Shipment,
} from "../services/shipping.service";

const PAGE_SIZE = 20;

const tripStatusLabels: Record<DeliveryTripStatus, string> = {
  AWAITING_SETTLEMENT: "Chờ đối soát COD",
  CANCELLED: "Đã hủy",
  COMPLETED: "Hoàn tất",
  DRAFT: "Đang lập chuyến",
  IN_TRANSIT: "Đang giao",
  LOADING: "Đang chất kiện",
  PAUSED: "Tạm dừng do sự cố",
  READY: "Chờ chất kiện",
};

function tripStatusTone(status: DeliveryTripStatus) {
  if (status === "COMPLETED") return "success" as const;
  if (status === "CANCELLED") return "danger" as const;
  if (status === "DRAFT" || status === "READY") return "warning" as const;
  return "info" as const;
}

function formatAddress(shipment?: Shipment) {
  if (!shipment) return "Đang tải địa chỉ...";
  const values = Object.values(shipment.recipient.address).filter(
    (value): value is string =>
      typeof value === "string" && value.trim().length > 0,
  );
  return values.join(", ") || "Chưa có địa chỉ";
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

export function DeliveryTripsPanel() {
  const user = useSessionUser();
  const queryClient = useQueryClient();
  const canManage =
    user?.roles.includes("ADMIN") || user?.roles.includes("MANAGER") || false;
  const isShipper = user?.roles.includes("SHIPPER") ?? false;
  const [status, setStatus] = useState<DeliveryTripStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [selectedTripId, setSelectedTripId] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedShipperId, setSelectedShipperId] = useState("");
  const [selectedShipmentIds, setSelectedShipmentIds] = useState<string[]>([]);
  const [packageBarcode, setPackageBarcode] = useState("");

  const tripsQuery = useQuery({
    queryFn: () => listDeliveryTrips({ limit: PAGE_SIZE, page, status }),
    queryKey: ["delivery-trips", "list", page, status],
  });
  const trips = tripsQuery.data?.data ?? [];
  const selectedListTrip = trips.find((trip) => trip.id === selectedTripId);
  const tripQuery = useQuery({
    enabled: Boolean(selectedTripId),
    queryFn: () => getDeliveryTrip(selectedTripId),
    queryKey: ["delivery-trips", "detail", selectedTripId],
  });
  const selectedTrip = tripQuery.data ?? selectedListTrip;

  const shippersQuery = useQuery({
    enabled: canManage,
    queryFn: () => listWmsUsers({ role: "SHIPPER", status: "ACTIVE" }),
    queryKey: ["staff", "shipper-options"],
  });
  const shippers = useMemo(
    () => shippersQuery.data?.data ?? [],
    [shippersQuery.data],
  );
  const shipperNameById = useMemo(
    () =>
      new Map(
        shippers.map((shipper) => [
          shipper.id,
          shipper.name || shipper.username,
        ]),
      ),
    [shippers],
  );

  const readyShipmentsQuery = useQuery({
    enabled: canManage && createOpen,
    queryFn: () =>
      listShipments({ limit: 100, page: 1, shipmentStatus: "READY" }),
    queryKey: ["shipping", "ready-for-trip"],
  });
  const eligibleShipments = (readyShipmentsQuery.data?.data ?? []).filter(
    (shipment) =>
      !shipment.activeTripId &&
      shipment.assignedShipperId === selectedShipperId,
  );

  const orderedStops = useMemo(
    () =>
      [...(selectedTrip?.stops ?? [])].sort(
        (left, right) => left.routeOrder - right.routeOrder,
      ),
    [selectedTrip?.stops],
  );
  const stopShipmentQueries = useQueries({
    queries: orderedStops.map((stop) => ({
      enabled: Boolean(selectedTripId),
      queryFn: () => getShipment(stop.shipmentId),
      queryKey: ["shipping", "shipment", stop.shipmentId],
    })),
  });
  const stopShipments = stopShipmentQueries
    .map((query) => query.data)
    .filter((shipment): shipment is Shipment => Boolean(shipment));
  const packageProgress = useMemo(() => {
    const packages = stopShipments.flatMap((shipment) => shipment.packages);
    return {
      loaded: packages.filter(
        (packageInfo) => packageInfo.loadedTripId === selectedTripId,
      ).length,
      total: packages.length,
    };
  }, [selectedTripId, stopShipments]);
  const allStopsLoaded =
    orderedStops.length > 0 &&
    stopShipments.length === orderedStops.length &&
    packageProgress.total > 0 &&
    packageProgress.loaded === packageProgress.total;
  const isOwnerShipper =
    isShipper &&
    Boolean(user?.id) &&
    selectedTrip?.assignedShipperId === user?.id;

  function cacheTrip(trip: DeliveryTrip) {
    queryClient.setQueryData(["delivery-trips", "detail", trip.id], trip);
  }

  async function refreshTrips() {
    await queryClient.invalidateQueries({ queryKey: ["delivery-trips"] });
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createDeliveryTrip({
        assignedShipperId: selectedShipperId,
        shipmentIds: selectedShipmentIds,
      }),
    onError: (error) =>
      toast.error(getApiErrorMessage(error) ?? "Không thể tạo chuyến giao."),
    onSuccess: async (trip) => {
      cacheTrip(trip);
      setSelectedTripId(trip.id);
      setCreateOpen(false);
      setSelectedShipperId("");
      setSelectedShipmentIds([]);
      toast.success("Đã tạo chuyến giao ở trạng thái nháp.");
      await Promise.all([
        refreshTrips(),
        queryClient.invalidateQueries({ queryKey: ["shipping", "shipments"] }),
      ]);
    },
  });

  const routeMutation = useMutation({
    mutationFn: (shipmentIds: string[]) =>
      updateDeliveryTripRoute(selectedTripId, shipmentIds),
    onError: (error) =>
      toast.error(getApiErrorMessage(error) ?? "Không thể sắp lại lộ trình."),
    onSuccess: (trip) => {
      cacheTrip(trip);
      toast.success("Đã lưu thứ tự điểm giao.");
    },
  });

  const optimizeMutation = useMutation({
    mutationFn: () => optimizeDeliveryTripRoute(selectedTripId),
    onError: (error) =>
      toast.error(getApiErrorMessage(error) ?? "Không thể tối ưu lộ trình."),
    onSuccess: (trip) => {
      cacheTrip(trip);
      toast.success(
        "Đã tối ưu lộ trình; nếu thiếu tọa độ, WMS giữ nguyên thứ tự.",
      );
    },
  });

  const readyMutation = useMutation({
    mutationFn: () => markDeliveryTripReady(selectedTripId),
    onError: (error) =>
      toast.error(getApiErrorMessage(error) ?? "Không thể chốt chuyến giao."),
    onSuccess: async (trip) => {
      cacheTrip(trip);
      toast.success("Đã chốt chuyến. Shipper có thể quét kiện.");
      await refreshTrips();
    },
  });

  const scanMutation = useMutation({
    mutationFn: () =>
      scanDeliveryTripPackage(selectedTripId, packageBarcode.trim()),
    onError: (error) =>
      toast.error(
        getApiErrorMessage(error) ?? "Không thể chất kiện lên chuyến.",
      ),
    onSuccess: async (trip) => {
      cacheTrip(trip);
      setPackageBarcode("");
      toast.success("Đã quét và chất kiện đúng chuyến.");
      await Promise.all([
        refreshTrips(),
        queryClient.invalidateQueries({ queryKey: ["shipping", "shipment"] }),
      ]);
    },
  });

  const startMutation = useMutation({
    mutationFn: () => startDeliveryTrip(selectedTripId),
    onError: (error) =>
      toast.error(
        getApiErrorMessage(error) ??
          "Chưa thể bắt đầu chuyến. Kiểm tra lại các kiện đã quét.",
      ),
    onSuccess: async (trip) => {
      cacheTrip(trip);
      toast.success("Đã bắt đầu chuyến giao.");
      await Promise.all([
        refreshTrips(),
        queryClient.invalidateQueries({ queryKey: ["shipping", "shipments"] }),
      ]);
    },
  });

  function toggleShipment(shipmentId: string, checked: boolean) {
    setSelectedShipmentIds((current) =>
      checked
        ? [...current, shipmentId]
        : current.filter((id) => id !== shipmentId),
    );
  }

  function moveStop(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= orderedStops.length) return;
    const shipmentIds = orderedStops.map((stop) => stop.shipmentId);
    [shipmentIds[index], shipmentIds[targetIndex]] = [
      shipmentIds[targetIndex],
      shipmentIds[index],
    ];
    routeMutation.mutate(shipmentIds);
  }

  const total = tripsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      {tripsQuery.error ? <ErrorBanner error={tripsQuery.error} /> : null}
      <Card>
        <CardHeader className="border-b bg-muted/20">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Route className="size-4 text-primary" />
                Chuyến giao nội bộ
              </CardTitle>
              <CardDescription className="mt-1">
                {total} bản ghi · trang {page}/{totalPages}
              </CardDescription>
            </div>
            {canManage ? (
              <Button onClick={() => setCreateOpen(true)} type="button">
                <Plus data-icon="inline-start" />
                Tạo chuyến giao
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="max-w-64 space-y-2">
            <Label>Trạng thái</Label>
            <Select
              onValueChange={(value) => {
                setStatus(value as DeliveryTripStatus | "ALL");
                setPage(1);
              }}
              value={status}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tất cả</SelectItem>
                {DELIVERY_TRIP_STATUSES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {tripStatusLabels[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {tripsQuery.isLoading ? (
            <TableSkeleton columns={5} />
          ) : (
            <Table scrollable>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã chuyến</TableHead>
                  <TableHead>Shipper</TableHead>
                  <TableHead>Số điểm giao</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trips.length === 0 ? (
                  <EmptyRow colSpan={5} text="Chưa có chuyến giao." />
                ) : (
                  trips.map((trip) => (
                    <TableRow
                      className="cursor-pointer"
                      key={trip.id}
                      onClick={() => setSelectedTripId(trip.id)}
                    >
                      <TableCell className="font-mono font-semibold">
                        {businessCodeLabel(trip.tripNumber)}
                      </TableCell>
                      <TableCell>
                        {trip.assignedShipperId === user?.id
                          ? "Bạn"
                          : (shipperNameById.get(trip.assignedShipperId) ??
                            trip.assignedShipperId)}
                      </TableCell>
                      <TableCell>{trip.stops.length}</TableCell>
                      <TableCell>
                        <StatusBadge tone={tripStatusTone(trip.status)}>
                          {tripStatusLabels[trip.status]}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedTripId(trip.id);
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
          onClick={() => setPage((current) => current - 1)}
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
          onClick={() => setPage((current) => current + 1)}
          type="button"
          variant="outline"
        >
          Trang sau
        </Button>
      </div>

      <EntityDetailDialog
        description={`Mã chuyến: ${businessCodeLabel(selectedTrip?.tripNumber)}`}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTripId("");
            setPackageBarcode("");
          }
        }}
        open={Boolean(selectedTripId)}
        title="Chi tiết chuyến giao"
      >
        {tripQuery.isLoading && !selectedTrip ? (
          <TableSkeleton columns={4} />
        ) : null}
        {tripQuery.error ? <ErrorBanner error={tripQuery.error} /> : null}
        {selectedTrip ? (
          <div className="space-y-4">
            <Card>
              <CardHeader className="border-b bg-muted/20">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">
                      {businessCodeLabel(selectedTrip.tripNumber)}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Shipper:{" "}
                      {selectedTrip.assignedShipperId === user?.id
                        ? "Bạn"
                        : (shipperNameById.get(
                            selectedTrip.assignedShipperId,
                          ) ?? selectedTrip.assignedShipperId)}
                    </CardDescription>
                  </div>
                  <StatusBadge tone={tripStatusTone(selectedTrip.status)}>
                    {tripStatusLabels[selectedTrip.status]}
                  </StatusBadge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">
                      Tiến độ chất kiện
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {packageProgress.loaded}/{packageProgress.total} kiện đã
                      quét
                    </div>
                  </div>
                  <Badge variant={allStopsLoaded ? "default" : "outline"}>
                    {allStopsLoaded ? "Đã đủ kiện" : "Chưa đủ kiện"}
                  </Badge>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{
                      width: `${
                        packageProgress.total
                          ? (packageProgress.loaded / packageProgress.total) *
                            100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b bg-muted/20">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MapPinned className="size-4 text-primary" />
                    Thứ tự điểm giao
                  </CardTitle>
                  {canManage && selectedTrip.status === "DRAFT" ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        disabled={optimizeMutation.isPending}
                        onClick={() => optimizeMutation.mutate()}
                        type="button"
                        variant="outline"
                      >
                        <Sparkles data-icon="inline-start" />
                        Tối ưu lộ trình
                      </Button>
                      <Button
                        disabled={readyMutation.isPending}
                        onClick={() => readyMutation.mutate()}
                        type="button"
                      >
                        <PackageCheck data-icon="inline-start" />
                        Chốt chuyến
                      </Button>
                    </div>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <Table scrollable>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Thứ tự</TableHead>
                      <TableHead>Vận đơn / đơn hàng</TableHead>
                      <TableHead>Địa chỉ snapshot</TableHead>
                      <TableHead>Số kiện</TableHead>
                      {canManage && selectedTrip.status === "DRAFT" ? (
                        <TableHead className="text-right">Sắp xếp</TableHead>
                      ) : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderedStops.map((stop, index) => {
                      const shipment = stopShipmentQueries[index]?.data;
                      const loadedCount =
                        shipment?.packages.filter(
                          (packageInfo) =>
                            packageInfo.loadedTripId === selectedTrip.id,
                        ).length ?? 0;
                      return (
                        <TableRow key={stop.shipmentId}>
                          <TableCell>
                            <Badge variant="outline">{index + 1}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="font-mono font-semibold">
                              {businessCodeLabel(shipment?.shipmentNumber)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {businessCodeLabel(shipment?.orderCode)}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-sm whitespace-normal">
                            {formatAddress(shipment)}
                          </TableCell>
                          <TableCell>
                            {loadedCount}/{shipment?.packages.length ?? 0}
                          </TableCell>
                          {canManage && selectedTrip.status === "DRAFT" ? (
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  aria-label={`Đưa điểm ${index + 1} lên`}
                                  disabled={
                                    index === 0 || routeMutation.isPending
                                  }
                                  onClick={() => moveStop(index, -1)}
                                  size="icon-sm"
                                  type="button"
                                  variant="outline"
                                >
                                  <ArrowUp />
                                </Button>
                                <Button
                                  aria-label={`Đưa điểm ${index + 1} xuống`}
                                  disabled={
                                    index === orderedStops.length - 1 ||
                                    routeMutation.isPending
                                  }
                                  onClick={() => moveStop(index, 1)}
                                  size="icon-sm"
                                  type="button"
                                  variant="outline"
                                >
                                  <ArrowDown />
                                </Button>
                              </div>
                            </TableCell>
                          ) : null}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {isOwnerShipper &&
            ["READY", "LOADING"].includes(selectedTrip.status) ? (
              <Card>
                <CardHeader className="border-b bg-muted/20">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ScanLine className="size-4 text-primary" />
                    Chất kiện lên chuyến
                  </CardTitle>
                  <CardDescription>
                    Quét lần lượt barcode trên mọi kiện trước khi khởi hành.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <form
                    className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (packageBarcode.trim()) scanMutation.mutate();
                    }}
                  >
                    <div className="space-y-2">
                      <Label htmlFor="trip-package-barcode">
                        Barcode kiện hàng
                      </Label>
                      <Input
                        autoComplete="off"
                        autoFocus
                        id="trip-package-barcode"
                        onChange={(event) =>
                          setPackageBarcode(event.target.value)
                        }
                        placeholder="Quét hoặc nhập PKG-..."
                        value={packageBarcode}
                      />
                    </div>
                    <Button
                      className="self-end"
                      disabled={
                        scanMutation.isPending || !packageBarcode.trim()
                      }
                      type="submit"
                    >
                      {scanMutation.isPending ? (
                        <LoaderCircle
                          className="animate-spin"
                          data-icon="inline-start"
                        />
                      ) : (
                        <ScanLine data-icon="inline-start" />
                      )}
                      Xác nhận kiện
                    </Button>
                  </form>
                  <Button
                    className="w-full"
                    disabled={!allStopsLoaded || startMutation.isPending}
                    onClick={() => startMutation.mutate()}
                    type="button"
                  >
                    {startMutation.isPending ? (
                      <LoaderCircle
                        className="animate-spin"
                        data-icon="inline-start"
                      />
                    ) : (
                      <Play data-icon="inline-start" />
                    )}
                    Bắt đầu chuyến giao
                  </Button>
                  {!allStopsLoaded ? (
                    <p className="text-center text-xs text-muted-foreground">
                      Nút khởi hành chỉ mở khi tất cả kiện trong chuyến đã được
                      quét.
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}
          </div>
        ) : null}
      </EntityDetailDialog>

      <Dialog
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setSelectedShipperId("");
            setSelectedShipmentIds([]);
          }
        }}
        open={createOpen}
      >
        <DialogContent size="xl">
          <DialogHeader>
            <DialogTitle>Tạo chuyến giao</DialogTitle>
            <DialogDescription>
              Chọn Shipper rồi chọn các vận đơn READY của đúng người đó. Thứ tự
              chọn là thứ tự giao ban đầu.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Shipper phụ trách</Label>
              <Select
                onValueChange={(value) => {
                  setSelectedShipperId(value);
                  setSelectedShipmentIds([]);
                }}
                value={selectedShipperId}
              >
                <SelectTrigger aria-label="Shipper phụ trách">
                  <SelectValue placeholder="Chọn Shipper" />
                </SelectTrigger>
                <SelectContent>
                  {shippers.map((shipper) => (
                    <SelectItem key={shipper.id} value={shipper.id}>
                      {shipper.name || shipper.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {readyShipmentsQuery.error ? (
              <ErrorBanner error={readyShipmentsQuery.error} />
            ) : null}
            <Table scrollable containerClassName="max-h-[50dvh]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Chọn</TableHead>
                  <TableHead>Thứ tự</TableHead>
                  <TableHead>Mã vận đơn</TableHead>
                  <TableHead>Đơn hàng</TableHead>
                  <TableHead>Địa chỉ snapshot</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!selectedShipperId ? (
                  <EmptyRow colSpan={5} text="Chọn Shipper trước." />
                ) : eligibleShipments.length === 0 ? (
                  <EmptyRow
                    colSpan={5}
                    text="Shipper này chưa có vận đơn READY chưa xếp chuyến."
                  />
                ) : (
                  eligibleShipments.map((shipment) => {
                    const selectedIndex = selectedShipmentIds.indexOf(
                      shipment.id,
                    );
                    return (
                      <TableRow key={shipment.id}>
                        <TableCell>
                          <Checkbox
                            aria-label={`Chọn ${businessCodeLabel(
                              shipment.shipmentNumber,
                            )}`}
                            checked={selectedIndex >= 0}
                            onCheckedChange={(checked) =>
                              toggleShipment(shipment.id, checked === true)
                            }
                          />
                        </TableCell>
                        <TableCell>
                          {selectedIndex >= 0 ? selectedIndex + 1 : "—"}
                        </TableCell>
                        <TableCell className="font-mono font-semibold">
                          {businessCodeLabel(shipment.shipmentNumber)}
                        </TableCell>
                        <TableCell>
                          {businessCodeLabel(shipment.orderCode)}
                        </TableCell>
                        <TableCell className="max-w-sm whitespace-normal">
                          {formatAddress(shipment)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button
              disabled={
                createMutation.isPending ||
                !selectedShipperId ||
                selectedShipmentIds.length === 0
              }
              onClick={() => createMutation.mutate()}
              type="button"
            >
              {createMutation.isPending ? (
                <LoaderCircle
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : (
                <Route data-icon="inline-start" />
              )}
              Tạo chuyến ({selectedShipmentIds.length} điểm)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
