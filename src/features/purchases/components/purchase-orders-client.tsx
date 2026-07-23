"use client";

import { FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronsUpDown,
  Eye,
  CheckCircle2,
  ClipboardCheck,
  LoaderCircle,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  EvidenceImageGallery,
  EvidenceImagePicker,
} from "@/components/evidence-images";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  PageHeader,
  PermissionNotice,
  StatusBadge,
  TableSkeleton,
} from "@/features/admin-shell/components/operations-ui";
import { getApiErrorMessage } from "@/lib/api-contract";
import { hasAnyRole } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { statusLabel, statusTone } from "@/lib/wms-ui-labels";
import { useSessionUser } from "@/hooks/use-session-user";
import {
  listSuppliers,
  type Supplier,
} from "@/features/suppliers/services/supplier.service";
import {
  listWarehouses,
  type WarehouseStructureWarehouse,
} from "@/features/warehouse-structure/services/warehouse-structure.service";
import {
  listWarehouseItems,
  type WarehouseItem,
} from "@/features/products/services/warehouse-items.service";

import {
  createPurchaseOrder,
  getPurchaseOrder,
  listPurchaseOrders,
  PURCHASE_ORDER_STATUSES,
  type PurchaseOrder,
  type PurchaseOrderItem,
  type PurchaseOrderStatus,
} from "../services/purchase-order.service";
import {
  approveGoodsReceiptNote,
  confirmGoodsReceiptNote,
  createGoodsReceiptNote,
  listGoodsReceiptNotes,
  uploadGoodsReceiptNoteImage,
  type GoodsReceiptNote,
  type GoodsReceiptNoteItem,
} from "../services/goods-receipt-note.service";

const PAGE_SIZE = 20;

const purchaseKeys = {
  detail: (purchaseOrderId: string) =>
    ["purchase-orders", "detail", purchaseOrderId] as const,
  grns: (purchaseOrderId: string) =>
    ["goods-receipt-notes", "purchase-order", purchaseOrderId] as const,
  list: (params: { page: number; status: string; supplierId: string }) =>
    ["purchase-orders", "list", params] as const,

  suppliers: ["purchase-orders", "suppliers"] as const,
  warehouses: ["purchase-orders", "warehouses"] as const,
};

type PurchaseOrderItemForm = {
  expectedQty: string;
  itemId: string;
  sku: string;
  unit: string;
  unitPrice: string;
};

type GoodsReceiptItemForm = {
  actualQty: string;
  expiryDate: string;
  itemId: string;
  lotNumber: string;
  note: string;
  sku: string;
  unit: string;
};

const defaultItemForm: PurchaseOrderItemForm = {
  expectedQty: "1",
  itemId: "",
  sku: "",
  unit: "cái",
  unitPrice: "0",
};

const defaultCreateForm = {
  expectedDate: "",
  note: "",
  supplierId: "",
  warehouseId: "",
};

function formatError(error: unknown) {
  return getApiErrorMessage(error) ?? "Không kết nối được WMS.";
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function parsePositiveNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function useDebouncedValue(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timeoutId);
  }, [delay, value]);

  return debouncedValue;
}
function formatDate(value?: string | null) {
  if (!value) {
    return "Chưa có";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("vi-VN").format(date);
}

function toPurchaseOrderItems(
  forms: PurchaseOrderItemForm[],
): PurchaseOrderItem[] {
  return forms
    .map((form) => ({
      expectedQty: parsePositiveNumber(form.expectedQty, 0),
      itemId: form.itemId.trim(),
      sku: form.sku.trim(),
      unit: form.unit.trim() || "cái",
      unitPrice: parsePositiveNumber(form.unitPrice, 0),
    }))
    .filter((item) => item.itemId && item.sku && item.expectedQty > 0);
}

function toGoodsReceiptItems(
  forms: GoodsReceiptItemForm[],
): GoodsReceiptNoteItem[] {
  return forms
    .map((form) => ({
      actualQty: parsePositiveNumber(form.actualQty, 0),
      expiryDate: optionalText(form.expiryDate),
      itemId: form.itemId.trim(),
      lotNumber: optionalText(form.lotNumber),
      note: optionalText(form.note),
      sku: form.sku.trim(),
      unit: form.unit.trim() || "cái",
    }))
    .filter((item) => item.itemId && item.sku && item.actualQty > 0);
}

function buildGoodsReceiptForms(
  purchaseOrder: PurchaseOrder | undefined,
): GoodsReceiptItemForm[] {
  return (
    purchaseOrder?.items?.map((item) => ({
      actualQty: String(item.expectedQty),
      expiryDate: "",
      itemId: item.itemId,
      lotNumber: "",
      note: "",
      sku: item.sku,
      unit: item.unit,
    })) ?? []
  );
}

function ErrorBanner({ error }: { error: unknown }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
      {formatError(error)}
    </div>
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

export function PurchaseOrdersClient() {
  const user = useSessionUser();
  const queryClient = useQueryClient();
  const canUsePurchaseOrderApi = hasAnyRole(user?.roles, ["MANAGER"]);
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus | "ALL">(
    "ALL",
  );
  const [supplierFilter, setSupplierFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selectedPurchaseOrderId, setSelectedPurchaseOrderId] = useState("");
  const [createForm, setCreateForm] = useState(defaultCreateForm);
  const [itemForms, setItemForms] = useState<PurchaseOrderItemForm[]>([
    defaultItemForm,
  ]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [grnDialogOpen, setGrnDialogOpen] = useState(false);
  const [grnItemForms, setGrnItemForms] = useState<GoodsReceiptItemForm[]>([]);
  const [grnImages, setGrnImages] = useState<File[]>([]);

  const purchaseOrdersQuery = useQuery({
    enabled: canUsePurchaseOrderApi,
    queryFn: () =>
      listPurchaseOrders({
        limit: PAGE_SIZE,
        page,
        status: statusFilter,
        supplierId: supplierFilter,
      }),
    queryKey: purchaseKeys.list({
      page,
      status: statusFilter,
      supplierId: supplierFilter,
    }),
  });

  const suppliersQuery = useQuery({
    enabled: canUsePurchaseOrderApi,
    queryFn: () => listSuppliers({ limit: 100, page: 1, status: "ACTIVE" }),
    queryKey: purchaseKeys.suppliers,
  });

  const warehousesQuery = useQuery({
    enabled: canUsePurchaseOrderApi,
    queryFn: listWarehouses,
    queryKey: purchaseKeys.warehouses,
  });

  const purchaseOrders = useMemo(
    () => purchaseOrdersQuery.data?.data ?? [],
    [purchaseOrdersQuery.data?.data],
  );
  const suppliers = useMemo(
    () => suppliersQuery.data?.data ?? [],
    [suppliersQuery.data?.data],
  );
  const warehouses = useMemo(
    () => warehousesQuery.data ?? [],
    [warehousesQuery.data],
  );

  const total = purchaseOrdersQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selectedPurchaseOrder =
    purchaseOrders.find((po) => po.id === selectedPurchaseOrderId) ??
    purchaseOrders[0];
  const activePurchaseOrderId = selectedPurchaseOrder?.id ?? "";

  const detailQuery = useQuery({
    enabled: canUsePurchaseOrderApi && Boolean(activePurchaseOrderId),
    queryFn: () => getPurchaseOrder(activePurchaseOrderId),
    queryKey: purchaseKeys.detail(activePurchaseOrderId),
  });
  const detail = detailQuery.data ?? selectedPurchaseOrder;
  const grnsQuery = useQuery({
    enabled: canUsePurchaseOrderApi && Boolean(activePurchaseOrderId),
    queryFn: () =>
      listGoodsReceiptNotes({
        limit: 50,
        page: 1,
        purchaseOrderId: activePurchaseOrderId,
      }),
    queryKey: purchaseKeys.grns(activePurchaseOrderId),
  });
  const goodsReceiptNotes = useMemo(
    () => grnsQuery.data?.data ?? [],
    [grnsQuery.data?.data],
  );

  const supplierById = useMemo(
    () => new Map(suppliers.map((supplier) => [supplier.id, supplier])),
    [suppliers],
  );
  const warehouseById = useMemo(
    () => new Map(warehouses.map((warehouse) => [warehouse.id, warehouse])),
    [warehouses],
  );

  const createMutation = useMutation({
    mutationFn: () =>
      createPurchaseOrder({
        expectedDate: optionalText(createForm.expectedDate),
        items: toPurchaseOrderItems(itemForms),
        note: optionalText(createForm.note),
        supplierId: createForm.supplierId,
        warehouseId: createForm.warehouseId,
      }),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: (purchaseOrder) => {
      setCreateForm(defaultCreateForm);
      setItemForms([defaultItemForm]);
      setSelectedPurchaseOrderId(purchaseOrder.id);
      void queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      setDialogOpen(false);
      toast.success("Đã tạo đơn mua");
    },
  });

  const createGrnMutation = useMutation({
    mutationFn: async () => {
      let goodsReceiptNote = await createGoodsReceiptNote({
        items: toGoodsReceiptItems(grnItemForms),
        purchaseOrderId: activePurchaseOrderId,
      });

      for (const image of grnImages) {
        goodsReceiptNote = await uploadGoodsReceiptNoteImage(
          goodsReceiptNote.id,
          image,
        );
      }

      return goodsReceiptNote;
    },
    onError: (error) => toast.error(formatError(error)),
    onSuccess: () => {
      setGrnItemForms([]);
      setGrnImages([]);
      setGrnDialogOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["goods-receipt-notes"] });
      void queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast.success("Đã tạo phiếu nhập");
    },
  });
  const confirmGrnMutation = useMutation({
    mutationFn: (goodsReceiptNoteId: string) =>
      confirmGoodsReceiptNote(goodsReceiptNoteId),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["goods-receipt-notes"] });
      void queryClient.invalidateQueries({ queryKey: ["putaway-tasks"] });
      toast.success("Đã xác nhận nhận hàng");
    },
  });

  const approveGrnMutation = useMutation({
    mutationFn: (goodsReceiptNoteId: string) =>
      approveGoodsReceiptNote(goodsReceiptNoteId),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["goods-receipt-notes"] });
      void queryClient.invalidateQueries({ queryKey: ["putaway-tasks"] });
      toast.success("Đã duyệt phiếu nhập");
    },
  });

  function handleFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
  }

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const items = toPurchaseOrderItems(itemForms);
    if (items.length === 0) {
      toast.error("Đơn mua cần ít nhất một dòng hàng hợp lệ.");
      return;
    }

    createMutation.mutate();
  }

  function handleCreateGrn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const items = toGoodsReceiptItems(grnItemForms);
    if (!activePurchaseOrderId || items.length === 0) {
      toast.error("Phiếu nhập cần ít nhất một dòng hàng hợp lệ.");
      return;
    }

    createGrnMutation.mutate();
  }

  function openGrnDialog() {
    setGrnItemForms(buildGoodsReceiptForms(detail));
    setGrnImages([]);
    setGrnDialogOpen(true);
  }

  function updateItemForm(index: number, next: PurchaseOrderItemForm) {
    setItemForms((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? next : item)),
    );
  }

  function addItemRow() {
    setItemForms((current) => [...current, defaultItemForm]);
  }

  function removeItemRow(index: number) {
    setItemForms((current) =>
      current.length === 1
        ? [defaultItemForm]
        : current.filter((_, itemIndex) => itemIndex !== index),
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Nhập hàng"
        actions={
          <>
            <Button
              disabled={!canUsePurchaseOrderApi}
              onClick={() =>
                void queryClient.invalidateQueries({
                  queryKey: ["purchase-orders"],
                })
              }
              type="button"
              variant="outline"
            >
              {purchaseOrdersQuery.isFetching ? (
                <LoaderCircle
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : (
                <RefreshCw data-icon="inline-start" />
              )}
              Làm mới
            </Button>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button disabled={!canUsePurchaseOrderApi}>
                  <Plus data-icon="inline-start" />
                  Tạo đơn mua
                </Button>
              </DialogTrigger>
              <DialogContent
                size="5xl"
                className="max-h-[90dvh] grid-rows-[auto_minmax(0,1fr)] overflow-hidden p-0"
              >
                <DialogHeader className="border-b px-6 py-4 pr-12">
                  <DialogTitle>Tạo đơn mua</DialogTitle>
                  <DialogDescription>
                    Thêm đơn đặt hàng mới vào hệ thống.
                  </DialogDescription>
                </DialogHeader>
                <form
                  className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden"
                  onSubmit={handleCreate}
                >
                  <div
                    className="min-h-0 space-y-4 overflow-x-hidden overflow-y-auto px-6 py-4"
                    data-testid="purchase-order-dialog-body"
                  >
                    <div className="grid gap-3 md:grid-cols-2">
                      <SelectField
                        disabled={!canUsePurchaseOrderApi}
                        label="Nhà cung cấp"
                        value={createForm.supplierId}
                        onChange={(supplierId) =>
                          setCreateForm((current) => ({
                            ...current,
                            supplierId,
                          }))
                        }
                      >
                        {suppliers.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.code} · {supplier.name}
                          </SelectItem>
                        ))}
                      </SelectField>
                      <SelectField
                        disabled={!canUsePurchaseOrderApi}
                        label="Kho nhận"
                        value={createForm.warehouseId}
                        onChange={(warehouseId) =>
                          setCreateForm((current) => ({
                            ...current,
                            warehouseId,
                          }))
                        }
                      >
                        {warehouses.map((warehouse) => (
                          <SelectItem key={warehouse.id} value={warehouse.id}>
                            {warehouse.name}
                          </SelectItem>
                        ))}
                      </SelectField>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="po-expected-date">Ngày dự kiến</Label>
                        <Input
                          id="po-expected-date"
                          type="date"
                          value={createForm.expectedDate}
                          onChange={(event) =>
                            setCreateForm((current) => ({
                              ...current,
                              expectedDate: event.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="po-note">Ghi chú</Label>
                      <Textarea
                        id="po-note"
                        value={createForm.note}
                        onChange={(event) =>
                          setCreateForm((current) => ({
                            ...current,
                            note: event.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <Label>Hàng đặt</Label>
                        <Button
                          onClick={addItemRow}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          <Plus data-icon="inline-start" />
                          Thêm dòng
                        </Button>
                      </div>
                      {itemForms.map((item, index) => (
                        <PurchaseOrderItemFields
                          index={index}
                          item={item}
                          key={index}
                          onChange={(next) => updateItemForm(index, next)}
                          onRemove={() => removeItemRow(index)}
                        />
                      ))}
                    </div>
                  </div>

                  <DialogFooter className="m-0 rounded-none px-6 py-4">
                    <Button
                      disabled={
                        !canUsePurchaseOrderApi ||
                        !createForm.supplierId ||
                        !createForm.warehouseId ||
                        itemForms.some(
                          (item) => !item.itemId || !item.sku || !item.unit,
                        ) ||
                        createMutation.isPending
                      }
                      type="submit"
                    >
                      {createMutation.isPending ? (
                        <LoaderCircle
                          className="animate-spin"
                          data-icon="inline-start"
                        />
                      ) : (
                        <Save data-icon="inline-start" />
                      )}
                      Tạo đơn mua
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      {!canUsePurchaseOrderApi ? (
        <PermissionNotice>
          Bạn cần quyền phù hợp để tạo và chỉnh sửa đơn mua.
        </PermissionNotice>
      ) : null}

      {purchaseOrdersQuery.error ? (
        <ErrorBanner error={purchaseOrdersQuery.error} />
      ) : null}

      <div className="grid gap-4">
        <Card>
          <CardHeader className="border-b bg-muted/20">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingCart className="size-4 text-primary" />
              Đơn mua
            </CardTitle>
            <CardDescription>
              {total} bản ghi · trang {page}/{totalPages}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <form
              className="grid gap-3 md:grid-cols-[180px_1fr_auto]"
              onSubmit={handleFilter}
            >
              <div className="space-y-2">
                <Label>Trạng thái</Label>
                <Select
                  value={statusFilter}
                  onValueChange={(value) => {
                    setPage(1);
                    setStatusFilter(value as PurchaseOrderStatus | "ALL");
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tất cả</SelectItem>
                    {PURCHASE_ORDER_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {statusLabel(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nhà cung cấp</Label>
                <Select
                  value={supplierFilter || "ALL"}
                  onValueChange={(value) => {
                    setPage(1);
                    setSupplierFilter(value === "ALL" ? "" : value);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tất cả</SelectItem>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.code} · {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="self-end"
                disabled={!canUsePurchaseOrderApi}
                type="submit"
              >
                <Search data-icon="inline-start" />
                Lọc
              </Button>
            </form>

            {purchaseOrdersQuery.isLoading ? (
              <TableSkeleton columns={5} />
            ) : (
              <PurchaseOrderTable
                purchaseOrders={purchaseOrders}
                selectedId={activePurchaseOrderId}
                supplierById={supplierById}
                warehouseById={warehouseById}
                onSelect={(purchaseOrder) =>
                  setSelectedPurchaseOrderId(purchaseOrder.id)
                }
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

      {detail ? (
        <>
          <PurchaseOrderDetail
            detail={detail}
            loading={detailQuery.isFetching}
            supplier={supplierById.get(detail.supplierId)}
            warehouse={warehouseById.get(detail.warehouseId)}
          />
          <GoodsReceiptNotesPanel
            approveBusyId={
              approveGrnMutation.isPending
                ? approveGrnMutation.variables
                : undefined
            }
            canManage={canUsePurchaseOrderApi}
            confirmBusyId={
              confirmGrnMutation.isPending
                ? confirmGrnMutation.variables
                : undefined
            }
            createBusy={createGrnMutation.isPending}
            dialogOpen={grnDialogOpen}
            grnItemForms={grnItemForms}
            grnImages={grnImages}
            grns={goodsReceiptNotes}
            loading={grnsQuery.isFetching}
            purchaseOrder={detail}
            onApprove={(goodsReceiptNoteId) =>
              approveGrnMutation.mutate(goodsReceiptNoteId)
            }
            onConfirm={(goodsReceiptNoteId) =>
              confirmGrnMutation.mutate(goodsReceiptNoteId)
            }
            onCreate={handleCreateGrn}
            onDialogOpenChange={(open) => {
              if (open) {
                openGrnDialog();
              } else {
                setGrnDialogOpen(false);
                setGrnImages([]);
              }
            }}
            onFormChange={setGrnItemForms}
            onImagesChange={setGrnImages}
          />
        </>
      ) : null}
    </div>
  );
}

function SelectField({
  children,
  disabled,
  label,
  onChange,
  value,
}: {
  children: ReactNode;
  disabled: boolean;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select disabled={disabled} value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  );
}

function PurchaseOrderTable({
  onSelect,
  purchaseOrders,
  selectedId,
  supplierById,
  warehouseById,
}: {
  onSelect: (purchaseOrder: PurchaseOrder) => void;
  purchaseOrders: PurchaseOrder[];
  selectedId: string;
  supplierById: Map<string, Supplier>;
  warehouseById: Map<string, WarehouseStructureWarehouse>;
}) {
  return (
    <Table scrollable>
      <TableHeader>
        <TableRow>
          <TableHead>Số đơn mua</TableHead>
          <TableHead>NCC</TableHead>
          <TableHead>Kho</TableHead>
          <TableHead>Trạng thái</TableHead>
          <TableHead>Ngày tạo</TableHead>
          <TableHead className="w-36 text-right">Thao tác</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {purchaseOrders.length === 0 ? (
          <EmptyRow colSpan={6} label="Chưa có đơn mua." />
        ) : (
          purchaseOrders.map((purchaseOrder) => (
            <TableRow
              className={cn(
                "cursor-pointer",
                selectedId === purchaseOrder.id && "bg-primary/5",
              )}
              key={purchaseOrder.id}
              onClick={() => onSelect(purchaseOrder)}
            >
              <TableCell className="font-medium">
                {purchaseOrder.poNumber}
              </TableCell>
              <TableCell>
                {supplierById.get(purchaseOrder.supplierId)?.name ??
                  purchaseOrder.supplierId}
              </TableCell>
              <TableCell>
                {warehouseById.get(purchaseOrder.warehouseId)?.name ??
                  purchaseOrder.warehouseId}
              </TableCell>
              <TableCell>
                <StatusBadge tone={statusTone(purchaseOrder.status)}>
                  {statusLabel(purchaseOrder.status)}
                </StatusBadge>
              </TableCell>
              <TableCell>{formatDate(purchaseOrder.orderDate)}</TableCell>
              <TableCell>
                <div className="flex justify-end">
                  <Button
                    aria-label={`Xem chi tiết đơn mua ${purchaseOrder.poNumber}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect(purchaseOrder);
                    }}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Eye data-icon="inline-start" />
                    Xem chi tiết
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

function PurchaseOrderItemFields({
  index,
  item,
  onChange,
  onRemove,
}: {
  index: number;
  item: PurchaseOrderItemForm;
  onChange: (item: PurchaseOrderItemForm) => void;
  onRemove: () => void;
}) {
  const itemId = `purchase-item-${index}`;

  return (
    <div className="grid gap-3 rounded-lg border border-border/70 bg-muted/20 p-3 sm:grid-cols-2 lg:grid-cols-12">
      <div className="min-w-0 space-y-2 sm:col-span-2 lg:col-span-4">
        <Label htmlFor={`${itemId}-picker`}>Mặt hàng</Label>
        <WarehouseItemCombobox
          id={`${itemId}-picker`}
          label={`Mặt hàng dòng ${index + 1}`}
          selectedItemId={item.itemId}
          selectedSku={item.sku}
          onSelect={(stockItem) =>
            onChange({
              ...item,
              itemId: stockItem.id,
              sku: stockItem.sku,
              unit: stockItem.unit,
            })
          }
        />
      </div>
      <div className="min-w-0 space-y-2 lg:col-span-2">
        <Label htmlFor={`${itemId}-sku`}>SKU</Label>
        <Input
          aria-label={`SKU dòng ${index + 1}`}
          className="bg-muted/50 font-mono text-muted-foreground"
          id={`${itemId}-sku`}
          placeholder="SKU"
          readOnly
          required
          value={item.sku}
        />
      </div>
      <div className="min-w-0 space-y-2 lg:col-span-2">
        <Label htmlFor={`${itemId}-quantity`}>Số lượng</Label>
        <Input
          aria-label={`Số lượng dòng ${index + 1}`}
          id={`${itemId}-quantity`}
          min="0"
          required
          type="number"
          value={item.expectedQty}
          onChange={(event) =>
            onChange({ ...item, expectedQty: event.target.value })
          }
        />
      </div>
      <div className="min-w-0 space-y-2 lg:col-span-1">
        <Label htmlFor={`${itemId}-unit`}>Đơn vị</Label>
        <Input
          aria-label={`Đơn vị dòng ${index + 1}`}
          className="bg-muted/50 text-muted-foreground"
          id={`${itemId}-unit`}
          readOnly
          value={item.unit}
        />
      </div>
      <div className="min-w-0 space-y-2 lg:col-span-2">
        <Label htmlFor={`${itemId}-price`}>Đơn giá</Label>
        <Input
          aria-label={`Đơn giá dòng ${index + 1}`}
          id={`${itemId}-price`}
          min="0"
          type="number"
          value={item.unitPrice}
          onChange={(event) =>
            onChange({ ...item, unitPrice: event.target.value })
          }
        />
      </div>
      <div className="flex items-end justify-end lg:col-span-1">
        <Button
          aria-label={`Xóa dòng ${index + 1}`}
          onClick={onRemove}
          size="icon-sm"
          type="button"
          variant="destructive"
        >
          <Trash2 />
        </Button>
      </div>
    </div>
  );
}

function WarehouseItemCombobox({
  id,
  label,
  onSelect,
  selectedItemId,
  selectedSku,
}: {
  id: string;
  label: string;
  onSelect: (item: WarehouseItem) => void;
  selectedItemId: string;
  selectedSku: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const itemsQuery = useQuery({
    enabled: open,
    queryFn: () =>
      listWarehouseItems({
        isActive: true,
        limit: 100,
        page: 1,
        search: debouncedSearch,
      }),
    queryKey: ["purchase-orders", "stock-items", debouncedSearch],
  });
  const items = itemsQuery.data?.data ?? [];
  const selectedItem = items.find((item) => item.id === selectedItemId);

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          aria-label={label}
          className="w-full justify-between bg-background font-normal"
          id={id}
          role="combobox"
          type="button"
          variant="outline"
        >
          <span className="min-w-0 truncate text-left">
            {selectedItem
              ? `${selectedItem.sku} - ${selectedItem.name}`
              : selectedSku || "Chọn mặt hàng"}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={12}
        side="bottom"
        className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Tìm SKU hoặc tên mặt hàng"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-64 overflow-y-auto">
            {itemsQuery.isFetching ? (
              <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" />
                Đang tìm mặt hàng...
              </div>
            ) : null}
            <CommandEmpty>Không có mặt hàng phù hợp.</CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.id}
                  onSelect={() => {
                    onSelect(item);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "size-4",
                      selectedItemId === item.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-mono font-medium">{item.sku}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      - {item.name}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {item.unit}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function PurchaseOrderDetail({
  detail,
  loading,
  supplier,
  warehouse,
}: {
  detail: PurchaseOrder;
  loading: boolean;
  supplier: Supplier | undefined;
  warehouse: WarehouseStructureWarehouse | undefined;
}) {
  const items = detail.items ?? [];

  return (
    <Card>
      <CardHeader className="border-b bg-muted/20">
        <CardTitle className="flex items-center gap-2 text-base">
          <Eye className="size-4 text-primary" />
          {detail.poNumber}
          {loading ? <LoaderCircle className="size-4 animate-spin" /> : null}
        </CardTitle>
        <CardDescription>
          {supplier?.name ?? detail.supplierId} ·{" "}
          {warehouse?.name ?? detail.warehouseId}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="grid gap-3 md:grid-cols-4">
          <InfoBox label="Trạng thái" value={statusLabel(detail.status)} />
          <InfoBox label="Ngày tạo" value={formatDate(detail.orderDate)} />
          <InfoBox
            label="Ngày dự kiến"
            value={formatDate(detail.expectedDate)}
          />
          <InfoBox label="Số dòng" value={items.length.toString()} />
        </div>
        {detail.note ? (
          <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-sm">
            {detail.note}
          </div>
        ) : null}
        <Table scrollable>
          <TableHeader>
            <TableRow>
              <TableHead>Mã mặt hàng</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Số lượng</TableHead>
              <TableHead>Đơn vị</TableHead>
              <TableHead>Đơn giá</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={`${item.itemId}-${item.sku}`}>
                <TableCell className="font-medium">{item.itemId}</TableCell>
                <TableCell>{item.sku}</TableCell>
                <TableCell>{item.expectedQty}</TableCell>
                <TableCell>{item.unit}</TableCell>
                <TableCell>
                  {(item.unitPrice ?? 0).toLocaleString("vi-VN")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function GoodsReceiptNotesPanel({
  approveBusyId,
  canManage,
  confirmBusyId,
  createBusy,
  dialogOpen,
  grnItemForms,
  grnImages,
  grns,
  loading,
  onApprove,
  onConfirm,
  onCreate,
  onDialogOpenChange,
  onFormChange,
  onImagesChange,
  purchaseOrder,
}: {
  approveBusyId?: string;
  canManage: boolean;
  confirmBusyId?: string;
  createBusy: boolean;
  dialogOpen: boolean;
  grnItemForms: GoodsReceiptItemForm[];
  grnImages: File[];
  grns: GoodsReceiptNote[];
  loading: boolean;
  onApprove: (goodsReceiptNoteId: string) => void;
  onConfirm: (goodsReceiptNoteId: string) => void;
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
  onDialogOpenChange: (open: boolean) => void;
  onFormChange: (forms: GoodsReceiptItemForm[]) => void;
  onImagesChange: (files: File[]) => void;
  purchaseOrder: PurchaseOrder;
}) {
  function updateItemForm(index: number, next: GoodsReceiptItemForm) {
    onFormChange(
      grnItemForms.map((item, itemIndex) =>
        itemIndex === index ? next : item,
      ),
    );
  }

  return (
    <Card>
      <CardHeader className="border-b bg-muted/20">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="size-4 text-primary" />
              Phiếu nhập
            </CardTitle>
            <CardDescription>
              Tạo phiếu nhập từ đơn mua, xác nhận nhận hàng rồi duyệt phiếu.
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={onDialogOpenChange}>
            <DialogTrigger asChild>
              <Button
                disabled={
                  !canManage || (purchaseOrder.items?.length ?? 0) === 0
                }
              >
                <Plus data-icon="inline-start" />
                Tạo phiếu nhập
              </Button>
            </DialogTrigger>
            <DialogContent size="2xl" className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Tạo phiếu nhập</DialogTitle>
                <DialogDescription>
                  Dữ liệu lấy từ các dòng hàng của đơn mua đang chọn.
                </DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={onCreate}>
                <div className="grid gap-3">
                  {grnItemForms.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      Đơn mua chưa có dòng hàng để tạo phiếu nhập.
                    </div>
                  ) : null}
                  {grnItemForms.map((item, index) => (
                    <GoodsReceiptItemFields
                      index={index}
                      item={item}
                      key={`${item.itemId}-${index}`}
                      onChange={(next) => updateItemForm(index, next)}
                    />
                  ))}
                </div>
                <EvidenceImagePicker
                  disabled={!canManage || createBusy}
                  files={grnImages}
                  id="goods-receipt-images"
                  label="Ảnh minh chứng nhận hàng"
                  onChange={onImagesChange}
                />{" "}
                <Button
                  disabled={
                    !canManage || createBusy || grnItemForms.length === 0
                  }
                  type="submit"
                >
                  {createBusy ? (
                    <LoaderCircle
                      className="animate-spin"
                      data-icon="inline-start"
                    />
                  ) : (
                    <Save data-icon="inline-start" />
                  )}
                  Tạo phiếu nhập
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            Đang tải phiếu nhập...
          </div>
        ) : null}
        <Table scrollable>
          <TableHeader>
            <TableRow>
              <TableHead>Mã phiếu</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Số dòng</TableHead>
              <TableHead>Ảnh</TableHead>
              <TableHead>Cập nhật</TableHead>
              <TableHead className="w-52"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {grns.length === 0 ? (
              <EmptyRow
                colSpan={6}
                label="Chưa có phiếu nhập cho đơn mua này."
              />
            ) : (
              grns.map((grn) => (
                <TableRow key={grn.id}>
                  <TableCell className="font-mono font-semibold">
                    {grn.grnNumber}
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={statusTone(grn.status)}>
                      {statusLabel(grn.status)}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>{grn.items.length}</TableCell>
                  <TableCell>
                    <EvidenceImageGallery
                      images={grn.images}
                      emptyLabel="Chưa có ảnh"
                    />
                  </TableCell>
                  <TableCell>{formatDate(grn.updatedAt)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        disabled={
                          !canManage ||
                          grn.status !== "DRAFT" ||
                          confirmBusyId === grn.id
                        }
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
                      <Button
                        disabled={
                          !canManage ||
                          grn.status !== "CONFIRMED" ||
                          approveBusyId === grn.id
                        }
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
                    </div>
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

function GoodsReceiptItemFields({
  index,
  item,
  onChange,
}: {
  index: number;
  item: GoodsReceiptItemForm;
  onChange: (item: GoodsReceiptItemForm) => void;
}) {
  const fieldId = `goods-receipt-item-${index}`;

  return (
    <div className="grid gap-3 rounded-lg border border-border/70 bg-muted/20 p-3 sm:grid-cols-2 lg:grid-cols-12">
      <div className="min-w-0 space-y-2 lg:col-span-3">
        <Label htmlFor={`${fieldId}-item`}>Mã mặt hàng</Label>
        <Input
          aria-label={`Mã mặt hàng phiếu nhập dòng ${index + 1}`}
          id={`${fieldId}-item`}
          readOnly
          value={item.itemId}
        />
      </div>
      <div className="min-w-0 space-y-2 lg:col-span-3">
        <Label htmlFor={`${fieldId}-sku`}>SKU</Label>
        <Input
          aria-label={`SKU phiếu nhập dòng ${index + 1}`}
          id={`${fieldId}-sku`}
          readOnly
          value={item.sku}
        />
      </div>
      <div className="min-w-0 space-y-2 lg:col-span-2">
        <Label htmlFor={`${fieldId}-quantity`}>Số lượng thực nhập</Label>
        <Input
          aria-label={`Số lượng thực nhập dòng ${index + 1}`}
          id={`${fieldId}-quantity`}
          min="0"
          type="number"
          value={item.actualQty}
          onChange={(event) =>
            onChange({ ...item, actualQty: event.target.value })
          }
        />
      </div>
      <div className="min-w-0 space-y-2 lg:col-span-2">
        <Label htmlFor={`${fieldId}-unit`}>Đơn vị</Label>
        <Input
          aria-label={`Đơn vị phiếu nhập dòng ${index + 1}`}
          id={`${fieldId}-unit`}
          value={item.unit}
          onChange={(event) => onChange({ ...item, unit: event.target.value })}
        />
      </div>
      <div className="min-w-0 space-y-2 lg:col-span-2">
        <Label htmlFor={`${fieldId}-lot`}>Mã lô</Label>
        <Input
          aria-label={`Mã lô phiếu nhập dòng ${index + 1}`}
          id={`${fieldId}-lot`}
          value={item.lotNumber}
          onChange={(event) =>
            onChange({ ...item, lotNumber: event.target.value })
          }
        />
      </div>
      <div className="min-w-0 space-y-2 lg:col-span-3">
        <Label htmlFor={`${fieldId}-expiry`}>Hạn sử dụng</Label>
        <Input
          aria-label={`Hạn sử dụng phiếu nhập dòng ${index + 1}`}
          id={`${fieldId}-expiry`}
          type="date"
          value={item.expiryDate}
          onChange={(event) =>
            onChange({ ...item, expiryDate: event.target.value })
          }
        />
      </div>
      <div className="min-w-0 space-y-2 sm:col-span-2 lg:col-span-9">
        <Label htmlFor={`${fieldId}-note`}>Ghi chú</Label>
        <Input
          aria-label={`Ghi chú phiếu nhập dòng ${index + 1}`}
          id={`${fieldId}-note`}
          value={item.note}
          onChange={(event) => onChange({ ...item, note: event.target.value })}
        />
      </div>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}
