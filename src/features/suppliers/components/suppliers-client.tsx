"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  LoaderCircle,
  Package,
  Pencil,
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
import { Switch } from "@/components/ui/switch";
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
  PageHeader,
  PermissionNotice,
  StatusBadge,
  TableSkeleton,
} from "@/features/admin-shell/components/operations-ui";
import { getApiErrorMessage } from "@/lib/api-contract";
import { hasAnyRole } from "@/lib/rbac";
import { statusLabel, statusTone } from "@/lib/wms-ui-labels";
import { useSessionUser } from "@/hooks/use-session-user";
import { suggestSupplierCode } from "@/features/suppliers/lib/supplier-code";

import {
  changeSupplierStatus,
  createSupplier,
  deleteSupplier,
  getSupplier,
  listSuppliers,
  SUPPLIER_STATUSES,
  updateSupplier,
  type Supplier,
  type SupplierStatus,
} from "../services/supplier.service";

const PAGE_SIZE = 20;

const supplierKeys = {
  detail: (supplierId: string) => ["suppliers", "detail", supplierId] as const,
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
  const [viewingSupplier, setViewingSupplier] = useState<Supplier | null>(
    null,
  );
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [deleteSupplierTarget, setDeleteSupplierTarget] =
    useState<Supplier | null>(null);
  const [blacklistTarget, setBlacklistTarget] = useState<Supplier | null>(
    null,
  );
  const [createForm, setCreateForm] = useState(defaultSupplierForm);
  const [createCodeManuallyEdited, setCreateCodeManuallyEdited] =
    useState(false);
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
  const total = suppliersQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const createSupplierMutation = useMutation({
    mutationFn: () => createSupplier(supplierPayload(createForm)),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: (supplier) => {
      setCreateForm(defaultSupplierForm);
      setCreateCodeManuallyEdited(false);
      setEditingSupplier(supplier);
      void queryClient.invalidateQueries({ queryKey: ["suppliers", "list"] });
      setDialogOpen(false);
      toast.success("Đã tạo nhà cung cấp");
    },
  });

  const deleteSupplierMutation = useMutation({
    mutationFn: (supplierId: string) => deleteSupplier(supplierId),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: () => {
      setDeleteSupplierTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["suppliers", "list"] });
      toast.success("Đã xóa nhà cung cấp");
    },
  });

  const changeStatusMutation = useMutation({
    mutationFn: ({
      supplierId,
      status,
    }: {
      supplierId: string;
      status: SupplierStatus;
    }) => changeSupplierStatus(supplierId, status),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: (updatedSupplier) => {
      queryClient.setQueryData(
        supplierKeys.detail(updatedSupplier.id),
        updatedSupplier,
      );
      void queryClient.invalidateQueries({ queryKey: ["suppliers", "list"] });
      toast.success("Đã đổi trạng thái");
    },
  });

  function handleToggleActive(supplier: Supplier, checked: boolean) {
    changeStatusMutation.mutate({
      status: checked ? "ACTIVE" : "INACTIVE",
      supplierId: supplier.id,
    });
  }

  function handleConfirmBlacklist() {
    if (blacklistTarget) {
      changeStatusMutation.mutate({
        status: "BLACKLIST",
        supplierId: blacklistTarget.id,
      });
      setBlacklistTarget(null);
    }
  }

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
                <LoaderCircle
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : (
                <RefreshCw data-icon="inline-start" />
              )}
              Làm mới
            </Button>

            <Button asChild disabled={!canManage} variant="outline">
              <Link href="/suppliers/items">
                <Package data-icon="inline-start" />
                Gán mặt hàng NCC
              </Link>
            </Button>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button disabled={!canManage}>
                  <Plus data-icon="inline-start" />
                  Tạo nhà cung cấp
                </Button>
              </DialogTrigger>
              <DialogContent
                size="lg"
                className="max-h-[90vh] overflow-y-auto p-6"
              >
                <DialogHeader className="mb-5">
                  <DialogTitle>Tạo nhà cung cấp</DialogTitle>
                  <DialogDescription>Thêm nhà cung cấp mới</DialogDescription>
                </DialogHeader>
                <SupplierForm
                  autoSuggestCode={!createCodeManuallyEdited}
                  busy={createSupplierMutation.isPending}
                  disabled={!canManage}
                  form={createForm}
                  submitLabel="Tạo nhà cung cấp"
                  onChange={setCreateForm}
                  onCodeManualChange={() => setCreateCodeManuallyEdited(true)}
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

      {suppliersQuery.error ? (
        <ErrorBanner error={suppliersQuery.error} />
      ) : null}

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
                  <SelectTrigger className="h-9 w-full">
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
              <Button className="self-end" size="lg" type="submit">
                <Search data-icon="inline-start" />
                Lọc
              </Button>
            </form>

            {suppliersQuery.isLoading ? (
              <TableSkeleton columns={4} />
            ) : (
              <Table scrollable>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mã</TableHead>
                    <TableHead>Tên</TableHead>
                    <TableHead>Liên hệ</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="w-48 text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.length === 0 ? (
                    <EmptyRow colSpan={5} label="Chưa có nhà cung cấp." />
                  ) : (
                    suppliers.map((supplier) => (
                      <TableRow key={supplier.id} className="hover:bg-muted/35">
                        <TableCell className="font-medium">
                          {supplier.code}
                        </TableCell>
                        <TableCell>{supplier.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {supplier.contactName ||
                            supplier.phone ||
                            "Chưa khai"}
                        </TableCell>
                        <TableCell>
                          {supplier.status === "BLACKLIST" ? (
                            <div className="space-y-1">
                              <StatusBadge tone={statusTone(supplier.status)}>
                                {statusLabel(supplier.status)}
                              </StatusBadge>
                              <Button
                                className="block h-auto px-0 text-xs text-muted-foreground"
                                disabled={
                                  !canDelete || changeStatusMutation.isPending
                                }
                                onClick={() =>
                                  handleToggleActive(supplier, true)
                                }
                                size="sm"
                                type="button"
                                variant="link"
                              >
                                Gỡ blacklist
                              </Button>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Switch
                                  aria-label={`Chuyển trạng thái nhà cung cấp ${supplier.name}`}
                                  checked={supplier.status === "ACTIVE"}
                                  disabled={
                                    !canManage ||
                                    changeStatusMutation.isPending
                                  }
                                  onCheckedChange={(checked) =>
                                    handleToggleActive(supplier, checked)
                                  }
                                />
                                <span className="text-sm text-muted-foreground">
                                  {statusLabel(supplier.status)}
                                </span>
                              </div>
                              <Button
                                className="block h-auto px-0 text-xs text-muted-foreground hover:text-destructive"
                                disabled={
                                  !canManage || changeStatusMutation.isPending
                                }
                                onClick={() => setBlacklistTarget(supplier)}
                                size="sm"
                                type="button"
                                variant="link"
                              >
                                Đưa vào blacklist
                              </Button>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button
                              aria-label={`Xem chi tiết nhà cung cấp ${supplier.name}`}
                              disabled={!canManage}
                              onClick={() => setViewingSupplier(supplier)}
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              <Eye data-icon="inline-start" />
                              Xem chi tiết
                            </Button>
                            <Button
                              aria-label={`Sửa nhà cung cấp ${supplier.name}`}
                              disabled={!canManage}
                              onClick={() => setEditingSupplier(supplier)}
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              <Pencil data-icon="inline-start" />
                              Sửa
                            </Button>
                            <Button
                              disabled={!canDelete}
                              onClick={() => setDeleteSupplierTarget(supplier)}
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
      <Dialog
        open={Boolean(viewingSupplier)}
        onOpenChange={(open) => !open && setViewingSupplier(null)}
      >
        <DialogContent size="lg" className="max-h-[90vh] overflow-y-auto p-0">
          {viewingSupplier ? (
            <SupplierViewContent
              canManage={canManage}
              summary={viewingSupplier}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editingSupplier)}
        onOpenChange={(open) => !open && setEditingSupplier(null)}
      >
        <DialogContent size="lg" className="max-h-[90vh] overflow-y-auto p-0">
          {editingSupplier ? (
            <SupplierEditContent
              canManage={canManage}
              summary={editingSupplier}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(blacklistTarget)}
        onOpenChange={(open) => !open && setBlacklistTarget(null)}
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
              onClick={handleConfirmBlacklist}
              type="button"
              variant="destructive"
            >
              Xác nhận
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteSupplierTarget)}
        onOpenChange={(open) => !open && setDeleteSupplierTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa nhà cung cấp?</DialogTitle>
            <DialogDescription>
              Hành động này chỉ dùng khi dữ liệu nhà cung cấp không còn cần quản
              lý trong WMS.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Hủy
              </Button>
            </DialogClose>
            <Button
              disabled={
                !deleteSupplierTarget || deleteSupplierMutation.isPending
              }
              onClick={() => {
                if (deleteSupplierTarget) {
                  deleteSupplierMutation.mutate(deleteSupplierTarget.id);
                }
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
    </div>
  );
}

function SupplierViewContent({
  canManage,
  summary,
}: {
  canManage: boolean;
  summary: Supplier;
}) {
  const detailQuery = useQuery({
    enabled: canManage,
    queryFn: () => getSupplier(summary.id),
    queryKey: supplierKeys.detail(summary.id),
  });
  const supplier = detailQuery.data;

  return (
    <>
      <DialogHeader className="border-b bg-muted/20 px-6 py-4">
        <DialogTitle>{supplier?.name ?? summary.name}</DialogTitle>
        <DialogDescription>{supplier?.code ?? summary.code}</DialogDescription>
      </DialogHeader>
      <div className="p-4">
        {detailQuery.isLoading ? (
          <div
            aria-label="Đang tải chi tiết nhà cung cấp"
            className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground"
            role="status"
          >
            <LoaderCircle className="size-4 animate-spin" />
            Đang tải chi tiết nhà cung cấp...
          </div>
        ) : null}
        {detailQuery.error ? (
          <div className="space-y-3">
            <ErrorBanner error={detailQuery.error} />
            <Button
              onClick={() => void detailQuery.refetch()}
              type="button"
              variant="outline"
            >
              <RefreshCw data-icon="inline-start" />
              Thử lại
            </Button>
          </div>
        ) : null}
        {supplier ? <SupplierViewFields supplier={supplier} /> : null}
      </div>
    </>
  );
}

function SupplierViewFields({ supplier }: { supplier: Supplier }) {
  const fields: Array<{ label: string; value: string }> = [
    { label: "Mã NCC", value: supplier.code },
    { label: "Tên NCC", value: supplier.name },
    { label: "Người liên hệ", value: supplier.contactName || "Chưa khai" },
    { label: "Số điện thoại", value: supplier.phone || "Chưa khai" },
    { label: "Email", value: supplier.email || "Chưa khai" },
    { label: "Mã số thuế", value: supplier.taxCode || "Chưa khai" },
    { label: "Địa chỉ", value: supplier.address || "Chưa khai" },
    { label: "Ghi chú", value: supplier.note || "Chưa khai" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          Trạng thái
        </span>
        <StatusBadge tone={statusTone(supplier.status)}>
          {statusLabel(supplier.status)}
        </StatusBadge>
      </div>
      <dl className="grid gap-3 md:grid-cols-2">
        {fields.map((field) => (
          <div className="space-y-1" key={field.label}>
            <dt className="text-sm text-muted-foreground">{field.label}</dt>
            <dd className="text-sm font-medium">{field.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function SupplierEditContent({
  canManage,
  summary,
}: {
  canManage: boolean;
  summary: Supplier;
}) {
  const queryClient = useQueryClient();
  const detailQuery = useQuery({
    enabled: canManage,
    queryFn: () => getSupplier(summary.id),
    queryKey: supplierKeys.detail(summary.id),
  });
  const supplier = detailQuery.data;

  const [editForm, setEditForm] = useState({
    address: summary.address ?? "",
    code: summary.code,
    contactName: summary.contactName ?? "",
    email: summary.email ?? "",
    name: summary.name,
    note: summary.note ?? "",
    phone: summary.phone ?? "",
    taxCode: summary.taxCode ?? "",
  });

  const updateSupplierMutation = useMutation({
    mutationFn: () => updateSupplier(summary.id, supplierPayload(editForm)),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: (updatedSupplier) => {
      queryClient.setQueryData(
        supplierKeys.detail(summary.id),
        updatedSupplier,
      );
      void queryClient.invalidateQueries({ queryKey: ["suppliers", "list"] });
      toast.success("Đã cập nhật nhà cung cấp");
    },
  });

  function handleUpdateSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateSupplierMutation.mutate();
  }

  return (
    <>
      <DialogHeader className="border-b bg-muted/20 px-6 py-4">
        <DialogTitle>{supplier?.name ?? summary.name}</DialogTitle>
        <DialogDescription>{supplier?.code ?? summary.code}</DialogDescription>
      </DialogHeader>
      <div className="p-4">
        {detailQuery.isLoading ? (
          <div
            aria-label="Đang tải chi tiết nhà cung cấp"
            className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground"
            role="status"
          >
            <LoaderCircle className="size-4 animate-spin" />
            Đang tải chi tiết nhà cung cấp...
          </div>
        ) : null}
        {detailQuery.error ? (
          <div className="space-y-3">
            <ErrorBanner error={detailQuery.error} />
            <Button
              onClick={() => void detailQuery.refetch()}
              type="button"
              variant="outline"
            >
              <RefreshCw data-icon="inline-start" />
              Thử lại
            </Button>
          </div>
        ) : null}
        {supplier ? (
          <SupplierForm
            busy={updateSupplierMutation.isPending}
            disabled={!canManage}
            form={editForm}
            submitLabel="Lưu nhà cung cấp"
            onChange={setEditForm}
            onSubmit={handleUpdateSupplier}
          />
        ) : null}
      </div>
    </>
  );
}

function SupplierForm({
  autoSuggestCode = false,
  busy,
  disabled,
  form,
  onChange,
  onCodeManualChange,
  onSubmit,
  submitLabel,
}: {
  autoSuggestCode?: boolean;
  busy: boolean;
  disabled: boolean;
  form: typeof defaultSupplierForm;
  onChange: (form: typeof defaultSupplierForm) => void;
  onCodeManualChange?: () => void;
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
          onChange={(value) => {
            onCodeManualChange?.();
            onChange({ ...form, code: value });
          }}
        />
        <TextField
          id={`${submitLabel}-name`}
          label="Tên NCC"
          value={form.name}
          onChange={(value) =>
            onChange({
              ...form,
              code: autoSuggestCode ? suggestSupplierCode(value) : form.code,
              name: value,
            })
          }
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
          onChange={(event) =>
            onChange({ ...form, address: event.target.value })
          }
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

