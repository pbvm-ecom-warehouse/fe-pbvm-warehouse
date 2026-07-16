"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Pencil,
  Plus,
  Save,
  Search,
  ShieldCheck,
  UnlockKeyhole,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  CreateUserResponse,
  WmsUserResponse,
  WmsUserStatus,
} from "@/types/api";
import {
  bootstrapAdmin,
  createWmsUser,
  lockWmsUser,
  resetWmsUserPassword,
  unlockWmsUser,
  updateWmsUserRoles,
} from "@/features/auth/services/auth.service";
import {
  EmptyState,
  PageHeader,
  PermissionNotice,
  StatusBadge,
  TablePanel,
} from "@/features/admin-shell/components/operations-ui";

type StaffListRow = WmsUserResponse & {
  source: "api" | "mock";
};

type StaffStatusFilter = "ALL" | WmsUserStatus;

const defaultCreateForm = {
  email: "",
  name: "",
  password: "",
  roles: ["RECEIVER"] as WmsRole[],
  username: "",
};

const MOCK_STAFF_ROWS: StaffListRow[] = [
  {
    createdAt: "2026-07-16T01:31:58.557Z",
    email: "admin@pbvm.local",
    id: "mock-admin-001",
    mustChangePassword: false,
    name: "Administrator",
    roles: ["ADMIN"],
    source: "mock",
    status: "ACTIVE",
    updatedAt: "2026-07-16T01:31:58.557Z",
    username: "admin",
    warehouseId: "central",
  },
  {
    createdAt: "2026-07-15T09:20:00.000Z",
    email: "receiver01@pbvm.local",
    id: "mock-receiver-001",
    mustChangePassword: true,
    name: "Nguyen Hoang Minh",
    roles: ["RECEIVER"],
    source: "mock",
    status: "ACTIVE",
    updatedAt: "2026-07-16T02:10:00.000Z",
    username: "receiver01",
    warehouseId: "central",
  },
  {
    createdAt: "2026-07-14T04:45:00.000Z",
    email: "picker02@pbvm.local",
    id: "mock-picker-002",
    mustChangePassword: false,
    name: "Tran Bao Chau",
    roles: ["PICKER"],
    source: "mock",
    status: "ACTIVE",
    updatedAt: "2026-07-15T12:05:00.000Z",
    username: "picker02",
    warehouseId: "central",
  },
  {
    createdAt: "2026-07-13T07:15:00.000Z",
    email: "printer01@pbvm.local",
    id: "mock-printer-001",
    mustChangePassword: false,
    name: "Le Anh Thu",
    roles: ["PRINTER"],
    source: "mock",
    status: "LOCKED",
    updatedAt: "2026-07-16T03:35:00.000Z",
    username: "printer01",
    warehouseId: "central",
  },
  {
    createdAt: "2026-07-12T08:00:00.000Z",
    email: "counter01@pbvm.local",
    id: "mock-counter-001",
    mustChangePassword: false,
    name: "Pham Quoc Bao",
    roles: ["COUNTER"],
    source: "mock",
    status: "ACTIVE",
    updatedAt: "2026-07-14T10:30:00.000Z",
    username: "counter01",
    warehouseId: "central",
  },
];

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function formatError(error: unknown) {
  return getApiErrorMessage(error) ?? "Không kết nối được WMS.";
}

function buildCreatePayload(
  form: typeof defaultCreateForm,
  roles: readonly WmsRole[],
): CreateUserInput {
  return {
    email: optionalText(form.email),
    name: optionalText(form.name),
    password: form.password,
    roles: [...roles],
    username: form.username.trim(),
  };
}

function toggleRole(current: readonly WmsRole[], role: WmsRole) {
  return current.includes(role)
    ? current.filter((currentRole) => currentRole !== role)
    : [...current, role];
}

function formatRoles(roles: readonly string[]) {
  const normalized = normalizeRoles(roles);

  if (normalized.length > 0) {
    return normalized.map((role) => ROLE_LABELS[role]).join(", ");
  }

  return roles.length > 0 ? roles.join(", ") : "Chưa phân quyền";
}

function formatDate(value: string | undefined) {
  if (!value) {
    return "Chưa có";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("vi-VN").format(date);
}

function staffRowFromCreateResponse(
  response: CreateUserResponse,
  form: typeof defaultCreateForm,
): StaffListRow {
  const now = new Date().toISOString();

  return {
    createdAt: now,
    email: response.email ?? optionalText(form.email),
    id: response.id,
    mustChangePassword: response.mustChangePassword,
    name: optionalText(form.name) ?? response.username,
    roles: response.roles,
    source: "api",
    status: "ACTIVE",
    updatedAt: now,
    username: response.username,
    warehouseId: undefined,
  };
}

function RoleCheckboxes({
  idPrefix,
  onChange,
  roles,
}: {
  idPrefix: string;
  onChange: (roles: WmsRole[]) => void;
  roles: readonly WmsRole[];
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {WMS_ROLES.map((role) => {
        const id = `${idPrefix}-${role.toLowerCase()}`;

        return (
          <Label
            className="flex items-center gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm font-medium"
            htmlFor={id}
            key={role}
          >
            <Checkbox
              checked={roles.includes(role)}
              id={id}
              onCheckedChange={() => onChange(toggleRole(roles, role))}
            />
            {ROLE_LABELS[role]}
          </Label>
        );
      })}
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate font-medium">{value}</span>
    </div>
  );
}

export function StaffClient() {
  const user = useSessionUser();
  const isAdmin = hasAnyRole(user?.roles, ["ADMIN"]);
  const [staffRows, setStaffRows] = useState<StaffListRow[]>(MOCK_STAFF_ROWS);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StaffStatusFilter>("ALL");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState(defaultCreateForm);
  const [editingStaff, setEditingStaff] = useState<StaffListRow | null>(null);
  const [editRoles, setEditRoles] = useState<WmsRole[]>(["RECEIVER"]);
  const [temporaryPassword, setTemporaryPassword] =
    useState("TempP@ssw0rd123!");

  const selectedCreateRoles = useMemo(
    () => createForm.roles.filter((role) => WMS_ROLES.includes(role)),
    [createForm.roles],
  );

  const filteredStaffRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return staffRows.filter((staff) => {
      const matchesStatus =
        statusFilter === "ALL" || staff.status === statusFilter;
      const haystack = [
        staff.id,
        staff.username,
        staff.name,
        staff.email,
        staff.warehouseId,
        formatRoles(staff.roles),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesStatus && haystack.includes(normalizedSearch);
    });
  }, [search, staffRows, statusFilter]);

  const createFormValid =
    createForm.username.trim().length >= 3 &&
    createForm.password.length >= 8 &&
    selectedCreateRoles.length > 0;

  function upsertStaffRow(nextRow: StaffListRow) {
    setStaffRows((current) =>
      current.some((row) => row.id === nextRow.id)
        ? current.map((row) => (row.id === nextRow.id ? nextRow : row))
        : [nextRow, ...current],
    );
    setEditingStaff((current) =>
      current?.id === nextRow.id ? nextRow : current,
    );
  }

  function applyCreatedUser(response: CreateUserResponse, message: string) {
    const nextRow = staffRowFromCreateResponse(response, createForm);
    upsertStaffRow(nextRow);
    setCreateForm(defaultCreateForm);
    setCreateDialogOpen(false);
    toast.success(message);
  }

  function openStaffEditor(staff: StaffListRow) {
    const roles = normalizeRoles(staff.roles);

    setEditingStaff(staff);
    setEditRoles(roles.length > 0 ? roles : ["RECEIVER"]);
    setTemporaryPassword("TempP@ssw0rd123!");
  }

  const bootstrapMutation = useMutation({
    mutationFn: (input: CreateUserInput) => bootstrapAdmin(input),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: (response) => applyCreatedUser(response, "Đã bootstrap admin"),
  });

  const createUserMutation = useMutation({
    mutationFn: (input: CreateUserInput) => createWmsUser(input),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: (response) => applyCreatedUser(response, "Đã tạo nhân viên"),
  });

  const updateRolesMutation = useMutation({
    mutationFn: async (staff: StaffListRow) => {
      if (staff.source === "mock") {
        return {
          ...staff,
          roles: editRoles,
          updatedAt: new Date().toISOString(),
        } satisfies StaffListRow;
      }

      const response = await updateWmsUserRoles(staff.id, { roles: editRoles });

      return { ...response, source: staff.source } satisfies StaffListRow;
    },
    onError: (error) => toast.error(formatError(error)),
    onSuccess: (response) => {
      upsertStaffRow(response);
      toast.success("Đã cập nhật vai trò");
    },
  });

  const lockStatusMutation = useMutation({
    mutationFn: async ({
      nextStatus,
      staff,
    }: {
      nextStatus: WmsUserStatus;
      staff: StaffListRow;
    }) => {
      if (staff.source === "mock") {
        return {
          ...staff,
          status: nextStatus,
          updatedAt: new Date().toISOString(),
        } satisfies StaffListRow;
      }

      const response =
        nextStatus === "LOCKED"
          ? await lockWmsUser(staff.id)
          : await unlockWmsUser(staff.id);

      return { ...response, source: staff.source } satisfies StaffListRow;
    },
    onError: (error) => toast.error(formatError(error)),
    onSuccess: (response) => {
      upsertStaffRow(response);
      toast.success(
        response.status === "LOCKED" ? "Đã khóa nhân viên" : "Đã mở khóa",
      );
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (staff: StaffListRow) => {
      if (staff.source === "mock") {
        return staff;
      }

      await resetWmsUserPassword(staff.id, { temporaryPassword });
      return staff;
    },
    onError: (error) => toast.error(formatError(error)),
    onSuccess: (staff) => {
      upsertStaffRow({
        ...staff,
        mustChangePassword: true,
        updatedAt: new Date().toISOString(),
      });
      toast.success("Đã đặt lại mật khẩu");
    },
  });

  function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createUserMutation.mutate(
      buildCreatePayload(createForm, selectedCreateRoles),
    );
  }

  function handleBootstrapAdmin() {
    bootstrapMutation.mutate(buildCreatePayload(createForm, ["ADMIN"]));
  }

  function handleUpdateRoles(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editingStaff) {
      updateRolesMutation.mutate(editingStaff);
    }
  }

  const isCreateBusy =
    bootstrapMutation.isPending || createUserMutation.isPending;
  const editBusy =
    updateRolesMutation.isPending ||
    lockStatusMutation.isPending ||
    resetPasswordMutation.isPending;
  const busyStaffId =
    lockStatusMutation.variables?.staff.id ??
    resetPasswordMutation.variables?.id ??
    updateRolesMutation.variables?.id;

  if (!isAdmin) {
    return (
      <PermissionNotice>
        Bạn cần quyền Admin để quản lý tài khoản nhân viên.
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
                  <Label>Vai trò khi tạo nhân viên</Label>
                  <RoleCheckboxes
                    idPrefix="create-role"
                    roles={selectedCreateRoles}
                    onChange={(roles) =>
                      setCreateForm((current) => ({ ...current, roles }))
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
                    disabled={!createFormValid || isCreateBusy}
                    onClick={handleBootstrapAdmin}
                    type="button"
                    variant="outline"
                  >
                    {bootstrapMutation.isPending ? (
                      <LoaderCircle
                        className="animate-spin"
                        data-icon="inline-start"
                      />
                    ) : (
                      <ShieldCheck data-icon="inline-start" />
                    )}
                    Bootstrap admin
                  </Button>
                  <Button
                    disabled={!createFormValid || isCreateBusy}
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
        count={`${filteredStaffRows.length}/${staffRows.length} bản ghi`}
        title={
          <span className="flex items-center gap-2">
            <UsersRound className="size-4 text-primary" />
            Danh sách nhân viên
          </span>
        }
      >
        <form
          className="grid gap-3 md:grid-cols-[1fr_180px_auto]"
          onSubmit={(event) => event.preventDefault()}
        >
          <div className="space-y-2">
            <Label htmlFor="staff-search">Tìm kiếm</Label>
            <Input
              id="staff-search"
              placeholder="Tên, username, email hoặc mã nhân viên"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Trạng thái</Label>
            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as StaffStatusFilter)
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
          <Button className="self-end" type="submit">
            <Search data-icon="inline-start" />
            Lọc
          </Button>
        </form>

        {filteredStaffRows.length === 0 ? (
          <EmptyState title="Không có nhân viên phù hợp" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nhân viên</TableHead>
                <TableHead>Liên hệ</TableHead>
                <TableHead>Vai trò</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Mật khẩu</TableHead>
                <TableHead>Cập nhật</TableHead>
                <TableHead className="w-48 text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStaffRows.length === 0 ? (
                <EmptyRow colSpan={7} label="Chưa có nhân viên." />
              ) : (
                filteredStaffRows.map((staff) => {
                  const isBusy = busyStaffId === staff.id && editBusy;
                  const nextStatus =
                    staff.status === "LOCKED" ? "ACTIVE" : "LOCKED";

                  return (
                    <TableRow key={staff.id}>
                      <TableCell className="font-medium">
                        <div>{staff.name || staff.username}</div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {staff.username} · {staff.id}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {staff.email ?? "Chưa khai báo"}
                      </TableCell>
                      <TableCell>{formatRoles(staff.roles)}</TableCell>
                      <TableCell>
                        <StatusBadge
                          tone={
                            staff.status === "ACTIVE" ? "success" : "danger"
                          }
                        >
                          {staff.status === "ACTIVE"
                            ? "Đang hoạt động"
                            : "Đã khóa"}
                        </StatusBadge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          tone={
                            staff.mustChangePassword ? "warning" : "neutral"
                          }
                        >
                          {staff.mustChangePassword ? "Cần đổi" : "Ổn định"}
                        </StatusBadge>
                      </TableCell>
                      <TableCell>{formatDate(staff.updatedAt)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            disabled={editBusy}
                            onClick={() => openStaffEditor(staff)}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            <Pencil data-icon="inline-start" />
                            Sửa
                          </Button>
                          <Button
                            disabled={isBusy}
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
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}
      </TablePanel>

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

              <form className="space-y-4" onSubmit={handleUpdateRoles}>
                <div className="grid gap-3 md:grid-cols-2">
                  <InfoRow
                    label="Email"
                    value={editingStaff.email ?? "Chưa khai báo"}
                  />
                  <InfoRow
                    label="Kho phụ trách"
                    value={editingStaff.warehouseId ?? "Chưa gán kho"}
                  />
                  <InfoRow
                    label="Trạng thái"
                    value={
                      editingStaff.status === "ACTIVE"
                        ? "Đang hoạt động"
                        : "Đã khóa"
                    }
                  />
                  <InfoRow
                    label="Cập nhật"
                    value={formatDate(editingStaff.updatedAt)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Vai trò</Label>
                  <RoleCheckboxes
                    idPrefix="edit-role"
                    roles={editRoles}
                    onChange={setEditRoles}
                  />
                </div>

                <div className="grid gap-3 rounded-lg border border-border/70 bg-muted/20 p-3 md:grid-cols-[1fr_auto_auto]">
                  <div className="space-y-2">
                    <Label htmlFor="staff-temporary-password">
                      Mật khẩu tạm mới
                    </Label>
                    <Input
                      autoComplete="new-password"
                      id="staff-temporary-password"
                      minLength={8}
                      type="password"
                      value={temporaryPassword}
                      onChange={(event) =>
                        setTemporaryPassword(event.target.value)
                      }
                    />
                  </div>
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
                  <DialogClose asChild>
                    <Button type="button" variant="outline">
                      Đóng
                    </Button>
                  </DialogClose>
                  <Button
                    disabled={editBusy || editRoles.length === 0}
                    type="submit"
                  >
                    {updateRolesMutation.isPending ? (
                      <LoaderCircle
                        className="animate-spin"
                        data-icon="inline-start"
                      />
                    ) : (
                      <Save data-icon="inline-start" />
                    )}
                    Lưu vai trò
                  </Button>
                </DialogFooter>
              </form>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
