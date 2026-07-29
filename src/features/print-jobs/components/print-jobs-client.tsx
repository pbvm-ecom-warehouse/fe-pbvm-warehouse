"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Barcode,
  CheckCircle2,
  ClipboardList,
  Eye,
  LoaderCircle,
  Printer,
  RefreshCw,
  Save,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Barcode as InternalBarcode } from "@/components/barcode";
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
import { getApiErrorCode, getApiErrorMessage } from "@/lib/api-contract";
import { hasAnyRole } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import {
  businessCodeLabel,
  printJobLineStatusLabel,
  printJobStageLabel,
  printJobStatusLabel,
  statusTone,
} from "@/lib/wms-ui-labels";
import { useSessionUser } from "@/hooks/use-session-user";

import {
  PageHeader,
  PermissionNotice,
  StatusBadge,
  TableSkeleton,
} from "@/features/admin-shell/components/operations-ui";
import { EntityDetailDialog } from "@/features/admin-shell/components/entity-detail-dialog";
import {
  completePrintJobItem,
  consumePrintJobItem,
  getPrintJob,
  listPrintJobs,
  PRINT_JOB_STATUSES,
  putawayPrintJobItem,
  type PrintJob,
  type PrintJobItem,
  type PrintJobStatus,
} from "../services/print-job.service";
import { WarehouseOperationWorkspace } from "@/features/warehouse-navigation/components/warehouse-operation-workspace";
import { listPutawaySuggestionResult } from "@/features/warehouse-navigation/services/putaway-navigation.service";

const PAGE_SIZE = 20;

const printJobKeys = {
  detail: (printJobId: string) => ["print-jobs", "detail", printJobId] as const,
  list: (params: { page: number; status: PrintJobStatus | "ALL" }) =>
    ["print-jobs", "list", params] as const,
};

const defaultConsumeForm = {
  itemBarcode: "",
  quantity: "1",
  shelfCode: "",
};

const defaultCompleteForm = {
  proofImage: "",
  quantity: "1",
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

export function PrintJobsClient() {
  const user = useSessionUser();
  const queryClient = useQueryClient();
  const canViewPrintJobs = hasAnyRole(user?.roles, [
    "ADMIN",
    "MANAGER",
    "PRINTER",
  ]);
  const canProcessPrintJobs = hasAnyRole(user?.roles, ["ADMIN", "PRINTER"]);
  const [statusFilter, setStatusFilter] = useState<PrintJobStatus | "ALL">(
    "ALL",
  );
  const [page, setPage] = useState(1);
  const [selectedPrintJobId, setSelectedPrintJobId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [consumeForm, setConsumeForm] = useState(defaultConsumeForm);
  const [completeForm, setCompleteForm] = useState(defaultCompleteForm);

  const printJobsQuery = useQuery({
    enabled: canViewPrintJobs,
    queryFn: () =>
      listPrintJobs({
        limit: PAGE_SIZE,
        page,
        status: statusFilter,
      }),
    queryKey: printJobKeys.list({ page, status: statusFilter }),
  });

  const printJobs = useMemo(
    () => printJobsQuery.data?.data ?? [],
    [printJobsQuery.data?.data],
  );
  const selectedPrintJob = printJobs.find(
    (job) => job.id === selectedPrintJobId,
  );
  const activePrintJobId = selectedPrintJobId;
  const total = printJobsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const detailQuery = useQuery({
    enabled: canViewPrintJobs && Boolean(activePrintJobId),
    queryFn: () => getPrintJob(activePrintJobId),
    queryKey: printJobKeys.detail(activePrintJobId),
  });
  const detail = detailQuery.data ?? selectedPrintJob;
  const selectedItem = selectedItemId
    ? detail?.items.find((item) => item.outputItemId === selectedItemId)
    : undefined;
  const putawayRemainingQty = selectedItem?.putawayRemainingQty ?? 0;

  const putawaySuggestionsQuery = useQuery({
    enabled:
      canProcessPrintJobs &&
      detail?.stage === "PRODUCTION" &&
      detail.status === "PUTAWAY_PENDING" &&
      putawayRemainingQty > 0,
    queryFn: () =>
      listPutawaySuggestionResult({
        packageCount: Math.max(1, putawayRemainingQty),
        sku: selectedItem!.sku,
      }),
    queryKey: [
      "print-jobs",
      "putaway-suggestions",
      activePrintJobId,
      selectedItem?.outputItemId ?? "none",
      putawayRemainingQty,
    ],
  });

  const consumeMutation = useMutation({
    mutationFn: () =>
      consumePrintJobItem({
        input: {
          itemBarcode: consumeForm.itemBarcode.trim(),
          quantity: parsePositiveNumber(consumeForm.quantity),
          shelfCode: consumeForm.shelfCode.trim(),
        },
        itemId: selectedItem?.inputItemId ?? "",
        printJobId: activePrintJobId,
      }),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: () => {
      setConsumeForm(defaultConsumeForm);
      void queryClient.invalidateQueries({ queryKey: ["print-jobs"] });
      toast.success("Đã ghi nhận tiêu thụ ly chưa in");
    },
  });

  const completeMutation = useMutation({
    mutationFn: () =>
      completePrintJobItem({
        input: {
          quantity: parsePositiveNumber(completeForm.quantity),
          ...(detail?.stage === "SAMPLE" && completeForm.proofImage.trim()
            ? { proofImage: completeForm.proofImage.trim() }
            : {}),
        },
        itemId: selectedItem?.inputItemId ?? "",
        printJobId: activePrintJobId,
      }),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: () => {
      setCompleteForm(defaultCompleteForm);
      void queryClient.invalidateQueries({ queryKey: ["print-jobs"] });
      toast.success("Đã xác nhận in xong");
    },
  });

  const putawayMutation = useMutation({
    mutationFn: (input: {
      itemBarcode: string;
      cellBarcode: string;
      quantity: number;
      suggestedCellId?: string;
    }) =>
      putawayPrintJobItem({
        input,
        itemId: selectedItem?.inputItemId ?? "",
        printJobId: activePrintJobId,
      }),
    onError: async (error) => {
      const code = getApiErrorCode(error);
      const messages: Partial<Record<string, string>> = {
        PRINT_JOB_ITEM_MISMATCH:
          "Barcode vừa quét không thuộc thành phẩm của dòng in này.",
        PRINT_JOB_PUTAWAY_DIMENSIONS_REQUIRED:
          "Thành phẩm chưa có đủ kích thước để kiểm tra khoang cất.",
        PUTAWAY_CELL_CAPACITY_EXCEEDED:
          "Khoang vừa hết chỗ. Hệ thống đang tải lại gợi ý.",
      };
      toast.error(
        (code && messages[code]) ||
          getApiErrorMessage(error) ||
          "Không thể cất thành phẩm in.",
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["print-jobs"] }),
        queryClient.invalidateQueries({
          queryKey: ["warehouse-operation", "rack-cells"],
        }),
      ]);
    },
    onSuccess: async () => {
      toast.success("Đã cất thành phẩm vào khoang.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["print-jobs"] }),
        queryClient.invalidateQueries({
          queryKey: ["warehouse-operation", "rack-cells"],
        }),
      ]);
    },
  });

  function handleFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
  }

  function handleSelectPrintJob(printJob: PrintJob) {
    setSelectedPrintJobId(printJob.id);
    setSelectedItemId("");
    setConsumeForm(defaultConsumeForm);
    setCompleteForm(defaultCompleteForm);
  }

  function handleSelectItem(item: PrintJobItem) {
    setSelectedItemId(item.outputItemId);
    setConsumeForm({
      itemBarcode: "",
      quantity: String(Math.max(1, item.remainingQty)),
      shelfCode: "",
    });
    setCompleteForm({
      proofImage: "",
      quantity: String(Math.max(1, item.reservedQty || item.quantity)),
    });
  }

  function closePrintJobDetail() {
    setSelectedPrintJobId("");
    setSelectedItemId("");
    setConsumeForm(defaultConsumeForm);
    setCompleteForm(defaultCompleteForm);
  }

  function handleConsume(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedItem || !consumeForm.itemBarcode || !consumeForm.shelfCode) {
      toast.error("Cần quét mã vạch ly chưa in và mã vị trí.");
      return;
    }

    consumeMutation.mutate();
  }

  function handleComplete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedItem) {
      toast.error("Hãy chọn một dòng in cần hoàn tất.");
      return;
    }
    if (detail?.stage === "SAMPLE" && !completeForm.proofImage.trim()) {
      toast.error("Lệnh in mẫu cần đường dẫn ảnh minh chứng.");
      return;
    }

    completeMutation.mutate();
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="In ly"
        actions={
          <Button
            disabled={!canViewPrintJobs}
            onClick={() =>
              void queryClient.invalidateQueries({ queryKey: ["print-jobs"] })
            }
            type="button"
            variant="outline"
          >
            {printJobsQuery.isFetching || detailQuery.isFetching ? (
              <LoaderCircle className="animate-spin" data-icon="inline-start" />
            ) : (
              <RefreshCw data-icon="inline-start" />
            )}
            Làm mới
          </Button>
        }
      />

      {!canViewPrintJobs ? (
        <PermissionNotice>
          Bạn cần quyền phù hợp để xem danh sách in ly.
        </PermissionNotice>
      ) : null}

      {printJobsQuery.error ? (
        <ErrorBanner error={printJobsQuery.error} />
      ) : null}

      <div className="min-w-0">
        <Card>
          <CardHeader className="border-b bg-muted/20">
            <CardTitle className="flex items-center gap-2 text-base">
              <Printer className="size-4 text-primary" />
              Đơn in ly
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
                    setStatusFilter(value as PrintJobStatus | "ALL");
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tất cả</SelectItem>
                    {PRINT_JOB_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {printJobStatusLabel(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="self-end"
                disabled={!canViewPrintJobs}
                type="submit"
              >
                <Search data-icon="inline-start" />
                Lọc
              </Button>
            </form>

            {printJobsQuery.isLoading ? (
              <TableSkeleton columns={7} />
            ) : (
              <PrintJobTable
                printJobs={printJobs}
                selectedId={activePrintJobId}
                onSelect={handleSelectPrintJob}
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
      </div>

      <EntityDetailDialog
        description={`Mã đơn in: ${businessCodeLabel(detail?.printJobNumber)}`}
        onOpenChange={(open) => {
          if (!open) closePrintJobDetail();
        }}
        open={Boolean(selectedPrintJobId)}
        title="Chi tiết đơn in ly"
      >
        {detailQuery.isLoading && !detail ? (
          <TableSkeleton columns={5} />
        ) : null}
        {detailQuery.error ? <ErrorBanner error={detailQuery.error} /> : null}
        {detail ? (
          <div
            className={cn(
              "grid gap-4",
              selectedItem
                ? "xl:grid-cols-[minmax(0,1fr)_420px]"
                : "grid-cols-1",
            )}
          >
            <PrintJobDetail
              detail={detail}
              selectedItemId={selectedItem?.outputItemId ?? ""}
              onSelectItem={handleSelectItem}
            />
            {selectedItem ? (
              <aside className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <ClipboardList className="size-4 text-primary" />
                      Dòng in
                    </CardTitle>
                    <CardDescription>{selectedItem.sku}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <InfoBox
                      label="Giai đoạn"
                      value={printJobStageLabel(detail.stage)}
                    />
                    <InfoBox
                      label="Trạng thái dòng"
                      value={printJobLineStatusLabel(selectedItem.lineStatus)}
                    />
                    <InfoBox
                      label="Số lượng còn xử lý"
                      value={selectedItem.remainingQty.toLocaleString("vi-VN")}
                    />
                    {putawayRemainingQty > 0 ? (
                      <InfoBox
                        label="Còn ở khu chờ cất"
                        value={putawayRemainingQty.toLocaleString("vi-VN")}
                      />
                    ) : null}
                    {selectedItem.outputBarcode ? (
                      <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                        <div className="mb-2 text-xs text-muted-foreground">
                          Mã vạch thành phẩm
                        </div>
                        <InternalBarcode value={selectedItem.outputBarcode} />
                      </div>
                    ) : null}
                    {selectedItem.designFile ? (
                      <InfoBox
                        label="File thiết kế"
                        value={selectedItem.designFile}
                      />
                    ) : null}
                  </CardContent>
                </Card>

                {canProcessPrintJobs &&
                selectedItem.lineStatus === "PENDING" ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Barcode className="size-4 text-primary" />
                        Tiêu thụ ly chưa in
                      </CardTitle>
                      <CardDescription>
                        Quét mã vạch CUP_BLANK, quét mã vị trí và nhập số lượng
                        tiêu thụ.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form className="space-y-3" onSubmit={handleConsume}>
                        <TextField
                          id="print-consume-barcode"
                          label="Mã vạch mặt hàng"
                          value={consumeForm.itemBarcode}
                          onChange={(itemBarcode) =>
                            setConsumeForm((current) => ({
                              ...current,
                              itemBarcode,
                            }))
                          }
                        />
                        <TextField
                          id="print-consume-shelf"
                          label="Mã vị trí"
                          value={consumeForm.shelfCode}
                          onChange={(shelfCode) =>
                            setConsumeForm((current) => ({
                              ...current,
                              shelfCode,
                            }))
                          }
                        />
                        <TextField
                          id="print-consume-qty"
                          label="Số lượng"
                          type="number"
                          value={consumeForm.quantity}
                          onChange={(quantity) =>
                            setConsumeForm((current) => ({
                              ...current,
                              quantity,
                            }))
                          }
                        />
                        <Button
                          className="w-full"
                          disabled={
                            !activePrintJobId ||
                            !selectedItem ||
                            consumeMutation.isPending
                          }
                          type="submit"
                        >
                          {consumeMutation.isPending ? (
                            <LoaderCircle
                              className="animate-spin"
                              data-icon="inline-start"
                            />
                          ) : (
                            <Save data-icon="inline-start" />
                          )}
                          Tiêu thụ ly chưa in
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                ) : null}

                {canProcessPrintJobs &&
                selectedItem.lineStatus === "CONSUMED" ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <CheckCircle2 className="size-4 text-primary" />
                        Xác nhận in xong
                      </CardTitle>
                      <CardDescription>
                        {detail.stage === "SAMPLE"
                          ? "Nhập ảnh minh chứng để gửi bản mẫu về đơn hàng."
                          : "Xác nhận số lượng đã in; thành phẩm sẽ vào khu chờ cất."}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form className="space-y-3" onSubmit={handleComplete}>
                        {detail.stage === "SAMPLE" ? (
                          <TextField
                            id="print-complete-proof"
                            label="Đường dẫn ảnh minh chứng"
                            type="url"
                            value={completeForm.proofImage}
                            onChange={(proofImage) =>
                              setCompleteForm((current) => ({
                                ...current,
                                proofImage,
                              }))
                            }
                          />
                        ) : null}
                        <TextField
                          id="print-complete-qty"
                          label="Số lượng"
                          type="number"
                          value={completeForm.quantity}
                          onChange={(quantity) =>
                            setCompleteForm((current) => ({
                              ...current,
                              quantity,
                            }))
                          }
                        />
                        <Button
                          className="w-full"
                          disabled={
                            !activePrintJobId ||
                            !selectedItem ||
                            completeMutation.isPending
                          }
                          type="submit"
                        >
                          {completeMutation.isPending ? (
                            <LoaderCircle
                              className="animate-spin"
                              data-icon="inline-start"
                            />
                          ) : (
                            <Save data-icon="inline-start" />
                          )}
                          {detail.stage === "SAMPLE"
                            ? "Hoàn tất bản mẫu"
                            : "Đưa thành phẩm vào khu chờ"}
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                ) : null}

                {selectedItem.lineStatus === "COMPLETED" &&
                !(detail.stage === "PRODUCTION" && putawayRemainingQty > 0) ? (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-primary">
                    Dòng này đã hoàn tất.
                  </div>
                ) : null}

                {!canProcessPrintJobs ? (
                  <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm text-muted-foreground">
                    Vai trò hiện tại chỉ xem tiến độ in ly.
                  </div>
                ) : null}
              </aside>
            ) : null}
            {selectedItem &&
            canProcessPrintJobs &&
            detail.stage === "PRODUCTION" &&
            detail.status === "PUTAWAY_PENDING" &&
            putawayRemainingQty > 0 ? (
              <div className="xl:col-span-2">
                <WarehouseOperationWorkspace
                  key={selectedItem.outputItemId}
                  operation="PUTAWAY"
                  pending={putawayMutation.isPending}
                  remainingPackageCount={putawayRemainingQty}
                  sku={selectedItem.sku}
                  suggestions={putawaySuggestionsQuery.data?.suggestions ?? []}
                  suggestionsError={putawaySuggestionsQuery.error}
                  suggestionsLoading={putawaySuggestionsQuery.isLoading}
                  onConfirm={async (input) => {
                    await putawayMutation.mutateAsync({
                      itemBarcode: input.itemBarcode,
                      cellBarcode: input.cellBarcode,
                      quantity: input.quantity,
                      suggestedCellId: input.suggestedCellId,
                    });
                  }}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </EntityDetailDialog>
    </div>
  );
}

function PrintJobTable({
  onSelect,
  printJobs,
  selectedId,
}: {
  onSelect: (printJob: PrintJob) => void;
  printJobs: PrintJob[];
  selectedId: string;
}) {
  return (
    <Table scrollable>
      <TableHeader>
        <TableRow>
          <TableHead>Mã đơn in</TableHead>
          <TableHead>Mã đơn hàng</TableHead>
          <TableHead>Giai đoạn</TableHead>
          <TableHead>Trạng thái</TableHead>
          <TableHead>Số dòng</TableHead>
          <TableHead>Cập nhật</TableHead>
          <TableHead className="text-right">Thao tác</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {printJobs.length === 0 ? (
          <EmptyRow colSpan={7} label="Chưa có đơn in ly cần xử lý." />
        ) : (
          printJobs.map((printJob) => (
            <TableRow
              className={cn(
                "cursor-pointer",
                selectedId === printJob.id && "bg-primary/5",
              )}
              key={printJob.id}
              onClick={() => onSelect(printJob)}
            >
              <TableCell className="font-mono font-semibold">
                {businessCodeLabel(printJob.printJobNumber)}
              </TableCell>
              <TableCell>{businessCodeLabel(printJob.orderCode)}</TableCell>
              <TableCell>{printJobStageLabel(printJob.stage)}</TableCell>
              <TableCell>
                <StatusBadge tone={statusTone(printJob.status)}>
                  {printJobStatusLabel(printJob.status)}
                </StatusBadge>
              </TableCell>
              <TableCell>{printJob.items.length}</TableCell>
              <TableCell>{formatDate(printJob.updatedAt)}</TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(printJob);
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

function PrintJobDetail({
  detail,
  onSelectItem,
  selectedItemId,
}: {
  detail: PrintJob;
  onSelectItem: (item: PrintJobItem) => void;
  selectedItemId: string;
}) {
  return (
    <Card>
      <CardHeader className="border-b bg-muted/20">
        <CardTitle className="text-base">
          Mã đơn hàng: {businessCodeLabel(detail.orderCode)}
        </CardTitle>
        <CardDescription>
          {printJobStageLabel(detail.stage)} ·{" "}
          {printJobStatusLabel(detail.status)}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <Table scrollable>
          <TableHeader>
            <TableRow>
              <TableHead>SKU thành phẩm</TableHead>
              <TableHead>Số lượng</TableHead>
              <TableHead>Đã giữ</TableHead>
              <TableHead>Còn lại</TableHead>
              <TableHead>Trạng thái</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {detail.items.length === 0 ? (
              <EmptyRow colSpan={5} label="Đơn in chưa có dòng." />
            ) : (
              detail.items.map((item) => (
                <TableRow
                  className={cn(
                    "cursor-pointer",
                    selectedItemId === item.outputItemId && "bg-primary/5",
                  )}
                  key={`${item.inputItemId}-${item.outputItemId}`}
                  onClick={() => onSelectItem(item)}
                >
                  <TableCell className="font-mono font-semibold">
                    {item.sku}
                  </TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>{item.reservedQty}</TableCell>
                  <TableCell>{item.remainingQty}</TableCell>
                  <TableCell>
                    <StatusBadge tone={statusTone(item.lineStatus)}>
                      {printJobLineStatusLabel(item.lineStatus)}
                    </StatusBadge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 break-all text-sm font-semibold">{value}</div>
    </div>
  );
}

function TextField({
  id,
  label,
  onChange,
  type = "text",
  value,
}: {
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
        id={id}
        required
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
