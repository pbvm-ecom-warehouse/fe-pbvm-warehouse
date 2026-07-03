"use client";

import { FormEvent, type ReactNode, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  LoaderCircle,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShoppingCart,
  Trash2,
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
import { getApiErrorMessage } from "@/lib/api-contract";
import { hasAnyRole } from "@/lib/rbac";
import { cn } from "@/lib/utils";
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
  createPurchaseOrder,
  getPurchaseOrder,
  listPurchaseOrders,
  PURCHASE_ORDER_STATUSES,
  type PurchaseOrder,
  type PurchaseOrderItem,
  type PurchaseOrderStatus,
} from "../services/purchase-order.service";

const PAGE_SIZE = 20;

const purchaseKeys = {
  detail: (purchaseOrderId: string) =>
    ["purchase-orders", "detail", purchaseOrderId] as const,
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
  return getApiErrorMessage(error) ?? "Không gọi được WMS API.";
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function parsePositiveNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function statusVariant(status: PurchaseOrderStatus) {
  if (status === "CANCELLED") return "destructive";
  if (status === "COMPLETED") return "default";
  return "outline";
}

function formatDate(value: string | undefined) {
  if (!value) return "Chưa khai";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("vi-VN").format(date);
}

function toPurchaseOrderItems(items: PurchaseOrderItemForm[]) {
  return items
    .filter((item) => item.itemId.trim() && item.sku.trim())
    .map<PurchaseOrderItem>((item) => ({
      expectedQty: parsePositiveNumber(item.expectedQty, 1),
      itemId: item.itemId.trim(),
      sku: item.sku.trim(),
      unit: item.unit.trim() || "cái",
      unitPrice: parsePositiveNumber(item.unitPrice, 0),
    }));
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
      toast.success("Đã tạo PO");
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
      toast.error("PO cần ít nhất một dòng hàng hợp lệ.");
      return;
    }

    createMutation.mutate();
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
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-normal">
            Nhập hàng
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Tạo và theo dõi Purchase Order theo API WMS hiện có.
          </p>
        </div>
        <Button
          disabled={!canUsePurchaseOrderApi}
          onClick={() =>
            void queryClient.invalidateQueries({ queryKey: ["purchase-orders"] })
          }
          type="button"
          variant="outline"
        >
          {purchaseOrdersQuery.isFetching ? (
            <LoaderCircle className="animate-spin" data-icon="inline-start" />
          ) : (
            <RefreshCw data-icon="inline-start" />
          )}
          Làm mới
        </Button>
      </div>

      {!canUsePurchaseOrderApi ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Backend hiện chỉ mở API Purchase Order cho Manager/Admin. GRN và nhận
          hàng cho Receiver chưa được publish.
        </div>
      ) : null}

      {purchaseOrdersQuery.error ? (
        <ErrorBanner error={purchaseOrdersQuery.error} />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader className="border-b bg-muted/20">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingCart className="size-4 text-primary" />
              Purchase Orders
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
                        {status}
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
              <Button className="self-end" disabled={!canUsePurchaseOrderApi} type="submit">
                <Search data-icon="inline-start" />
                Lọc
              </Button>
            </form>

            <PurchaseOrderTable
              purchaseOrders={purchaseOrders}
              selectedId={activePurchaseOrderId}
              supplierById={supplierById}
              warehouseById={warehouseById}
              onSelect={(purchaseOrder) =>
                setSelectedPurchaseOrderId(purchaseOrder.id)
              }
            />

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

        <Card>
          <CardHeader className="border-b bg-muted/20">
            <CardTitle className="text-base">Tạo PO</CardTitle>
            <CardDescription>
              Chỉ tạo DRAFT theo API hiện có; confirm/send chưa publish.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <form className="space-y-4" onSubmit={handleCreate}>
              <div className="grid gap-3 md:grid-cols-2">
                <SelectField
                  disabled={!canUsePurchaseOrderApi}
                  label="Nhà cung cấp"
                  value={createForm.supplierId}
                  onChange={(supplierId) =>
                    setCreateForm((current) => ({ ...current, supplierId }))
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
                    setCreateForm((current) => ({ ...current, warehouseId }))
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

              <Button
                disabled={
                  !canUsePurchaseOrderApi ||
                  !createForm.supplierId ||
                  !createForm.warehouseId ||
                  createMutation.isPending
                }
                type="submit"
              >
                {createMutation.isPending ? (
                  <LoaderCircle className="animate-spin" data-icon="inline-start" />
                ) : (
                  <Save data-icon="inline-start" />
                )}
                Tạo PO
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {detail ? (
        <PurchaseOrderDetail
          detail={detail}
          loading={detailQuery.isFetching}
          supplier={supplierById.get(detail.supplierId)}
          warehouse={warehouseById.get(detail.warehouseId)}
        />
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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Số PO</TableHead>
          <TableHead>NCC</TableHead>
          <TableHead>Kho</TableHead>
          <TableHead>Trạng thái</TableHead>
          <TableHead>Ngày tạo</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {purchaseOrders.length === 0 ? (
          <EmptyRow colSpan={5} label="Chưa có PO." />
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
                <Badge variant={statusVariant(purchaseOrder.status)}>
                  {purchaseOrder.status}
                </Badge>
              </TableCell>
              <TableCell>{formatDate(purchaseOrder.orderDate)}</TableCell>
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
  return (
    <div className="grid gap-2 rounded-lg border border-border/70 bg-muted/20 p-3 md:grid-cols-[1fr_1fr_90px_90px_110px_auto]">
      <Input
        aria-label={`Item id dòng ${index + 1}`}
        placeholder="WarehouseItem id"
        required
        value={item.itemId}
        onChange={(event) => onChange({ ...item, itemId: event.target.value })}
      />
      <Input
        aria-label={`SKU dòng ${index + 1}`}
        placeholder="SKU"
        required
        value={item.sku}
        onChange={(event) => onChange({ ...item, sku: event.target.value })}
      />
      <Input
        aria-label={`Số lượng dòng ${index + 1}`}
        min="0"
        placeholder="Qty"
        required
        type="number"
        value={item.expectedQty}
        onChange={(event) =>
          onChange({ ...item, expectedQty: event.target.value })
        }
      />
      <Input
        aria-label={`Đơn vị dòng ${index + 1}`}
        placeholder="Unit"
        required
        value={item.unit}
        onChange={(event) => onChange({ ...item, unit: event.target.value })}
      />
      <Input
        aria-label={`Đơn giá dòng ${index + 1}`}
        min="0"
        placeholder="Đơn giá"
        type="number"
        value={item.unitPrice}
        onChange={(event) =>
          onChange({ ...item, unitPrice: event.target.value })
        }
      />
      <Button onClick={onRemove} size="icon-sm" type="button" variant="destructive">
        <Trash2 />
        <span className="sr-only">Xóa dòng</span>
      </Button>
    </div>
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
          <InfoBox label="Trạng thái" value={detail.status} />
          <InfoBox label="Ngày tạo" value={formatDate(detail.orderDate)} />
          <InfoBox label="Ngày dự kiến" value={formatDate(detail.expectedDate)} />
          <InfoBox label="Số dòng" value={detail.items.length.toString()} />
        </div>
        {detail.note ? (
          <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-sm">
            {detail.note}
          </div>
        ) : null}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item id</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Unit price</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {detail.items.map((item) => (
              <TableRow key={`${item.itemId}-${item.sku}`}>
                <TableCell className="font-medium">{item.itemId}</TableCell>
                <TableCell>{item.sku}</TableCell>
                <TableCell>{item.expectedQty}</TableCell>
                <TableCell>{item.unit}</TableCell>
                <TableCell>{item.unitPrice.toLocaleString("vi-VN")}</TableCell>
              </TableRow>
            ))}
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
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}
