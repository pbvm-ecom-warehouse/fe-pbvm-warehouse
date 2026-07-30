"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Banknote,
  Camera,
  CheckCircle2,
  CircleX,
  KeyRound,
  LoaderCircle,
  PackageCheck,
  RotateCcw,
  ScanLine,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

import { EvidenceImagePicker } from "@/components/evidence-images";
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
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/features/admin-shell/components/operations-ui";
import { getApiErrorMessage } from "@/lib/api-contract";
import { businessCodeLabel, statusTone } from "@/lib/wms-ui-labels";
import type { WmsUserResponse } from "@/types/api";

import {
  completeReturnHandoff,
  DELIVERY_INCIDENT_RESOLUTION_ACTIONS,
  DELIVERY_INCIDENT_TYPES,
  deliverTripShipment,
  listDeliveryIncidents,
  recordFailedDeliveryAttempt,
  reportDeliveryIncident,
  requestDeliveryOtp,
  resolveDeliveryIncident,
  scanReturnPackage,
  settleDeliveryTripCash,
  type CodCollectionMethod,
  type DeliveryIncident,
  type DeliveryIncidentResolutionAction,
  type DeliveryIncidentType,
  type DeliveryOtpResponse,
  type DeliveryTrip,
} from "../services/delivery-trip.service";
import type { Shipment } from "../services/shipping.service";

const incidentTypeLabels: Record<DeliveryIncidentType, string> = {
  ACCIDENT: "Tai nạn",
  OTHER: "Sự cố khác",
  PACKAGE_DAMAGE: "Kiện hàng hư hỏng",
  VEHICLE_BREAKDOWN: "Hỏng xe",
};

const resolutionLabels: Record<DeliveryIncidentResolutionAction, string> = {
  RESCUE: "Điều Shipper cứu hộ",
  RESUME: "Tiếp tục chuyến",
  RETURN_TO_WAREHOUSE: "Đưa hàng về kho",
};

const shipmentStatusLabels: Record<string, string> = {
  DELIVERED: "Đã giao",
  FAILED: "Giao chưa thành công",
  IN_TRANSIT: "Đang giao",
  RETURNED: "Đã bàn giao về kho",
  RETURNING: "Đang hoàn về kho",
};

function mutationError(error: unknown, fallback: string) {
  return getApiErrorMessage(error) ?? fallback;
}

function isCodCollectible(shipment?: Shipment) {
  return shipment?.paymentMethod === "COD" && (shipment?.codAmount ?? 0) > 0;
}

export function LastMileDeliverySection({
  canManage,
  isOwnerShipper,
  shippers,
  shipments,
  trip,
}: {
  canManage: boolean;
  isOwnerShipper: boolean;
  shippers: WmsUserResponse[];
  shipments: Shipment[];
  trip: DeliveryTrip;
}) {
  const queryClient = useQueryClient();
  const [deliveryShipmentId, setDeliveryShipmentId] = useState("");
  const [failedShipmentId, setFailedShipmentId] = useState("");
  const [returnShipmentId, setReturnShipmentId] = useState("");
  const [otpInfo, setOtpInfo] = useState<DeliveryOtpResponse>();
  const [clock, setClock] = useState(() => Date.now());
  const [otp, setOtp] = useState("");
  const [codMethod, setCodMethod] = useState<CodCollectionMethod | undefined>();
  const [podImages, setPodImages] = useState<File[]>([]);
  const [failureReason, setFailureReason] = useState("");
  const [returnBarcode, setReturnBarcode] = useState("");
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [incidentType, setIncidentType] =
    useState<DeliveryIncidentType>("VEHICLE_BREAKDOWN");
  const [incidentShipmentId, setIncidentShipmentId] = useState("TRIP");
  const [incidentDescription, setIncidentDescription] = useState("");
  const [resolvingIncident, setResolvingIncident] =
    useState<DeliveryIncident>();
  const [resolutionAction, setResolutionAction] =
    useState<DeliveryIncidentResolutionAction>("RESUME");
  const [resolutionNote, setResolutionNote] = useState("");
  const [rescueShipperId, setRescueShipperId] = useState("");
  const [settlementAmount, setSettlementAmount] = useState("");

  const deliveryShipment = shipments.find(
    (shipment) => shipment.id === deliveryShipmentId,
  );
  const failedShipment = shipments.find(
    (shipment) => shipment.id === failedShipmentId,
  );
  const returnShipment = shipments.find(
    (shipment) => shipment.id === returnShipmentId,
  );
  const outstandingCash = Math.max(
    0,
    (trip.cashCollectedAmount ?? 0) - (trip.cashSettledAmount ?? 0),
  );
  const incidentsQuery = useQuery({
    queryFn: () => listDeliveryIncidents(trip.id),
    queryKey: ["delivery-trips", "incidents", trip.id],
  });
  const incidents = incidentsQuery.data ?? [];

  useEffect(() => {
    if (!otpInfo) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [otpInfo]);

  function cacheTrip(updatedTrip: DeliveryTrip) {
    queryClient.setQueryData(
      ["delivery-trips", "detail", updatedTrip.id],
      updatedTrip,
    );
  }

  async function refreshOperationalData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["delivery-trips"] }),
      queryClient.invalidateQueries({ queryKey: ["shipping", "shipment"] }),
      queryClient.invalidateQueries({ queryKey: ["shipping", "shipments"] }),
    ]);
  }

  function resetDeliveryDialog() {
    setDeliveryShipmentId("");
    setOtpInfo(undefined);
    setOtp("");
    setCodMethod(undefined);
    setPodImages([]);
  }

  const otpMutation = useMutation({
    mutationFn: () => requestDeliveryOtp(trip.id, deliveryShipmentId),
    onError: (error) =>
      toast.error(mutationError(error, "Không thể gửi OTP giao hàng.")),
    onSuccess: (info) => {
      setOtpInfo(info);
      setClock(Date.now());
      toast.success("OTP đã được gửi qua kênh thông báo đến khách hàng.");
    },
  });

  const deliverMutation = useMutation({
    mutationFn: () =>
      deliverTripShipment(trip.id, deliveryShipmentId, {
        codCollectionMethod: codMethod,
        images: podImages,
        otp,
      }),
    onError: (error) =>
      toast.error(
        mutationError(error, "Không thể xác nhận hoàn tất điểm giao."),
      ),
    onSuccess: async (updatedTrip) => {
      cacheTrip(updatedTrip);
      resetDeliveryDialog();
      toast.success("Đã xác minh OTP, lưu POD và hoàn tất điểm giao.");
      await refreshOperationalData();
    },
  });

  const failMutation = useMutation({
    mutationFn: () =>
      recordFailedDeliveryAttempt(
        trip.id,
        failedShipmentId,
        failureReason.trim(),
      ),
    onError: (error) =>
      toast.error(
        mutationError(error, "Không thể ghi nhận lần giao thất bại."),
      ),
    onSuccess: async (updatedTrip) => {
      cacheTrip(updatedTrip);
      const movesToReturn = (failedShipment?.attempts ?? 0) + 1 >= 3;
      setFailedShipmentId("");
      setFailureReason("");
      toast.success(
        movesToReturn
          ? "Đã ghi nhận lần thứ 3. Vận đơn chuyển sang hoàn về kho."
          : "Đã ghi nhận lần giao chưa thành công.",
      );
      await refreshOperationalData();
    },
  });

  const returnScanMutation = useMutation({
    mutationFn: () =>
      scanReturnPackage(trip.id, returnShipmentId, returnBarcode.trim()),
    onError: (error) =>
      toast.error(mutationError(error, "Không thể quét kiện hoàn.")),
    onSuccess: async (updatedTrip) => {
      cacheTrip(updatedTrip);
      setReturnBarcode("");
      toast.success("Đã xác nhận kiện hoàn về đúng chuyến.");
      await refreshOperationalData();
    },
  });

  const handoffMutation = useMutation({
    mutationFn: () => completeReturnHandoff(trip.id, returnShipmentId),
    onError: (error) =>
      toast.error(mutationError(error, "Chưa thể bàn giao hàng hoàn về kho.")),
    onSuccess: async (updatedTrip) => {
      cacheTrip(updatedTrip);
      setReturnShipmentId("");
      setReturnBarcode("");
      toast.success(
        "Đã bàn giao đủ kiện; phiếu hoàn đã chuyển cho Receiver kiểm nhận.",
      );
      await refreshOperationalData();
    },
  });

  const reportIncidentMutation = useMutation({
    mutationFn: () =>
      reportDeliveryIncident(trip.id, {
        description: incidentDescription.trim(),
        shipmentId:
          incidentShipmentId === "TRIP" ? undefined : incidentShipmentId,
        type: incidentType,
      }),
    onError: (error) =>
      toast.error(mutationError(error, "Không thể báo sự cố chuyến giao.")),
    onSuccess: async () => {
      setIncidentOpen(false);
      setIncidentType("VEHICLE_BREAKDOWN");
      setIncidentShipmentId("TRIP");
      setIncidentDescription("");
      toast.success("Đã báo sự cố và tạm dừng chuyến để Manager xử lý.");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["delivery-trips", "incidents", trip.id],
        }),
        refreshOperationalData(),
      ]);
    },
  });

  const resolveIncidentMutation = useMutation({
    mutationFn: () =>
      resolveDeliveryIncident(trip.id, resolvingIncident!.id, {
        action: resolutionAction,
        note: resolutionNote.trim() || undefined,
        rescueShipperId:
          resolutionAction === "RESCUE" ? rescueShipperId : undefined,
      }),
    onError: (error) =>
      toast.error(mutationError(error, "Không thể xử lý sự cố.")),
    onSuccess: async () => {
      setResolvingIncident(undefined);
      setResolutionAction("RESUME");
      setResolutionNote("");
      setRescueShipperId("");
      toast.success("Đã xử lý sự cố và cập nhật chuyến giao.");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["delivery-trips", "incidents", trip.id],
        }),
        refreshOperationalData(),
      ]);
    },
  });

  const settleMutation = useMutation({
    mutationFn: () => settleDeliveryTripCash(trip.id, Number(settlementAmount)),
    onError: (error) =>
      toast.error(mutationError(error, "Không thể đối soát tiền mặt.")),
    onSuccess: async (updatedTrip) => {
      cacheTrip(updatedTrip);
      setSettlementAmount("");
      toast.success("Đã đối soát đủ tiền mặt và hoàn tất chuyến.");
      await refreshOperationalData();
    },
  });

  const otpResendAt = otpInfo
    ? new Date(otpInfo.resendAvailableAt).getTime()
    : 0;
  const canRequestOtp = !otpInfo || clock >= otpResendAt;
  const returnedPackageCount =
    returnShipment?.packages.filter((packageInfo) => packageInfo.returnedAt)
      .length ?? 0;
  const allReturnPackagesScanned =
    Boolean(returnShipment?.packages.length) &&
    returnedPackageCount === returnShipment?.packages.length;

  return (
    <>
      <Card>
        <CardHeader className="border-b bg-muted/20">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="size-4 text-primary" />
                Thực hiện từng điểm giao
              </CardTitle>
              <CardDescription className="mt-1">
                OTP chỉ được gửi cho khách; WMS không hiển thị hoặc lưu mã thô
                trên giao diện.
              </CardDescription>
            </div>
            {isOwnerShipper &&
            ["IN_TRANSIT", "PAUSED"].includes(trip.status) ? (
              <Button
                onClick={() => setIncidentOpen(true)}
                type="button"
                variant="outline"
              >
                <ShieldAlert data-icon="inline-start" />
                Báo sự cố
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <Table scrollable>
            <TableHeader>
              <TableRow>
                <TableHead>Vận đơn / đơn hàng</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Lần giao</TableHead>
                <TableHead>COD</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipments.map((shipment) => (
                <TableRow key={shipment.id}>
                  <TableCell>
                    <div className="font-mono font-semibold">
                      {businessCodeLabel(shipment.shipmentNumber)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {businessCodeLabel(shipment.orderCode)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={statusTone(shipment.shipmentStatus)}>
                      {shipmentStatusLabels[shipment.shipmentStatus] ??
                        shipment.shipmentStatus}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>{shipment.attempts}/3</TableCell>
                  <TableCell>
                    {isCodCollectible(shipment)
                      ? `${shipment.codAmount.toLocaleString("vi-VN")} đ${
                          shipment.codCollectionMethod
                            ? ` · ${
                                shipment.codCollectionMethod === "CASH"
                                  ? "Tiền mặt"
                                  : "QR Ecom"
                              }`
                            : ""
                        }`
                      : "Không thu"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      {isOwnerShipper &&
                      trip.status === "IN_TRANSIT" &&
                      shipment.shipmentStatus === "IN_TRANSIT" ? (
                        <>
                          <Button
                            onClick={() => {
                              setDeliveryShipmentId(shipment.id);
                              setOtpInfo(undefined);
                              setOtp("");
                              setCodMethod(undefined);
                              setPodImages([]);
                            }}
                            size="sm"
                            type="button"
                          >
                            <KeyRound data-icon="inline-start" />
                            Giao hàng
                          </Button>
                          <Button
                            onClick={() => setFailedShipmentId(shipment.id)}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            <CircleX data-icon="inline-start" />
                            Giao thất bại
                          </Button>
                        </>
                      ) : null}
                      {isOwnerShipper &&
                      ["IN_TRANSIT", "PAUSED"].includes(trip.status) &&
                      shipment.shipmentStatus === "RETURNING" ? (
                        <Button
                          onClick={() => setReturnShipmentId(shipment.id)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          <RotateCcw data-icon="inline-start" />
                          Bàn giao hàng hoàn
                        </Button>
                      ) : null}
                      {shipment.shipmentStatus === "DELIVERED" ? (
                        <Badge variant="outline">
                          <Camera className="size-3" />
                          Đã có POD
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="size-4 text-amber-600" />
            Sự cố chuyến giao
          </CardTitle>
          <CardDescription>
            Báo cáo chỉ gồm loại, mô tả và điểm giao liên quan theo contract
            hiện tại; chưa có trường ảnh sự cố.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          {incidentsQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">
              Đang tải lịch sử sự cố...
            </div>
          ) : incidents.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Chuyến chưa có sự cố.
            </div>
          ) : (
            incidents.map((incident) => (
              <div
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3"
                key={incident.id}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold">
                      {incident.incidentNumber}
                    </span>
                    <Badge variant="outline">
                      {incidentTypeLabels[incident.type]}
                    </Badge>
                    <StatusBadge
                      tone={
                        incident.status === "RESOLVED" ? "success" : "warning"
                      }
                    >
                      {incident.status === "RESOLVED"
                        ? "Đã xử lý"
                        : "Đang chờ xử lý"}
                    </StatusBadge>
                  </div>
                  <p className="mt-2 text-sm">{incident.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(incident.reportedAt).toLocaleString("vi-VN")}
                    {incident.shipmentId
                      ? ` · Điểm ${businessCodeLabel(
                          shipments.find(
                            (shipment) => shipment.id === incident.shipmentId,
                          )?.shipmentNumber,
                        )}`
                      : " · Toàn chuyến"}
                  </p>
                  {incident.resolutionAction ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Xử lý: {resolutionLabels[incident.resolutionAction]}
                      {incident.resolutionNote
                        ? ` · ${incident.resolutionNote}`
                        : ""}
                    </p>
                  ) : null}
                </div>
                {canManage && incident.status === "OPEN" ? (
                  <Button
                    onClick={() => {
                      setResolvingIncident(incident);
                      setResolutionAction("RESUME");
                      setResolutionNote("");
                      setRescueShipperId("");
                    }}
                    size="sm"
                    type="button"
                  >
                    Xử lý sự cố
                  </Button>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {canManage && trip.status === "AWAITING_SETTLEMENT" ? (
        <Card>
          <CardHeader className="border-b bg-amber-50">
            <CardTitle className="flex items-center gap-2 text-base">
              <Banknote className="size-4 text-amber-700" />
              Đối soát tiền mặt
            </CardTitle>
            <CardDescription>
              Phải nhập đúng số còn phải nộp:{" "}
              {outstandingCash.toLocaleString("vi-VN")} đ.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 pt-4 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="space-y-2">
              <Label htmlFor="trip-settlement-amount">
                Số tiền nhận bàn giao
              </Label>
              <Input
                id="trip-settlement-amount"
                min={0}
                onChange={(event) => setSettlementAmount(event.target.value)}
                placeholder={String(outstandingCash)}
                type="number"
                value={settlementAmount}
              />
            </div>
            <Button
              className="self-end"
              disabled={
                settleMutation.isPending ||
                Number(settlementAmount) !== outstandingCash
              }
              onClick={() => settleMutation.mutate()}
              type="button"
            >
              {settleMutation.isPending ? (
                <LoaderCircle
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : (
                <Banknote data-icon="inline-start" />
              )}
              Xác nhận đối soát
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Dialog
        onOpenChange={(open) => {
          if (!open) resetDeliveryDialog();
        }}
        open={Boolean(deliveryShipmentId)}
      >
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Xác nhận giao hàng</DialogTitle>
            <DialogDescription>
              {businessCodeLabel(deliveryShipment?.shipmentNumber)} · gửi OTP
              cho khách, nhập mã khách đọc và chụp ít nhất một ảnh POD.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">
                    OTP xác minh người nhận
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {otpInfo
                      ? `Hết hạn ${new Date(
                          otpInfo.expiresAt,
                        ).toLocaleTimeString("vi-VN")}; gửi lại từ ${new Date(
                          otpInfo.resendAvailableAt,
                        ).toLocaleTimeString("vi-VN")}.`
                      : "Mã được gửi qua notification; response không trả OTP."}
                  </div>
                </div>
                <Button
                  disabled={otpMutation.isPending || !canRequestOtp}
                  onClick={() => otpMutation.mutate()}
                  type="button"
                  variant="outline"
                >
                  {otpMutation.isPending ? (
                    <LoaderCircle
                      className="animate-spin"
                      data-icon="inline-start"
                    />
                  ) : (
                    <KeyRound data-icon="inline-start" />
                  )}
                  {otpInfo ? "Gửi lại OTP" : "Gửi OTP"}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="delivery-otp">OTP khách cung cấp</Label>
              <Input
                autoComplete="one-time-code"
                id="delivery-otp"
                inputMode="numeric"
                maxLength={6}
                onChange={(event) =>
                  setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="6 chữ số"
                value={otp}
              />
            </div>
            {isCodCollectible(deliveryShipment) ? (
              <div className="space-y-2">
                <Label>Phương thức thu COD</Label>
                <Select
                  onValueChange={(value) =>
                    setCodMethod(value as CodCollectionMethod)
                  }
                  value={codMethod}
                >
                  <SelectTrigger aria-label="Phương thức thu COD">
                    <SelectValue placeholder="Chọn phương thức" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Tiền mặt</SelectItem>
                    <SelectItem value="ECOM_QR">QR của Ecommerce</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Cần thu {deliveryShipment!.codAmount.toLocaleString("vi-VN")}{" "}
                  đ. WMS chỉ ghi phương thức/kết quả, không hiển thị giao dịch
                  thanh toán.
                </p>
              </div>
            ) : null}
            <EvidenceImagePicker
              files={podImages}
              id="delivery-pod-images"
              label="Ảnh bằng chứng giao hàng (POD)"
              onChange={setPodImages}
            />
          </div>
          <DialogFooter>
            <Button
              disabled={
                deliverMutation.isPending ||
                !/^\d{6}$/.test(otp) ||
                podImages.length === 0 ||
                (isCodCollectible(deliveryShipment) && !codMethod)
              }
              onClick={() => deliverMutation.mutate()}
              type="button"
            >
              {deliverMutation.isPending ? (
                <LoaderCircle
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : (
                <PackageCheck data-icon="inline-start" />
              )}
              Xác nhận giao thành công
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setFailedShipmentId("");
            setFailureReason("");
          }
        }}
        open={Boolean(failedShipmentId)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ghi nhận giao thất bại</DialogTitle>
            <DialogDescription>
              Đây là lần {(failedShipment?.attempts ?? 0) + 1}/3. Sau lần thứ 3,
              vận đơn tự chuyển sang hoàn về kho.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delivery-failure-reason">Lý do</Label>
            <Textarea
              id="delivery-failure-reason"
              onChange={(event) => setFailureReason(event.target.value)}
              placeholder="Ví dụ: Khách không nghe máy"
              value={failureReason}
            />
          </div>
          <DialogFooter>
            <Button
              disabled={
                failMutation.isPending || failureReason.trim().length < 3
              }
              onClick={() => failMutation.mutate()}
              type="button"
              variant="destructive"
            >
              Ghi nhận lần giao
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setReturnShipmentId("");
            setReturnBarcode("");
          }
        }}
        open={Boolean(returnShipmentId)}
      >
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Bàn giao hàng hoàn về kho</DialogTitle>
            <DialogDescription>
              Quét đủ barcode kiện của vận đơn trước khi bàn giao cho Receiver.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/20 p-3 text-sm">
              Đã quét {returnedPackageCount}/
              {returnShipment?.packages.length ?? 0} kiện hoàn.
            </div>
            <form
              className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                if (returnBarcode.trim()) returnScanMutation.mutate();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="return-package-barcode">
                  Barcode kiện hoàn
                </Label>
                <Input
                  autoFocus
                  id="return-package-barcode"
                  onChange={(event) => setReturnBarcode(event.target.value)}
                  placeholder="Quét PKG-..."
                  value={returnBarcode}
                />
              </div>
              <Button
                className="self-end"
                disabled={returnScanMutation.isPending || !returnBarcode.trim()}
                type="submit"
              >
                <ScanLine data-icon="inline-start" />
                Xác nhận kiện
              </Button>
            </form>
          </div>
          <DialogFooter>
            <Button
              disabled={handoffMutation.isPending || !allReturnPackagesScanned}
              onClick={() => handoffMutation.mutate()}
              type="button"
            >
              <RotateCcw data-icon="inline-start" />
              Bàn giao đủ kiện cho Receiver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={setIncidentOpen} open={incidentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Báo sự cố chuyến giao</DialogTitle>
            <DialogDescription>
              Chuyến sẽ tạm dừng để Manager chọn phương án xử lý. Contract hiện
              tại chưa nhận ảnh sự cố.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Loại sự cố</Label>
              <Select
                onValueChange={(value) =>
                  setIncidentType(value as DeliveryIncidentType)
                }
                value={incidentType}
              >
                <SelectTrigger aria-label="Loại sự cố">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DELIVERY_INCIDENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {incidentTypeLabels[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Phạm vi ảnh hưởng</Label>
              <Select
                onValueChange={setIncidentShipmentId}
                value={incidentShipmentId}
              >
                <SelectTrigger aria-label="Phạm vi ảnh hưởng">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TRIP">Toàn chuyến</SelectItem>
                  {shipments.map((shipment) => (
                    <SelectItem key={shipment.id} value={shipment.id}>
                      {businessCodeLabel(shipment.shipmentNumber)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="incident-description">Mô tả</Label>
              <Textarea
                id="incident-description"
                onChange={(event) => setIncidentDescription(event.target.value)}
                value={incidentDescription}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={
                reportIncidentMutation.isPending ||
                incidentDescription.trim().length < 3
              }
              onClick={() => reportIncidentMutation.mutate()}
              type="button"
            >
              Báo sự cố và tạm dừng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open) setResolvingIncident(undefined);
        }}
        open={Boolean(resolvingIncident)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xử lý sự cố</DialogTitle>
            <DialogDescription>
              {resolvingIncident?.incidentNumber} · chọn đúng phương án vận hành
              tiếp theo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Phương án</Label>
              <Select
                onValueChange={(value) => {
                  setResolutionAction(
                    value as DeliveryIncidentResolutionAction,
                  );
                  setRescueShipperId("");
                }}
                value={resolutionAction}
              >
                <SelectTrigger aria-label="Phương án xử lý">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DELIVERY_INCIDENT_RESOLUTION_ACTIONS.map((action) => (
                    <SelectItem key={action} value={action}>
                      {resolutionLabels[action]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {resolutionAction === "RESCUE" ? (
              <div className="space-y-2">
                <Label>Shipper cứu hộ</Label>
                <Select
                  onValueChange={setRescueShipperId}
                  value={rescueShipperId}
                >
                  <SelectTrigger aria-label="Shipper cứu hộ">
                    <SelectValue placeholder="Chọn Shipper" />
                  </SelectTrigger>
                  <SelectContent>
                    {shippers
                      .filter(
                        (shipper) => shipper.id !== trip.assignedShipperId,
                      )
                      .map((shipper) => (
                        <SelectItem key={shipper.id} value={shipper.id}>
                          {shipper.name || shipper.username}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="incident-resolution-note">Ghi chú</Label>
              <Textarea
                id="incident-resolution-note"
                onChange={(event) => setResolutionNote(event.target.value)}
                value={resolutionNote}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={
                resolveIncidentMutation.isPending ||
                (resolutionAction === "RESCUE" && !rescueShipperId)
              }
              onClick={() => resolveIncidentMutation.mutate()}
              type="button"
            >
              Xác nhận xử lý
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
