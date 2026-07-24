"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LoaderCircle,
  Pencil,
  Plus,
  Save,
  Trash2,
  Truck,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  DialogClose,
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
import {
  PageHeader,
  PermissionNotice,
  StatusBadge,
  TableSkeleton,
} from "@/features/admin-shell/components/operations-ui";
import { getApiErrorMessage } from "@/lib/api-contract";
import { hasAnyRole } from "@/lib/rbac";
import { useSessionUser } from "@/hooks/use-session-user";
import { WarehouseItemCombobox } from "@/features/products/components/warehouse-item-combobox";
import { getWarehouseItem } from "@/features/products/services/warehouse-items.service";
import {
  listSuppliers,
  upsertSupplierItem,
  listSupplierItemsBySupplier,
  updateSupplierItem,
  type Supplier,
  type SupplierItem,
} from "../services/supplier.service";

const supplierItemKeys = {
  bySupplier: (supplierId: string) =>
    ["supplier-items", "by-supplier", supplierId] as const,
};

const defaultItemForm = {
  isActive: true,
  itemId: "",
  leadTimeDays: "",
  minOrderQty: "",
  purchasePrice: "",
  supplierItemCode: "",
};

function formatError(error: unknown) {
  return getApiErrorMessage(error) ?? "Không kết nối được WMS.";
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function optionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function requiredNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function itemPayload(form: typeof defaultItemForm, supplierId: string) {
  return {
    itemId: form.itemId.trim(),
    leadTimeDays: optionalNumber(form.leadTimeDays),
    minOrderQty: optionalNumber(form.minOrderQty),
    purchasePrice: requiredNumber(form.purchasePrice),
    supplierId,
    supplierItemCode: optionalText(form.supplierItemCode),
  };
}

function ErrorBanner({ error }: { error: unknown }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
      {formatError(error)}
    </div>
  );
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

export function SupplierItemsClient() {
  const user = useSessionUser();
  const queryClient = useQueryClient();
  const canManage = hasAnyRole(user?.roles, ["MANAGER"]);
  const [supplierId, setSupplierId] = useState("");
  const [itemForm, setItemForm] = useState(defaultItemForm);
  const [itemEdit, setItemEdit] = useState(defaultItemForm);
  const [editingItem, setEditingItem] = useState<SupplierItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SupplierItem | null>(null);

  const suppliersQuery = useQuery({
    enabled: canManage,
    queryFn: () => listSuppliers({ limit: 200, page: 1, status: "ACTIVE" }),
    queryKey: ["suppliers", "list", "combobox"],
  });
  const suppliers = useMemo(
    () => suppliersQuery.data?.data ?? [],
    [suppliersQuery.data?.data],
  );
  const selectedSupplier = suppliers.find(
    (supplier) => supplier.id === supplierId,
  );

  const itemsQuery = useQuery({
    enabled: canManage && Boolean(supplierId),
    queryFn: () => listSupplierItemsBySupplier(supplierId),
    queryKey: supplierItemKeys.bySupplier(supplierId),
  });
  const supplierItems = itemsQuery.data ?? [];

  const upsertItemMutation = useMutation({
    mutationFn: () => upsertSupplierItem(itemPayload(itemForm, supplierId)),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: () => {
      setItemForm(defaultItemForm);
      void queryClient.invalidateQueries({
        queryKey: supplierItemKeys.bySupplier(supplierId),
      });
      toast.success("Đã lưu mặt hàng NCC");
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: (itemId: string) =>
      updateSupplierItem(itemId, {
        isActive: itemEdit.isActive,
        leadTimeDays: optionalNumber(itemEdit.leadTimeDays),
        minOrderQty: optionalNumber(itemEdit.minOrderQty),
        purchasePrice: optionalNumber(itemEdit.purchasePrice),
        supplierItemCode: optionalText(itemEdit.supplierItemCode),
      }),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: () => {
      setEditingItem(null);
      void queryClient.invalidateQueries({
        queryKey: supplierItemKeys.bySupplier(supplierId),
      });
      toast.success("Đã cập nhật mặt hàng NCC");
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) =>
      updateSupplierItem(itemId, { isActive: false }),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: () => {
      setDeleteTarget(null);
      void queryClient.invalidateQueries({
        queryKey: supplierItemKeys.bySupplier(supplierId),
      });
      toast.success("Đã xóa mặt hàng NCC");
    },
  });

  function handleUpsertItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    upsertItemMutation.mutate();
  }

  function openItemEdit(item: SupplierItem) {
    setEditingItem(item);
    setItemEdit({
      isActive: item.isActive,
      itemId: item.itemId,
      leadTimeDays: item.leadTimeDays?.toString() ?? "",
      minOrderQty: item.minOrderQty?.toString() ?? "",
      purchasePrice: item.purchasePrice.toString(),
      supplierItemCode: item.supplierItemCode ?? "",
    });
  }

  function handleUpdateItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editingItem) {
      updateItemMutation.mutate(editingItem.id);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Gán mặt hàng NCC" />

      {!canManage ? (
        <PermissionNotice>
          Bạn cần quyền phù hợp để quản lý mặt hàng nhà cung cấp.
        </PermissionNotice>
      ) : null}

      <Card>
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="flex items-center gap-2 text-base">
            <Truck className="size-4 text-primary" />
            Chọn nhà cung cấp
          </CardTitle>
          <CardDescription>
            Chọn NCC để xem và gán danh mục mặt hàng kho tương ứng
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 pt-4">
          <Select
            disabled={!canManage}
            value={supplierId}
            onValueChange={setSupplierId}
          >
            <SelectTrigger aria-label="Nhà cung cấp" className="w-full md:w-96">
              <SelectValue placeholder="Chọn nhà cung cấp" />
            </SelectTrigger>
            <SelectContent>
              {suppliers.map((supplier) => (
                <SupplierOption key={supplier.id} supplier={supplier} />
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {supplierId ? (
        <Card>
          <CardHeader className="border-b bg-muted/20">
            <CardTitle className="text-base">
              Mặt hàng NCC · {selectedSupplier?.code ?? supplierId}
            </CardTitle>
            <CardDescription>Danh mục giá theo mã mặt hàng kho</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {itemsQuery.error ? <ErrorBanner error={itemsQuery.error} /> : null}
            <form
              className="grid gap-3 md:grid-cols-3"
              onSubmit={handleUpsertItem}
            >
              <div className="space-y-2">
                <Label htmlFor="supplier-item-id">Mặt hàng kho</Label>
                <WarehouseItemCombobox
                  disabled={!canManage}
                  id="supplier-item-id"
                  label="Mặt hàng kho"
                  selectedItemId={itemForm.itemId}
                  onSelect={(item) =>
                    setItemForm((current) => ({
                      ...current,
                      itemId: item.id,
                    }))
                  }
                />
              </div>
              <TextField
                id="supplier-item-code"
                label="Mã hàng NCC"
                required={false}
                value={itemForm.supplierItemCode}
                onChange={(value) =>
                  setItemForm((current) => ({
                    ...current,
                    supplierItemCode: value,
                  }))
                }
              />
              <TextField
                id="supplier-item-price"
                label="Giá nhập"
                value={itemForm.purchasePrice}
                onChange={(value) =>
                  setItemForm((current) => ({
                    ...current,
                    purchasePrice: value,
                  }))
                }
              />
              <TextField
                id="supplier-item-lead-time"
                label="Thời gian giao"
                required={false}
                value={itemForm.leadTimeDays}
                onChange={(value) =>
                  setItemForm((current) => ({
                    ...current,
                    leadTimeDays: value,
                  }))
                }
              />
              <TextField
                id="supplier-item-moq"
                label="SL đặt tối thiểu"
                required={false}
                value={itemForm.minOrderQty}
                onChange={(value) =>
                  setItemForm((current) => ({
                    ...current,
                    minOrderQty: value,
                  }))
                }
              />
              <Button
                className="self-end"
                disabled={
                  !canManage ||
                  !itemForm.itemId.trim() ||
                  upsertItemMutation.isPending
                }
                type="submit"
              >
                <Plus data-icon="inline-start" />
                Lưu mặt hàng
              </Button>
            </form>

            {itemsQuery.isLoading ? (
              <TableSkeleton columns={5} />
            ) : (
              <SupplierItemTable
                canManage={canManage}
                items={supplierItems}
                onDelete={setDeleteTarget}
                onEdit={openItemEdit}
              />
            )}
          </CardContent>
        </Card>
      ) : null}

      <SupplierItemEditDialog
        busy={updateItemMutation.isPending}
        form={itemEdit}
        open={Boolean(editingItem)}
        onChange={setItemEdit}
        onOpenChange={(open) => !open && setEditingItem(null)}
        onSubmit={handleUpdateItem}
      />

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa mặt hàng NCC?</DialogTitle>
            <DialogDescription>
              Mặt hàng này sẽ chuyển sang trạng thái ngưng dùng trong danh mục
              của nhà cung cấp.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Hủy
              </Button>
            </DialogClose>
            <Button
              disabled={!deleteTarget || deleteItemMutation.isPending}
              onClick={() => {
                if (deleteTarget) {
                  deleteItemMutation.mutate(deleteTarget.id);
                }
              }}
              type="button"
              variant="destructive"
            >
              <Trash2 data-icon="inline-start" />
              Xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SupplierOption({ supplier }: { supplier: Supplier }) {
  return (
    <SelectItem value={supplier.id}>
      {supplier.code} · {supplier.name}
    </SelectItem>
  );
}

function WarehouseItemLabel({ itemId }: { itemId: string }) {
  const itemQuery = useQuery({
    queryFn: () => getWarehouseItem(itemId),
    queryKey: ["stock-items", "detail", itemId],
  });
  const item = itemQuery.data;

  if (itemQuery.isLoading) {
    return <span className="text-muted-foreground">Đang tải...</span>;
  }

  if (!item) {
    return <span className="text-muted-foreground">{itemId}</span>;
  }

  return (
    <div>
      <div className="font-mono font-medium">{item.sku}</div>
      <div className="text-xs text-muted-foreground">{item.name}</div>
    </div>
  );
}

function SupplierItemTable({
  canManage,
  items,
  onDelete,
  onEdit,
}: {
  canManage: boolean;
  items: SupplierItem[];
  onDelete: (item: SupplierItem) => void;
  onEdit: (item: SupplierItem) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border/70">
      <Table scrollable>
        <TableHeader>
          <TableRow>
            <TableHead>Mặt hàng kho</TableHead>
            <TableHead>Giá nhập</TableHead>
            <TableHead>Giao hàng / SL tối thiểu</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead className="w-36 text-right">Thao tác</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <EmptyRow colSpan={5} label="Chưa có mặt hàng NCC." />
          ) : (
            items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">
                  <WarehouseItemLabel itemId={item.itemId} />
                  <div className="text-xs text-muted-foreground">
                    {item.supplierItemCode ?? "Chưa có mã NCC"}
                  </div>
                </TableCell>
                <TableCell>
                  {item.purchasePrice.toLocaleString("vi-VN")}
                </TableCell>
                <TableCell>
                  {item.leadTimeDays ?? 0} ngày / {item.minOrderQty ?? 0}
                </TableCell>
                <TableCell>
                  <StatusBadge tone={item.isActive ? "success" : "neutral"}>
                    {item.isActive ? "Đang dùng" : "Ngưng dùng"}
                  </StatusBadge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button
                      aria-label={`Sửa mặt hàng NCC ${item.itemId}`}
                      disabled={!canManage}
                      onClick={() => onEdit(item)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <Pencil data-icon="inline-start" />
                      Sửa
                    </Button>
                    <Button
                      disabled={!canManage || !item.isActive}
                      onClick={() => onDelete(item)}
                      size="sm"
                      type="button"
                      variant="destructive"
                    >
                      <Trash2 data-icon="inline-start" />
                      Xóa
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function SupplierItemEditDialog({
  busy,
  form,
  onChange,
  onOpenChange,
  onSubmit,
  open,
}: {
  busy: boolean;
  form: typeof defaultItemForm;
  onChange: (form: typeof defaultItemForm) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  open: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Sửa mặt hàng NCC</DialogTitle>
          <DialogDescription>
            Cập nhật mã hàng, giá nhập và điều kiện đặt hàng.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="supplier-item-edit-item-id">Mặt hàng kho</Label>
              <WarehouseItemCombobox
                disabled
                id="supplier-item-edit-item-id"
                label="Mặt hàng kho"
                selectedItemId={form.itemId}
                onSelect={() => undefined}
              />
            </div>
            <TextField
              id="supplier-item-edit-code"
              label="Mã hàng NCC"
              required={false}
              value={form.supplierItemCode}
              onChange={(value) =>
                onChange({ ...form, supplierItemCode: value })
              }
            />
            <TextField
              id="supplier-item-edit-price"
              label="Giá nhập"
              value={form.purchasePrice}
              onChange={(value) => onChange({ ...form, purchasePrice: value })}
            />
            <TextField
              id="supplier-item-edit-lead-time"
              label="Thời gian giao"
              required={false}
              value={form.leadTimeDays}
              onChange={(value) => onChange({ ...form, leadTimeDays: value })}
            />
            <TextField
              id="supplier-item-edit-moq"
              label="SL đặt tối thiểu"
              required={false}
              value={form.minOrderQty}
              onChange={(value) => onChange({ ...form, minOrderQty: value })}
            />
            <Label
              className="flex items-center gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm font-medium md:self-end"
              htmlFor="supplier-item-edit-active"
            >
              <Checkbox
                checked={form.isActive}
                id="supplier-item-edit-active"
                onCheckedChange={(checked) =>
                  onChange({ ...form, isActive: checked === true })
                }
              />
              Đang dùng
            </Label>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Hủy
              </Button>
            </DialogClose>
            <Button disabled={busy} type="submit">
              {busy ? (
                <LoaderCircle
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : (
                <Save data-icon="inline-start" />
              )}
              Lưu mặt hàng
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TextField({
  id,
  label,
  onChange,
  required = true,
  value,
}: {
  id: string;
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  value: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
