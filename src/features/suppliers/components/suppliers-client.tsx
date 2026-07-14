"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LoaderCircle,
  Plus,
  RefreshCw,
  Save,
  Search,
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
  EntityDrawer,
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
  changeSupplierStatus,
  createSupplier,
  deleteSupplier,
  listSupplierItemsBySupplier,
  listSuppliers,
  SUPPLIER_STATUSES,
  updateSupplier,
  updateSupplierItem,
  upsertSupplierItem,
  type Supplier,
  type SupplierItem,
  type SupplierStatus,
} from "../services/supplier.service";

const PAGE_SIZE = 20;

const supplierKeys = {
  items: (supplierId: string) => ["suppliers", "items", supplierId] as const,
  list: (params: { page: number; search: string; status: string }) =>
    ["suppliers", "list", params] as const,
};

const defaultSupplierForm = {
  address: "",
  code: "",
  contactName: "",
  email: "",
  name: "",
  note: "",
  phone: "",
  taxCode: "",
};

const defaultSupplierItemForm = {
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

function requiredText(value: string) {
  return value.trim();
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

function supplierPayload(form: typeof defaultSupplierForm) {
  return {
    address: optionalText(form.address),
    code: requiredText(form.code),
    contactName: optionalText(form.contactName),
    email: optionalText(form.email),
    name: requiredText(form.name),
    note: optionalText(form.note),
    phone: optionalText(form.phone),
    taxCode: optionalText(form.taxCode),
  };
}

function supplierItemPayload(
  form: typeof defaultSupplierItemForm,
  supplierId: string,
) {
  return {
    itemId: requiredText(form.itemId),
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

export function SuppliersClient() {
  const user = useSessionUser();
  const queryClient = useQueryClient();
  const canManage = hasAnyRole(user?.roles, ["MANAGER"]);
  const canDelete = hasAnyRole(user?.roles, ["ADMIN"]);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SupplierStatus | "ALL">(
    "ALL",
  );
  const [page, setPage] = useState(1);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [createForm, setCreateForm] = useState(defaultSupplierForm);
  const [dialogOpen, setDialogOpen] = useState(false);

  const suppliersQuery = useQuery({
    enabled: canManage,
    queryFn: () =>
      listSuppliers({
        limit: PAGE_SIZE,
        page,
        search,
        status: statusFilter,
      }),
    queryKey: supplierKeys.list({ page, search, status: statusFilter }),
  });

  const suppliers = useMemo(
    () => suppliersQuery.data?.data ?? [],
    [suppliersQuery.data?.data],
  );
  const selectedSupplier = useMemo(
    () => suppliers.find((supplier) => supplier.id === selectedSupplierId),
    [selectedSupplierId, suppliers],
  );
  const activeSupplierId = selectedSupplier?.id ?? "";
  const total = suppliersQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const createSupplierMutation = useMutation({
    mutationFn: () => createSupplier(supplierPayload(createForm)),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: (supplier) => {
      setCreateForm(defaultSupplierForm);
      setSelectedSupplierId(supplier.id);
      void queryClient.invalidateQueries({ queryKey: ["suppliers", "list"] });
      setDialogOpen(false);
      toast.success("Đã tạo nhà cung cấp");
    },
  });

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchDraft.trim());
  }

  function handleCreateSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createSupplierMutation.mutate();
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Nhà cung cấp"
        actions={
          <>
          <Button
            disabled={!canManage}
            onClick={() =>
              void queryClient.invalidateQueries({ queryKey: ["suppliers"] })
            }
            type="button"
            variant="outline"
          >
            {suppliersQuery.isFetching ? (
              <LoaderCircle className="animate-spin" data-icon="inline-start" />
            ) : (
              <RefreshCw data-icon="inline-start" />
            )}
            Làm mới
          </Button>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={!canManage}>
                <Plus data-icon="inline-start" />
                Tạo nhà cung cấp
              </Button>
            </DialogTrigger>
            <DialogContent size="lg" className="max-h-[90vh] overflow-y-auto p-6">
              <DialogHeader className="mb-5">
                <DialogTitle>Tạo nhà cung cấp</DialogTitle>
                <DialogDescription>Thêm nhà cung cấp mới</DialogDescription>
              </DialogHeader>
              <SupplierForm
                busy={createSupplierMutation.isPending}
                disabled={!canManage}
                form={createForm}
                submitLabel="Tạo nhà cung cấp"
                onChange={setCreateForm}
                onSubmit={handleCreateSupplier}
              />
            </DialogContent>
          </Dialog>
          </>
        }
      />

      {!canManage ? (
        <PermissionNotice>
          Bạn cần quyền phù hợp để quản lý nhà cung cấp.
        </PermissionNotice>
      ) : null}

      {suppliersQuery.error ? <ErrorBanner error={suppliersQuery.error} /> : null}

      <div className="grid gap-4">
        <Card>
          <CardHeader className="border-b bg-muted/20">
            <CardTitle className="flex items-center gap-2 text-base">
              <Truck className="size-4 text-primary" />
              Danh sách NCC
            </CardTitle>
            <CardDescription>
              {total} bản ghi · trang {page}/{totalPages}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <form
              className="grid gap-3 md:grid-cols-[1fr_180px_auto]"
              onSubmit={handleSearch}
            >
              <div className="space-y-2">
                <Label htmlFor="supplier-search">Tìm kiếm</Label>
                <Input
                  id="supplier-search"
                  placeholder="Tên hoặc mã NCC"
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Trạng thái</Label>
                <Select
                  value={statusFilter}
                  onValueChange={(value) => {
                    setPage(1);
                    setStatusFilter(value as SupplierStatus | "ALL");
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tất cả</SelectItem>
                    {SUPPLIER_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {statusLabel(status)}
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

            {suppliersQuery.isLoading ? (
              <TableSkeleton columns={4} />
            ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã</TableHead>
                  <TableHead>Tên</TableHead>
                  <TableHead>Liên hệ</TableHead>
                  <TableHead>Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.length === 0 ? (
                  <EmptyRow colSpan={4} label="Chưa có nhà cung cấp." />
                ) : (
                  suppliers.map((supplier) => (
                    <TableRow
                      className={cn(
                        "cursor-pointer",
                        supplier.id === activeSupplierId && "bg-primary/5",
                      )}
                      key={supplier.id}
                      onClick={() => setSelectedSupplierId(supplier.id)}
                    >
                      <TableCell className="font-medium">
                        {supplier.code}
                      </TableCell>
                      <TableCell>{supplier.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {supplier.contactName || supplier.phone || "Chưa khai"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge tone={statusTone(supplier.status)}>
                          {statusLabel(supplier.status)}
                        </StatusBadge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
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

      {selectedSupplier ? (
        <EntityDrawer
          open
          title={selectedSupplier.name}
          description={selectedSupplier.code}
          onOpenChange={(open) => !open && setSelectedSupplierId("")}
        >
          <SupplierDetailSection
            canDelete={canDelete}
            canManage={canManage}
            key={selectedSupplier.id}
            supplier={selectedSupplier}
            onDeleted={() => setSelectedSupplierId("")}
          />
        </EntityDrawer>
      ) : null}
    </div>
  );
}

function SupplierDetailSection({
  canDelete,
  canManage,
  onDeleted,
  supplier,
}: {
  canDelete: boolean;
  canManage: boolean;
  onDeleted: () => void;
  supplier: Supplier;
}) {
  const queryClient = useQueryClient();
  const [editForm, setEditForm] = useState({
    address: supplier.address ?? "",
    code: supplier.code,
    contactName: supplier.contactName ?? "",
    email: supplier.email ?? "",
    name: supplier.name,
    note: supplier.note ?? "",
    phone: supplier.phone ?? "",
    taxCode: supplier.taxCode ?? "",
  });
  const [nextStatus, setNextStatus] = useState<SupplierStatus>(supplier.status);
  const [itemForm, setItemForm] = useState(defaultSupplierItemForm);
  const [itemEdit, setItemEdit] = useState(defaultSupplierItemForm);
  const [editingItemId, setEditingItemId] = useState("");
  const [blacklistConfirmOpen, setBlacklistConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const itemsQuery = useQuery({
    enabled: canManage,
    queryFn: () => listSupplierItemsBySupplier(supplier.id),
    queryKey: supplierKeys.items(supplier.id),
  });
  const supplierItems = itemsQuery.data ?? [];

  const updateSupplierMutation = useMutation({
    mutationFn: () => updateSupplier(supplier.id, supplierPayload(editForm)),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["suppliers", "list"] });
      toast.success("Đã cập nhật nhà cung cấp");
    },
  });

  const changeStatusMutation = useMutation({
    mutationFn: () => changeSupplierStatus(supplier.id, nextStatus),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["suppliers", "list"] });
      toast.success("Đã đổi trạng thái");
    },
  });

  const deleteSupplierMutation = useMutation({
    mutationFn: () => deleteSupplier(supplier.id),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: () => {
      onDeleted();
      void queryClient.invalidateQueries({ queryKey: ["suppliers", "list"] });
      toast.success("Đã xóa nhà cung cấp");
    },
  });

  const upsertItemMutation = useMutation({
    mutationFn: () => upsertSupplierItem(supplierItemPayload(itemForm, supplier.id)),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: () => {
      setItemForm(defaultSupplierItemForm);
      void queryClient.invalidateQueries({
        queryKey: supplierKeys.items(supplier.id),
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
        supplierId: supplier.id,
        supplierItemCode: optionalText(itemEdit.supplierItemCode),
      }),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: () => {
      setEditingItemId("");
      void queryClient.invalidateQueries({
        queryKey: supplierKeys.items(supplier.id),
      });
      toast.success("Đã cập nhật mặt hàng NCC");
    },
  });

  function handleUpdateSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateSupplierMutation.mutate();
  }

  function handleChangeStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (supplier.status !== "BLACKLIST" && nextStatus === "BLACKLIST") {
      setBlacklistConfirmOpen(true);
      return;
    }

    changeStatusMutation.mutate();
  }

  function handleUpsertItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    upsertItemMutation.mutate();
  }

  const canUnblacklist =
    supplier.status !== "BLACKLIST" || nextStatus === "BLACKLIST" || canDelete;

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
      <Card>
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="text-base">
            {supplier.code} · {supplier.name}
          </CardTitle>
          <CardDescription>Cập nhật thông tin và trạng thái</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <SupplierForm
            busy={updateSupplierMutation.isPending}
            disabled={!canManage}
            form={editForm}
            submitLabel="Lưu nhà cung cấp"
            onChange={setEditForm}
            onSubmit={handleUpdateSupplier}
          />

          <form
            className="grid gap-3 rounded-lg border border-border/70 bg-muted/20 p-3 md:grid-cols-[1fr_auto_auto]"
            onSubmit={handleChangeStatus}
          >
            <div className="space-y-2">
              <Label>Trạng thái</Label>
              <Select
                value={nextStatus}
                onValueChange={(value) => setNextStatus(value as SupplierStatus)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPLIER_STATUSES.map((status) => (
                    <SelectItem
                      disabled={
                        supplier.status === "BLACKLIST" &&
                        status !== "BLACKLIST" &&
                        !canDelete
                      }
                      key={status}
                      value={status}
                    >
                      {statusLabel(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="self-end"
              disabled={
                !canManage || !canUnblacklist || changeStatusMutation.isPending
              }
              type="submit"
            >
              {changeStatusMutation.isPending ? (
                <LoaderCircle className="animate-spin" data-icon="inline-start" />
              ) : (
                <Save data-icon="inline-start" />
              )}
              Đổi trạng thái
            </Button>
            <Button
              className="self-end"
              disabled={!canDelete || deleteSupplierMutation.isPending}
              onClick={() => setDeleteConfirmOpen(true)}
              type="button"
              variant="destructive"
            >
              <Trash2 data-icon="inline-start" />
              Xóa nhà cung cấp
            </Button>
          </form>
          <Dialog
            open={blacklistConfirmOpen}
            onOpenChange={setBlacklistConfirmOpen}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Đưa nhà cung cấp vào blacklist?</DialogTitle>
                <DialogDescription>
                  Nhà cung cấp sẽ không còn được ưu tiên cho đơn mua mới.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Hủy
                  </Button>
                </DialogClose>
                <Button
                  disabled={changeStatusMutation.isPending}
                  onClick={() => {
                    changeStatusMutation.mutate();
                    setBlacklistConfirmOpen(false);
                  }}
                  type="button"
                  variant="destructive"
                >
                  Xác nhận
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Xóa nhà cung cấp?</DialogTitle>
                <DialogDescription>
                  Hành động này chỉ dùng khi dữ liệu nhà cung cấp không còn cần
                  quản lý trong WMS.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Hủy
                  </Button>
                </DialogClose>
                <Button
                  disabled={deleteSupplierMutation.isPending}
                  onClick={() => {
                    deleteSupplierMutation.mutate();
                    setDeleteConfirmOpen(false);
                  }}
                  type="button"
                  variant="destructive"
                >
                  <Trash2 data-icon="inline-start" />
                  Xóa nhà cung cấp
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="text-base">Mặt hàng NCC</CardTitle>
          <CardDescription>Danh mục giá theo mã mặt hàng kho</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {itemsQuery.error ? <ErrorBanner error={itemsQuery.error} /> : null}
          <form className="grid gap-3 md:grid-cols-3" onSubmit={handleUpsertItem}>
            <TextField
              id="supplier-item-id"
              label="Mã mặt hàng kho"
              value={itemForm.itemId}
              onChange={(value) =>
                setItemForm((current) => ({ ...current, itemId: value }))
              }
            />
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

          <SupplierItemTable
            canManage={canManage}
            editingItemId={editingItemId}
            editForm={itemEdit}
            items={supplierItems}
            updateBusy={updateItemMutation.isPending}
            onEditChange={setItemEdit}
            onEditStart={(item) => {
              setEditingItemId(item.id);
              setItemEdit({
                isActive: item.isActive,
                itemId: item.itemId,
                leadTimeDays: item.leadTimeDays?.toString() ?? "",
                minOrderQty: item.minOrderQty?.toString() ?? "",
                purchasePrice: item.purchasePrice.toString(),
                supplierItemCode: item.supplierItemCode ?? "",
              });
            }}
            onEditStop={() => setEditingItemId("")}
            onUpdate={(itemId) => updateItemMutation.mutate(itemId)}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function SupplierForm({
  busy,
  disabled,
  form,
  onChange,
  onSubmit,
  submitLabel,
}: {
  busy: boolean;
  disabled: boolean;
  form: typeof defaultSupplierForm;
  onChange: (form: typeof defaultSupplierForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitLabel: string;
}) {
  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <div className="grid gap-3 md:grid-cols-2">
        <TextField
          id={`${submitLabel}-code`}
          label="Mã NCC"
          value={form.code}
          onChange={(value) => onChange({ ...form, code: value })}
        />
        <TextField
          id={`${submitLabel}-name`}
          label="Tên NCC"
          value={form.name}
          onChange={(value) => onChange({ ...form, name: value })}
        />
        <TextField
          id={`${submitLabel}-contact`}
          label="Người liên hệ"
          required={false}
          value={form.contactName}
          onChange={(value) => onChange({ ...form, contactName: value })}
        />
        <TextField
          id={`${submitLabel}-phone`}
          label="Số điện thoại"
          required={false}
          value={form.phone}
          onChange={(value) => onChange({ ...form, phone: value })}
        />
        <TextField
          id={`${submitLabel}-email`}
          label="Email"
          required={false}
          value={form.email}
          onChange={(value) => onChange({ ...form, email: value })}
        />
        <TextField
          id={`${submitLabel}-tax`}
          label="Mã số thuế"
          required={false}
          value={form.taxCode}
          onChange={(value) => onChange({ ...form, taxCode: value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${submitLabel}-address`}>Địa chỉ</Label>
        <Input
          id={`${submitLabel}-address`}
          value={form.address}
          onChange={(event) => onChange({ ...form, address: event.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${submitLabel}-note`}>Ghi chú</Label>
        <Textarea
          id={`${submitLabel}-note`}
          value={form.note}
          onChange={(event) => onChange({ ...form, note: event.target.value })}
        />
      </div>
      <Button disabled={disabled || busy} type="submit">
        {busy ? (
          <LoaderCircle className="animate-spin" data-icon="inline-start" />
        ) : (
          <Save data-icon="inline-start" />
        )}
        {submitLabel}
      </Button>
    </form>
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

function SupplierItemTable({
  canManage,
  editingItemId,
  editForm,
  items,
  onEditChange,
  onEditStart,
  onEditStop,
  onUpdate,
  updateBusy,
}: {
  canManage: boolean;
  editingItemId: string;
  editForm: typeof defaultSupplierItemForm;
  items: SupplierItem[];
  onEditChange: (form: typeof defaultSupplierItemForm) => void;
  onEditStart: (item: SupplierItem) => void;
  onEditStop: () => void;
  onUpdate: (itemId: string) => void;
  updateBusy: boolean;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Mã mặt hàng kho</TableHead>
          <TableHead>Giá</TableHead>
          <TableHead>Giao hàng / SL tối thiểu</TableHead>
          <TableHead>Trạng thái</TableHead>
          <TableHead className="w-32"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 ? (
          <EmptyRow colSpan={5} label="Chưa có mặt hàng NCC." />
        ) : (
          items.map((item) => {
            const isEditing = editingItemId === item.id;

            return (
              <TableRow key={item.id}>
                <TableCell className="font-medium">
                  <div>{item.itemId}</div>
                  <div className="text-xs text-muted-foreground">
                    {item.supplierItemCode ?? "Chưa có mã NCC"}
                  </div>
                </TableCell>
                <TableCell>
                  {isEditing ? (
                    <Input
                      value={editForm.purchasePrice}
                      onChange={(event) =>
                        onEditChange({
                          ...editForm,
                          purchasePrice: event.target.value,
                        })
                      }
                    />
                  ) : (
                    item.purchasePrice.toLocaleString("vi-VN")
                  )}
                </TableCell>
                <TableCell>
                  {isEditing ? (
                    <div className="grid gap-2">
                      <Input
                        placeholder="Thời gian giao"
                        value={editForm.leadTimeDays}
                        onChange={(event) =>
                          onEditChange({
                            ...editForm,
                            leadTimeDays: event.target.value,
                          })
                        }
                      />
                      <Input
                        placeholder="SL đặt tối thiểu"
                        value={editForm.minOrderQty}
                        onChange={(event) =>
                          onEditChange({
                            ...editForm,
                            minOrderQty: event.target.value,
                          })
                        }
                      />
                    </div>
                  ) : (
                    `${item.leadTimeDays ?? 0} ngày / ${item.minOrderQty ?? 0}`
                  )}
                </TableCell>
                <TableCell>
                  {isEditing ? (
                    <Label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={editForm.isActive}
                        onCheckedChange={(checked) =>
                          onEditChange({
                            ...editForm,
                            isActive: checked === true,
                          })
                        }
                      />
                      Đang dùng
                    </Label>
                  ) : (
                    <StatusBadge tone={item.isActive ? "success" : "neutral"}>
                      {item.isActive ? "Đang dùng" : "Ngưng dùng"}
                    </StatusBadge>
                  )}
                </TableCell>
                <TableCell>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <Button
                        disabled={!canManage || updateBusy}
                        onClick={() => onUpdate(item.id)}
                        size="sm"
                        type="button"
                      >
                        <Save data-icon="inline-start" />
                        Lưu
                      </Button>
                      <Button
                        onClick={onEditStop}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        Hủy
                      </Button>
                    </div>
                  ) : (
                    <Button
                      disabled={!canManage}
                      onClick={() => onEditStart(item)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <Save data-icon="inline-start" />
                      Sửa
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
