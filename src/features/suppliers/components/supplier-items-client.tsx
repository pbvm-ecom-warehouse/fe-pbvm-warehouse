"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  LoaderCircle,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  X,
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
import {
  listSuppliers,
  listSupplierItems,
  upsertSupplierItem,
  updateSupplierItem,
  type Supplier,
  type SupplierItem,
} from "../services/supplier.service";

const PAGE_SIZE = 20;

const supplierItemKeys = {
  list: (params: { page: number; supplierId: string; itemId: string }) =>
    ["supplier-items", "list", params] as const,
};

const defaultItemForm = {
  isActive: true,
  itemId: "",
  leadTimeDays: "",
  minOrderQty: "",
  purchasePrice: "",
  supplierId: "",
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

function itemPayload(form: typeof defaultItemForm) {
  return {
    itemId: form.itemId.trim(),
    leadTimeDays: optionalNumber(form.leadTimeDays),
    minOrderQty: optionalNumber(form.minOrderQty),
    purchasePrice: requiredNumber(form.purchasePrice),
    supplierId: form.supplierId.trim(),
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
  const [supplierFilter, setSupplierFilter] = useState("");
  const [itemFilter, setItemFilter] = useState("");
  const [page, setPage] = useState(1);
  const [createForm, setCreateForm] = useState(defaultItemForm);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SupplierItem | null>(null);
  const [itemEdit, setItemEdit] = useState(defaultItemForm);
  const [deleteTarget, setDeleteTarget] = useState<SupplierItem | null>(null);

  const suppliersQuery = useQuery({
    enabled: canManage,
    queryFn: () => listSuppliers({ limit: 100, page: 1, status: "ACTIVE" }),
    queryKey: ["suppliers", "list", "combobox"],
  });
  const suppliers = useMemo(
    () => suppliersQuery.data?.data ?? [],
    [suppliersQuery.data?.data],
  );

  const itemsQuery = useQuery({
    enabled: canManage,
    queryFn: () =>
      listSupplierItems({
        itemId: itemFilter || undefined,
        limit: PAGE_SIZE,
        page,
        supplierId: supplierFilter || undefined,
      }),
    queryKey: supplierItemKeys.list({
      itemId: itemFilter,
      page,
      supplierId: supplierFilter,
    }),
  });
  const supplierItems = itemsQuery.data?.data ?? [];
  const total = itemsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function invalidateList() {
    void queryClient.invalidateQueries({ queryKey: ["supplier-items", "list"] });
  }

  const upsertItemMutation = useMutation({
    mutationFn: () => upsertSupplierItem(itemPayload(createForm)),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: () => {
      setCreateForm(defaultItemForm);
      setDialogOpen(false);
      invalidateList();
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
      invalidateList();
      toast.success("Đã cập nhật mặt hàng NCC");
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) =>
      updateSupplierItem(itemId, { isActive: false }),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: () => {
      setDeleteTarget(null);
      invalidateList();
      toast.success("Đã xóa mặt hàng NCC");
    },
  });

  function handleCreateItem(event: FormEvent<HTMLFormElement>) {
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
      supplierId: item.supplierId,
      supplierItemCode: item.supplierItemCode ?? "",
    });
  }

  function handleUpdateItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editingItem) {
      updateItemMutation.mutate(editingItem.id);
    }
  }

  function handleFilterChange() {
    setPage(1);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Mặt hàng nhà cung cấp"
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/suppliers">
                <ArrowLeft data-icon="inline-start" />
                Quay lại
              </Link>
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button disabled={!canManage}>
                  <Plus data-icon="inline-start" />
                  Thêm mặt hàng NCC
                </Button>
              </DialogTrigger>
              <DialogContent size="lg">
                <DialogHeader>
                  <DialogTitle>Thêm mặt hàng NCC</DialogTitle>
                  <DialogDescription>
                    Gán mặt hàng kho vào danh mục giá của 1 nhà cung cấp — tạo
                    mới nếu chưa có, cập nhật nếu đã có.
                  </DialogDescription>
                </DialogHeader>
                <form className="space-y-4" onSubmit={handleCreateItem}>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="create-supplier-id">Nhà cung cấp</Label>
                      <Select
                        value={createForm.supplierId}
                        onValueChange={(value) =>
                          setCreateForm((current) => ({
                            ...current,
                            supplierId: value,
                          }))
                        }
                      >
                        <SelectTrigger id="create-supplier-id" className="w-full">
                          <SelectValue placeholder="Chọn nhà cung cấp" />
                        </SelectTrigger>
                        <SelectContent>
                          {suppliers.map((supplier) => (
                            <SelectItem key={supplier.id} value={supplier.id}>
                              {supplier.code} · {supplier.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="create-item-id">Mặt hàng kho</Label>
                      <WarehouseItemCombobox
                        id="create-item-id"
                        label="Mặt hàng kho"
                        selectedItemId={createForm.itemId}
                        onSelect={(item) =>
                          setCreateForm((current) => ({
                            ...current,
                            itemId: item.id,
                          }))
                        }
                      />
                    </div>
                    <TextField
                      id="create-supplier-item-code"
                      label="Mã hàng NCC"
                      required={false}
                      value={createForm.supplierItemCode}
                      onChange={(value) =>
                        setCreateForm((current) => ({
                          ...current,
                          supplierItemCode: value,
                        }))
                      }
                    />
                    <TextField
                      id="create-purchase-price"
                      label="Giá nhập"
                      value={createForm.purchasePrice}
                      onChange={(value) =>
                        setCreateForm((current) => ({
                          ...current,
                          purchasePrice: value,
                        }))
                      }
                    />
                    <TextField
                      id="create-lead-time"
                      label="Thời gian giao (ngày)"
                      required={false}
                      value={createForm.leadTimeDays}
                      onChange={(value) =>
                        setCreateForm((current) => ({
                          ...current,
                          leadTimeDays: value,
                        }))
                      }
                    />
                    <TextField
                      id="create-moq"
                      label="SL đặt tối thiểu"
                      required={false}
                      value={createForm.minOrderQty}
                      onChange={(value) =>
                        setCreateForm((current) => ({
                          ...current,
                          minOrderQty: value,
                        }))
                      }
                    />
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button type="button" variant="outline">
                        Hủy
                      </Button>
                    </DialogClose>
                    <Button
                      disabled={
                        !canManage ||
                        !createForm.itemId.trim() ||
                        !createForm.supplierId.trim() ||
                        upsertItemMutation.isPending
                      }
                      type="submit"
                    >
                      {upsertItemMutation.isPending ? (
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
          </>
        }
      />

      {!canManage ? (
        <PermissionNotice>
          Bạn cần quyền phù hợp để quản lý mặt hàng nhà cung cấp.
        </PermissionNotice>
      ) : null}

      {itemsQuery.error ? <ErrorBanner error={itemsQuery.error} /> : null}

      <Card>
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="text-base">Danh mục giá theo NCC</CardTitle>
          <CardDescription>
            {total} bản ghi · trang {page}/{totalPages}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="filter-supplier">Nhà cung cấp</Label>
              <Select
                value={supplierFilter || "ALL"}
                onValueChange={(value) => {
                  handleFilterChange();
                  setSupplierFilter(value === "ALL" ? "" : value);
                }}
              >
                <SelectTrigger id="filter-supplier" className="w-full">
                  <SelectValue placeholder="Tất cả NCC" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tất cả NCC</SelectItem>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.code} · {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-item">Mặt hàng kho</Label>
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <WarehouseItemCombobox
                    id="filter-item"
                    label="Mặt hàng kho"
                    placeholder="Tất cả mặt hàng"
                    selectedItemId={itemFilter}
                    onSelect={(item) => {
                      handleFilterChange();
                      setItemFilter(item.id);
                    }}
                  />
                </div>
                {itemFilter ? (
                  <Button
                    aria-label="Bỏ lọc mặt hàng"
                    onClick={() => {
                      handleFilterChange();
                      setItemFilter("");
                    }}
                    size="icon"
                    type="button"
                    variant="outline"
                  >
                    <X className="size-4" />
                  </Button>
                ) : null}
              </div>
            </div>
            <Button
              className="self-end"
              onClick={() => void itemsQuery.refetch()}
              type="button"
              variant="outline"
            >
              {itemsQuery.isFetching ? (
                <LoaderCircle
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : (
                <Search data-icon="inline-start" />
              )}
              Tải lại
            </Button>
          </div>

          {itemsQuery.isLoading ? (
            <TableSkeleton columns={6} />
          ) : (
            <SupplierItemTable
              canManage={canManage}
              items={supplierItems}
              suppliers={suppliers}
              onDelete={setDeleteTarget}
              onEdit={openItemEdit}
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

function SupplierItemTable({
  canManage,
  items,
  onDelete,
  onEdit,
  suppliers,
}: {
  canManage: boolean;
  items: SupplierItem[];
  onDelete: (item: SupplierItem) => void;
  onEdit: (item: SupplierItem) => void;
  suppliers: Supplier[];
}) {
  const supplierById = useMemo(
    () => new Map(suppliers.map((supplier) => [supplier.id, supplier])),
    [suppliers],
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-border/70">
      <Table scrollable>
        <TableHeader>
          <TableRow>
            <TableHead>Mặt hàng kho</TableHead>
            <TableHead>Nhà cung cấp</TableHead>
            <TableHead>Giá nhập</TableHead>
            <TableHead>Giao hàng / SL tối thiểu</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead className="w-36 text-right">Thao tác</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <EmptyRow colSpan={6} label="Chưa có mặt hàng NCC." />
          ) : (
            items.map((item) => {
              const supplier = supplierById.get(item.supplierId);
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    <div className="font-mono font-medium">
                      {item.sku ?? item.itemId}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.itemName ?? "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.supplierItemCode ?? "Chưa có mã NCC"}
                    </div>
                  </TableCell>
                  <TableCell>
                    {supplier
                      ? `${supplier.code} · ${supplier.name}`
                      : item.supplierId}
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
              );
            })
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
