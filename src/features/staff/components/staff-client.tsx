"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  UnlockKeyhole,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
import {
  EmptyState,
  EntityDrawer,
  PageHeader,
  PermissionNotice,
  StatusBadge,
  TablePanel,
} from "@/features/admin-shell/components/operations-ui";
import {
  createWmsUser,
  deleteWmsUser,
  getWmsUser,
  listWmsUsers,
  lockWmsUser,
  resetWmsUserPassword,
  unlockWmsUser,
  updateWmsUser,
  updateWmsUserRole,
} from "@/features/staff/services/staff.service";
import { useSessionUser } from "@/hooks/use-session-user";
import { getApiErrorMessage } from "@/lib/api-contract";
import {
  hasAnyRole,
  normalizeRoles,
  ROLE_LABELS,
  WMS_ROLES,
  type WmsRole,
} from "@/lib/rbac";
import type {
  CreateUserInput,
  ListWmsUsersQuery,
  UpdateUserInput,
  WmsUserResponse,
  WmsUserStatus,
} from "@/types/api";

type StaffListRow = WmsUserResponse;
type StaffStatusFilter = "ALL" | WmsUserStatus;
type StaffRoleFilter = "ALL" | WmsRole;

const PAGE_SIZE = 20;
const staffKeys = {
  all: ["staff"] as const,
  list: (query: ListWmsUsersQuery) =>
    [...staffKeys.all, "list", query] as const,
  detail: (userId: string) => [...staffKeys.all, "detail", userId] as const,
};
const defaultCreateForm = {
  email: "",
  name: "",
  password: "",
  role: "RECEIVER" as WmsRole,
  username: "",
};
const defaultFilters = {
  role: "ALL" as StaffRoleFilter,
  search: "",
  status: "ALL" as StaffStatusFilter,
  warehouseId: "",
};
const defaultProfile = { email: "", name: "", warehouseId: "" };

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function formatError(error: unknown) {
  return getApiErrorMessage(error) ?? "Không kết nối được WMS.";
}

function buildCreatePayload(
  form: typeof defaultCreateForm,
  role: WmsRole,
): CreateUserInput {
  return {
    email: optionalText(form.email),
    name: optionalText(form.name),
    password: form.password,
    role,
    username: form.username.trim(),
  };
}

function formatRole(role: string | undefined, legacyRoles?: readonly string[]) {
  const normalized = normalizeRoles(role ?? legacyRoles);
  return normalized.length > 0
    ? normalized.map((role) => ROLE_LABELS[role]).join(", ")
    : role || legacyRoles?.join(", ") || "Chưa phân quyền";
}

function formatDate(value: string | undefined) {
  if (!value) return "Chưa có";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("vi-VN").format(date);
}

function initials(name: string | undefined) {
  return (name ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-border/60 py-3 sm:grid-cols-[150px_1fr] sm:items-center">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-sm font-semibold">{value}</span>
    </div>
  );
}
function RoleSelect({
  availableRoles,
  id,
  label,
  onChange,
  role,
}: {
  availableRoles: readonly WmsRole[];
  id: string;
  label: string;
  onChange: (role: WmsRole) => void;
  role: WmsRole;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={role}
        onValueChange={(value) => onChange(value as WmsRole)}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {availableRoles.map((availableRole) => (
            <SelectItem key={availableRole} value={availableRole}>
              {ROLE_LABELS[availableRole]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function TextField({
  id,
  label,
  onChange,
  required = true,
  type = "text",
  value,
}: {
  id: string;
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  value: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        autoComplete="off"
        id={id}
        required={required}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

export function StaffClient() {
  const user = useSessionUser();
  const isAdmin = hasAnyRole(user?.roles, ["ADMIN"]);
  const canAccessStaff = hasAnyRole(user?.roles, ["ADMIN", "MANAGER"]);
  const availableRoles = useMemo(
    () => WMS_ROLES.filter((role) => isAdmin || role !== "ADMIN"),
    [isAdmin],
  );
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filterDraft, setFilterDraft] = useState(defaultFilters);
  const [filters, setFilters] = useState(defaultFilters);
  const query = useMemo<ListWmsUsersQuery>(
    () => ({
      limit: PAGE_SIZE,
      page,
      role: filters.role === "ALL" ? undefined : filters.role,
      search: optionalText(filters.search),
      status: filters.status === "ALL" ? undefined : filters.status,
      warehouseId: optionalText(filters.warehouseId),
    }),
    [filters, page],
  );
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const staffQuery = useQuery({
    enabled: canAccessStaff,
    queryFn: () => listWmsUsers(query),
    queryKey: staffKeys.list(query),
  });
  const staffDetailQuery = useQuery({
    enabled: canAccessStaff && Boolean(selectedStaffId),
    queryFn: () => getWmsUser(selectedStaffId as string),
    queryKey: staffKeys.detail(selectedStaffId ?? ""),
  });
  const staffRows = staffQuery.data?.data ?? [];
  const total = staffQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState(defaultCreateForm);
  const [editingStaff, setEditingStaff] = useState<StaffListRow | null>(null);
  const [deletingStaff, setDeletingStaff] = useState<StaffListRow | null>(null);
  const [editProfile, setEditProfile] = useState(defaultProfile);
  const [editRole, setEditRole] = useState<WmsRole>("RECEIVER");
  const [temporaryPassword, setTemporaryPassword] =
    useState("TempP@ssw0rd123!");

  const selectedCreateRole = availableRoles.includes(createForm.role)
    ? createForm.role
    : (availableRoles[0] ?? "RECEIVER");
  const createFormValid =
    createForm.username.trim().length >= 3 &&
    createForm.password.length >= 8 &&
    availableRoles.length > 0;

  function canManageTarget(staff: StaffListRow) {
    return (
      isAdmin || !normalizeRoles(staff.role ?? staff.roles).includes("ADMIN")
    );
  }

  async function refreshStaff() {
    await queryClient.invalidateQueries({ queryKey: staffKeys.all });
  }

  function openStaffEditor(staff: StaffListRow) {
    if (!canManageTarget(staff)) return;
    const role = normalizeRoles(staff.role ?? staff.roles).find((candidate) =>
      availableRoles.includes(candidate),
    );
    setEditingStaff(staff);
    setEditProfile({
      email: staff.email ?? "",
      name: staff.name ?? "",
      warehouseId: staff.warehouseId ?? "",
    });
    setEditRole(role ?? "RECEIVER");
    setTemporaryPassword("TempP@ssw0rd123!");
  }

  const createUserMutation = useMutation({
    mutationFn: createWmsUser,
    onError: (error) => toast.error(formatError(error)),
    onSuccess: async () => {
      setCreateForm(defaultCreateForm);
      setCreateDialogOpen(false);
      await refreshStaff();
      toast.success("Đã tạo nhân viên");
    },
  });

  const saveStaffMutation = useMutation({
    mutationFn: async ({
      profile,
      role,
      staff,
    }: {
      profile: UpdateUserInput;
      role: WmsRole;
      staff: StaffListRow;
    }) => {
      await updateWmsUser(staff.id, profile);
      await updateWmsUserRole(staff.id, { role });
    },
    onError: (error) => toast.error(formatError(error)),
    onSuccess: async () => {
      setEditingStaff(null);
      await refreshStaff();
      toast.success("Đã cập nhật nhân viên");
    },
  });

  const lockStatusMutation = useMutation({
    mutationFn: ({
      nextStatus,
      staff,
    }: {
      nextStatus: WmsUserStatus;
      staff: StaffListRow;
    }) =>
      nextStatus === "LOCKED" ? lockWmsUser(staff.id) : unlockWmsUser(staff.id),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: async (response) => {
      await refreshStaff();
      toast.success(
        response.status === "LOCKED" ? "Đã khóa nhân viên" : "Đã mở khóa",
      );
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (staff: StaffListRow) =>
      resetWmsUserPassword(staff.id, { temporaryPassword }),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: async () => {
      await refreshStaff();
      toast.success("Đã đặt lại mật khẩu");
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: deleteWmsUser,
    onError: (error) => toast.error(formatError(error)),
    onSuccess: async () => {
      setDeletingStaff(null);
      setEditingStaff(null);
      await refreshStaff();
      toast.success("Đã xóa nhân viên");
    },
  });

  function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createUserMutation.mutate(
      buildCreatePayload(createForm, selectedCreateRole),
    );
  }

  function handleFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setFilters(filterDraft);
  }

  function handleSaveStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingStaff || !canManageTarget(editingStaff)) return;
    saveStaffMutation.mutate({
      profile: {
        email: optionalText(editProfile.email),
        name: optionalText(editProfile.name),
        warehouseId: optionalText(editProfile.warehouseId),
      },
      role: editRole,
      staff: editingStaff,
    });
  }

  const editBusy =
    saveStaffMutation.isPending ||
    lockStatusMutation.isPending ||
    resetPasswordMutation.isPending ||
    deleteUserMutation.isPending;
  const busyStaffId =
    lockStatusMutation.variables?.staff.id ??
    resetPasswordMutation.variables?.id ??
    saveStaffMutation.variables?.staff.id ??
    deleteUserMutation.variables;

  if (!canAccessStaff) {
    return (
      <PermissionNotice>
        Bạn cần quyền Admin hoặc Manager để quản lý tài khoản nhân viên.
      </PermissionNotice>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Nhân viên"
        actions={
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus data-icon="inline-start" />
                Tạo nhân viên
              </Button>
            </DialogTrigger>
            <DialogContent size="3xl" className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Tạo tài khoản WMS</DialogTitle>
                <DialogDescription>
                  Tạo tài khoản nhân viên và thiết lập vai trò truy cập ban đầu.
                </DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={handleCreateUser}>
                <div className="grid gap-3 md:grid-cols-2">
                  <TextField
                    id="staff-username"
                    label="Tên đăng nhập"
                    value={createForm.username}
                    onChange={(username) =>
                      setCreateForm((current) => ({ ...current, username }))
                    }
                  />
                  <TextField
                    id="staff-password"
                    label="Mật khẩu tạm"
                    type="password"
                    value={createForm.password}
                    onChange={(password) =>
                      setCreateForm((current) => ({ ...current, password }))
                    }
                  />
                  <TextField
                    id="staff-email"
                    label="Email"
                    required={false}
                    type="email"
                    value={createForm.email}
                    onChange={(email) =>
                      setCreateForm((current) => ({ ...current, email }))
                    }
                  />
                  <TextField
                    id="staff-name"
                    label="Tên hiển thị"
                    required={false}
                    value={createForm.name}
                    onChange={(name) =>
                      setCreateForm((current) => ({ ...current, name }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <RoleSelect
                    availableRoles={availableRoles}
                    id="create-role"
                    label="Vai trò khi tạo nhân viên"
                    role={selectedCreateRole}
                    onChange={(role) =>
                      setCreateForm((current) => ({ ...current, role }))
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
                    disabled={!createFormValid || createUserMutation.isPending}
                    type="submit"
                  >
                    {createUserMutation.isPending ? (
                      <LoaderCircle
                        className="animate-spin"
                        data-icon="inline-start"
                      />
                    ) : (
                      <UserPlus data-icon="inline-start" />
                    )}
                    Tạo nhân viên
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <TablePanel
        count={`${total} bản ghi · trang ${page}/${totalPages}`}
        title={
          <span className="flex items-center gap-2">
            <UsersRound className="size-4 text-primary" />
            Danh sách nhân viên
          </span>
        }
      >
        <form
          className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_170px_170px_190px_auto]"
          onSubmit={handleFilter}
        >
          <div className="space-y-2">
            <Label htmlFor="staff-search">Tìm kiếm</Label>
            <Input
              id="staff-search"
              placeholder="Tên, username hoặc email"
              value={filterDraft.search}
              onChange={(event) =>
                setFilterDraft((current) => ({
                  ...current,
                  search: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Trạng thái</Label>
            <Select
              value={filterDraft.status}
              onValueChange={(status) =>
                setFilterDraft((current) => ({
                  ...current,
                  status: status as StaffStatusFilter,
                }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tất cả</SelectItem>
                <SelectItem value="ACTIVE">Đang hoạt động</SelectItem>
                <SelectItem value="LOCKED">Đã khóa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Vai trò</Label>
            <Select
              value={filterDraft.role}
              onValueChange={(role) =>
                setFilterDraft((current) => ({
                  ...current,
                  role: role as StaffRoleFilter,
                }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tất cả</SelectItem>
                {WMS_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <TextField
            id="staff-warehouse-filter"
            label="Mã kho"
            required={false}
            value={filterDraft.warehouseId}
            onChange={(warehouseId) =>
              setFilterDraft((current) => ({ ...current, warehouseId }))
            }
          />
          <Button className="self-end" type="submit">
            <Search data-icon="inline-start" />
            Lọc
          </Button>
        </form>

        {staffQuery.isLoading ? (
          <EmptyState title="Đang tải danh sách nhân viên" />
        ) : staffQuery.isError ? (
          <EmptyState
            title="Không tải được danh sách nhân viên"
            description={formatError(staffQuery.error)}
          />
        ) : staffRows.length === 0 ? (
          <EmptyState title="Không có nhân viên phù hợp" />
        ) : (
          <Table scrollable>
            <TableHeader>
              <TableRow>
                <TableHead>Nhân viên</TableHead>
                <TableHead>Vai trò</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Yêu cầu đổi mật khẩu</TableHead>
                <TableHead>Cập nhật</TableHead>
                <TableHead className="w-72 text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffRows.map((staff) => {
                const protectedTarget = !canManageTarget(staff);
                const isSelf = staff.id === user?.id;
                const isBusy = busyStaffId === staff.id && editBusy;
                const nextStatus =
                  staff.status === "LOCKED" ? "ACTIVE" : "LOCKED";
                return (
                  <TableRow key={staff.id}>
                    <TableCell className="font-medium">
                      {staff.name || "Chưa khai báo"}
                    </TableCell>
                    <TableCell>{formatRole(staff.role, staff.roles)}</TableCell>
                    <TableCell>
                      <StatusBadge
                        tone={staff.status === "ACTIVE" ? "success" : "danger"}
                      >
                        {staff.status === "ACTIVE"
                          ? "Đang hoạt động"
                          : "Đã khóa"}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        tone={staff.mustChangePassword ? "warning" : "neutral"}
                      >
                        {staff.mustChangePassword ? "Cần đổi" : "Ổn định"}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>{formatDate(staff.updatedAt)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          aria-label={`Xem chi tiết ${staff.name || "nhân viên"}`}
                          onClick={() => setSelectedStaffId(staff.id)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          <Eye data-icon="inline-start" />
                          Xem chi tiết
                        </Button>
                        <Button
                          disabled={editBusy || protectedTarget}
                          onClick={() => openStaffEditor(staff)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          <Pencil data-icon="inline-start" />
                          Sửa
                        </Button>
                        <Button
                          disabled={isBusy || protectedTarget}
                          onClick={() =>
                            lockStatusMutation.mutate({ nextStatus, staff })
                          }
                          size="sm"
                          type="button"
                          variant={
                            staff.status === "LOCKED"
                              ? "outline"
                              : "destructive"
                          }
                        >
                          {isBusy ? (
                            <LoaderCircle
                              className="animate-spin"
                              data-icon="inline-start"
                            />
                          ) : staff.status === "LOCKED" ? (
                            <UnlockKeyhole data-icon="inline-start" />
                          ) : (
                            <LockKeyhole data-icon="inline-start" />
                          )}
                          {staff.status === "LOCKED" ? "Mở" : "Khóa"}
                        </Button>
                        <Button
                          aria-label={`Xóa ${staff.username}`}
                          disabled={editBusy || protectedTarget || isSelf}
                          onClick={() => setDeletingStaff(staff)}
                          size="icon-sm"
                          type="button"
                          variant="ghost"
                        >
                          <Trash2 />
                        </Button>
                      </div>
                      {protectedTarget ? (
                        <p className="mt-2 text-right text-xs text-muted-foreground">
                          Chỉ Admin có thể thao tác tài khoản Admin.
                        </p>
                      ) : null}
                      {isSelf ? (
                        <p className="mt-2 text-right text-xs text-muted-foreground">
                          Không thể tự xóa tài khoản đang đăng nhập.
                        </p>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-border/70 pt-4">
          <Button
            aria-label="Trang trước"
            disabled={page <= 1 || staffQuery.isFetching}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            size="icon-sm"
            type="button"
            variant="outline"
          >
            <ChevronLeft />
          </Button>
          <span className="min-w-16 text-center text-sm text-muted-foreground">
            {page}/{totalPages}
          </span>
          <Button
            aria-label="Trang sau"
            disabled={page >= totalPages || staffQuery.isFetching}
            onClick={() =>
              setPage((current) => Math.min(totalPages, current + 1))
            }
            size="icon-sm"
            type="button"
            variant="outline"
          >
            <ChevronRight />
          </Button>
        </div>
      </TablePanel>

      <EntityDrawer
        description={staffDetailQuery.data?.name || "Thông tin tài khoản WMS"}
        onOpenChange={(open) => !open && setSelectedStaffId(null)}
        open={Boolean(selectedStaffId)}
        title="Chi tiết nhân viên"
      >
        {staffDetailQuery.isLoading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            Đang tải thông tin nhân viên...
          </div>
        ) : staffDetailQuery.isError ? (
          <EmptyState
            title="Không tải được chi tiết nhân viên"
            description={formatError(staffDetailQuery.error)}
          />
        ) : staffDetailQuery.data ? (
          <div>
            <div className="mb-4 flex items-center gap-4 rounded-lg border border-border/70 bg-muted/20 p-4">
              <Avatar className="size-16">
                {staffDetailQuery.data.avatarUrl ? (
                  <AvatarImage
                    alt={
                      staffDetailQuery.data.name ||
                      staffDetailQuery.data.username
                    }
                    src={staffDetailQuery.data.avatarUrl}
                  />
                ) : null}
                <AvatarFallback className="text-base font-semibold">
                  {initials(
                    staffDetailQuery.data.name ||
                      staffDetailQuery.data.username,
                  ) || "WM"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="truncate text-base font-semibold">
                  {staffDetailQuery.data.name || "Chưa khai báo"}
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatRole(
                    staffDetailQuery.data.role,
                    staffDetailQuery.data.roles,
                  )}
                </div>
              </div>
            </div>
            <DetailRow
              label="Mã nhân viên / ID"
              value={staffDetailQuery.data.id}
            />
            <DetailRow
              label="Tên đăng nhập"
              value={staffDetailQuery.data.username}
            />
            <DetailRow
              label="Tên hiển thị"
              value={staffDetailQuery.data.name || "Chưa khai báo"}
            />
            <DetailRow
              label="Email"
              value={staffDetailQuery.data.email || "Chưa khai báo"}
            />
            <DetailRow
              label="Vai trò"
              value={formatRole(
                staffDetailQuery.data.role,
                staffDetailQuery.data.roles,
              )}
            />
            <DetailRow
              label="Kho phụ trách"
              value={staffDetailQuery.data.warehouseId || "Chưa gán kho"}
            />
            <DetailRow
              label="Trạng thái"
              value={
                staffDetailQuery.data.status === "ACTIVE"
                  ? "Đang hoạt động"
                  : "Đã khóa"
              }
            />
            <DetailRow
              label="Yêu cầu đổi mật khẩu"
              value={staffDetailQuery.data.mustChangePassword ? "Có" : "Không"}
            />
            <DetailRow
              label="Ngày tạo"
              value={formatDate(staffDetailQuery.data.createdAt)}
            />
            <DetailRow
              label="Cập nhật"
              value={formatDate(staffDetailQuery.data.updatedAt)}
            />
          </div>
        ) : null}
      </EntityDrawer>
      <Dialog
        open={Boolean(editingStaff)}
        onOpenChange={(open) => !open && setEditingStaff(null)}
      >
        <DialogContent size="3xl" className="max-h-[90vh] overflow-y-auto">
          {editingStaff ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {editingStaff.name || editingStaff.username}
                </DialogTitle>
                <DialogDescription>
                  {editingStaff.username} · {editingStaff.id}
                </DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={handleSaveStaff}>
                <div className="grid gap-3 md:grid-cols-3">
                  <TextField
                    id="edit-staff-name"
                    label="Tên hiển thị"
                    required={false}
                    value={editProfile.name}
                    onChange={(name) =>
                      setEditProfile((current) => ({ ...current, name }))
                    }
                  />
                  <TextField
                    id="edit-staff-email"
                    label="Email"
                    required={false}
                    type="email"
                    value={editProfile.email}
                    onChange={(email) =>
                      setEditProfile((current) => ({ ...current, email }))
                    }
                  />
                  <TextField
                    id="edit-staff-warehouse"
                    label="Kho phụ trách"
                    required={false}
                    value={editProfile.warehouseId}
                    onChange={(warehouseId) =>
                      setEditProfile((current) => ({ ...current, warehouseId }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <RoleSelect
                    availableRoles={availableRoles}
                    id="edit-role"
                    label="Vai trò"
                    role={editRole}
                    onChange={setEditRole}
                  />
                </div>
                <div className="grid gap-3 rounded-lg border border-border/70 bg-muted/20 p-3 md:grid-cols-[1fr_auto_auto]">
                  <TextField
                    id="staff-temporary-password"
                    label="Mật khẩu tạm mới"
                    required={false}
                    type="password"
                    value={temporaryPassword}
                    onChange={setTemporaryPassword}
                  />
                  <Button
                    className="self-end"
                    disabled={editBusy || temporaryPassword.length < 8}
                    onClick={() => resetPasswordMutation.mutate(editingStaff)}
                    type="button"
                    variant="outline"
                  >
                    {resetPasswordMutation.isPending ? (
                      <LoaderCircle
                        className="animate-spin"
                        data-icon="inline-start"
                      />
                    ) : (
                      <KeyRound data-icon="inline-start" />
                    )}
                    Đặt lại mật khẩu
                  </Button>
                  <Button
                    className="self-end"
                    disabled={editBusy}
                    onClick={() =>
                      lockStatusMutation.mutate({
                        nextStatus:
                          editingStaff.status === "LOCKED"
                            ? "ACTIVE"
                            : "LOCKED",
                        staff: editingStaff,
                      })
                    }
                    type="button"
                    variant={
                      editingStaff.status === "LOCKED"
                        ? "outline"
                        : "destructive"
                    }
                  >
                    {lockStatusMutation.isPending ? (
                      <LoaderCircle
                        className="animate-spin"
                        data-icon="inline-start"
                      />
                    ) : editingStaff.status === "LOCKED" ? (
                      <UnlockKeyhole data-icon="inline-start" />
                    ) : (
                      <LockKeyhole data-icon="inline-start" />
                    )}
                    {editingStaff.status === "LOCKED" ? "Mở khóa" : "Khóa"}
                  </Button>
                </div>
                <DialogFooter>
                  <Button
                    disabled={editBusy || editingStaff.id === user?.id}
                    onClick={() => setDeletingStaff(editingStaff)}
                    type="button"
                    variant="destructive"
                  >
                    <Trash2 data-icon="inline-start" />
                    Xóa nhân viên
                  </Button>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">
                      Đóng
                    </Button>
                  </DialogClose>
                  <Button disabled={editBusy} type="submit">
                    {saveStaffMutation.isPending ? (
                      <LoaderCircle
                        className="animate-spin"
                        data-icon="inline-start"
                      />
                    ) : (
                      <Save data-icon="inline-start" />
                    )}
                    Lưu thay đổi
                  </Button>
                </DialogFooter>
              </form>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deletingStaff)}
        onOpenChange={(open) => !open && setDeletingStaff(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa nhân viên</DialogTitle>
            <DialogDescription>
              Tài khoản {deletingStaff?.username} sẽ bị xóa mềm và không còn
              đăng nhập được. Thao tác này không xóa lịch sử nghiệp vụ.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Hủy
              </Button>
            </DialogClose>
            <Button
              disabled={!deletingStaff || deleteUserMutation.isPending}
              onClick={() =>
                deletingStaff && deleteUserMutation.mutate(deletingStaff.id)
              }
              type="button"
              variant="destructive"
            >
              {deleteUserMutation.isPending ? (
                <LoaderCircle
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : (
                <Trash2 data-icon="inline-start" />
              )}
              Xóa nhân viên
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
