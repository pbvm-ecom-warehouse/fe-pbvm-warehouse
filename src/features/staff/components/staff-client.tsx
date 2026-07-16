"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  UnlockKeyhole,
  UserPlus,
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
import { useSessionUser } from "@/hooks/use-session-user";
import { hasAnyRole, ROLE_LABELS, WMS_ROLES, type WmsRole } from "@/lib/rbac";
import type { CreateUserInput, CreateUserResponse } from "@/types/api";
import {
  bootstrapAdmin,
  createWmsUser,
  lockWmsUser,
  resetWmsUserPassword,
  unlockWmsUser,
  updateWmsUserRoles,
} from "@/features/auth/services/auth.service";
import {
  PageHeader,
  PermissionNotice,
} from "@/features/admin-shell/components/operations-ui";

const defaultCreateForm = {
  email: "",
  name: "",
  password: "",
  roles: ["RECEIVER"] as WmsRole[],
  username: "",
};

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function formatUnknownError(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Không kết nối được WMS.";
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

export function StaffClient() {
  const user = useSessionUser();
  const isAdmin = hasAnyRole(user?.roles, ["ADMIN"]);
  const [createForm, setCreateForm] = useState(defaultCreateForm);
  const [targetUserId, setTargetUserId] = useState("");
  const [targetRoles, setTargetRoles] = useState<WmsRole[]>(["RECEIVER"]);
  const [temporaryPassword, setTemporaryPassword] =
    useState("TempP@ssw0rd123!");
  const [lastCreatedUser, setLastCreatedUser] =
    useState<CreateUserResponse | null>(null);
  const [lastActionMessage, setLastActionMessage] = useState<string | null>(
    null,
  );

  const selectedCreateRoles = useMemo(
    () => createForm.roles.filter((role) => WMS_ROLES.includes(role)),
    [createForm.roles],
  );

  function applyCreatedUser(userResponse: CreateUserResponse, message: string) {
    setLastCreatedUser(userResponse);
    setTargetUserId(userResponse.id);
    setLastActionMessage(`${message}: ${userResponse.username}`);
    toast.success(message);
  }

  const bootstrapMutation = useMutation({
    mutationFn: (input: CreateUserInput) => bootstrapAdmin(input),
    onError: (error) => toast.error(formatUnknownError(error)),
    onSuccess: (response) => applyCreatedUser(response, "Đã bootstrap admin"),
  });

  const createUserMutation = useMutation({
    mutationFn: (input: CreateUserInput) => createWmsUser(input),
    onError: (error) => toast.error(formatUnknownError(error)),
    onSuccess: (response) => applyCreatedUser(response, "Đã tạo nhân viên"),
  });

  const updateRolesMutation = useMutation({
    mutationFn: () =>
      updateWmsUserRoles(targetUserId.trim(), { roles: targetRoles }),
    onError: (error) => toast.error(formatUnknownError(error)),
    onSuccess: (response) => {
      setLastActionMessage(`Đã cập nhật vai trò cho ${response.username}`);
      toast.success("Đã cập nhật vai trò");
    },
  });

  const lockMutation = useMutation({
    mutationFn: () => lockWmsUser(targetUserId.trim()),
    onError: (error) => toast.error(formatUnknownError(error)),
    onSuccess: (response) => {
      setLastActionMessage(`Đã khóa nhân viên ${response.username}`);
      toast.success("Đã khóa nhân viên");
    },
  });

  const unlockMutation = useMutation({
    mutationFn: () => unlockWmsUser(targetUserId.trim()),
    onError: (error) => toast.error(formatUnknownError(error)),
    onSuccess: (response) => {
      setLastActionMessage(`Đã mở khóa nhân viên: ${response.username}`);
      toast.success("Đã mở khóa nhân viên");
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: () =>
      resetWmsUserPassword(targetUserId.trim(), {
        temporaryPassword,
      }),
    onError: (error) => toast.error(formatUnknownError(error)),
    onSuccess: () => {
      setLastActionMessage(
        "Đã đặt lại mật khẩu tạm và bật yêu cầu đổi mật khẩu.",
      );
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
    updateRolesMutation.mutate();
  }

  const isCreateBusy =
    bootstrapMutation.isPending || createUserMutation.isPending;
  const isActionBusy =
    updateRolesMutation.isPending ||
    lockMutation.isPending ||
    unlockMutation.isPending ||
    resetPasswordMutation.isPending;
  const trimmedTargetUserId = targetUserId.trim();

  if (!isAdmin) {
    return (
      <PermissionNotice>
        Bạn cần quyền Admin để quản lý tài khoản nhân viên.
      </PermissionNotice>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Nhân viên" />

      <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="size-4 text-primary" />
              Tạo tài khoản WMS
            </CardTitle>
            <CardDescription>
              Tạo tài khoản nhân viên và thiết lập vai trò truy cập ban đầu.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleCreateUser}>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="staff-username">Tên đăng nhập</Label>
                  <Input
                    autoComplete="off"
                    id="staff-username"
                    minLength={3}
                    required
                    value={createForm.username}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        username: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="staff-password">Mật khẩu tạm</Label>
                  <Input
                    autoComplete="new-password"
                    id="staff-password"
                    minLength={8}
                    required
                    type="password"
                    value={createForm.password}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="staff-email">Email</Label>
                  <Input
                    autoComplete="off"
                    id="staff-email"
                    type="email"
                    value={createForm.email}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="staff-name">Tên hiển thị</Label>
                  <Input
                    autoComplete="off"
                    id="staff-name"
                    value={createForm.name}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                  />
                </div>
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

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  disabled={isCreateBusy}
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
                  Khởi tạo quản trị viên
                </Button>
                <Button disabled={isCreateBusy} type="submit">
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
              </div>
            </form>

            {lastCreatedUser ? (
              <div className="mt-4 rounded-lg border border-border/70 bg-muted/20 p-3 text-sm">
                <div className="font-semibold">Nhân viên vừa tạo</div>
                <div className="mt-2 grid gap-1 text-muted-foreground">
                  <div>Mã nhân viên: {lastCreatedUser.id}</div>
                  <div>Tên đăng nhập: {lastCreatedUser.username}</div>
                  <div>
                    Vai trò:{" "}
                    {lastCreatedUser.roles
                      .map((role) => ROLE_LABELS[role as WmsRole] ?? role)
                      .join(", ")}
                  </div>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="size-4 text-primary" />
              Thao tác theo mã nhân viên
            </CardTitle>
            <CardDescription>
              Nhập mã nhân viên để cập nhật quyền, khóa/mở khóa hoặc đặt lại mật
              khẩu.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleUpdateRoles}>
              <div className="space-y-2">
                <Label htmlFor="staff-target-user-id">Mã nhân viên</Label>
                <Input
                  autoComplete="off"
                  id="staff-target-user-id"
                  required
                  value={targetUserId}
                  onChange={(event) => setTargetUserId(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Vai trò mới</Label>
                <RoleCheckboxes
                  idPrefix="target-role"
                  roles={targetRoles}
                  onChange={setTargetRoles}
                />
              </div>

              <Button
                disabled={!trimmedTargetUserId || isActionBusy}
                type="submit"
              >
                {updateRolesMutation.isPending ? (
                  <LoaderCircle
                    className="animate-spin"
                    data-icon="inline-start"
                  />
                ) : (
                  <ShieldCheck data-icon="inline-start" />
                )}
                Cập nhật vai trò
              </Button>
            </form>

            <div className="mt-5 space-y-4">
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  disabled={!trimmedTargetUserId || isActionBusy}
                  onClick={() => lockMutation.mutate()}
                  type="button"
                  variant="destructive"
                >
                  {lockMutation.isPending ? (
                    <LoaderCircle
                      className="animate-spin"
                      data-icon="inline-start"
                    />
                  ) : (
                    <LockKeyhole data-icon="inline-start" />
                  )}
                  Khóa nhân viên
                </Button>
                <Button
                  disabled={!trimmedTargetUserId || isActionBusy}
                  onClick={() => unlockMutation.mutate()}
                  type="button"
                  variant="outline"
                >
                  {unlockMutation.isPending ? (
                    <LoaderCircle
                      className="animate-spin"
                      data-icon="inline-start"
                    />
                  ) : (
                    <UnlockKeyhole data-icon="inline-start" />
                  )}
                  Mở khóa nhân viên
                </Button>
              </div>

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
                  onChange={(event) => setTemporaryPassword(event.target.value)}
                />
              </div>
              <Button
                disabled={
                  !trimmedTargetUserId ||
                  temporaryPassword.length < 8 ||
                  isActionBusy
                }
                onClick={() => resetPasswordMutation.mutate()}
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

              {lastActionMessage ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  {lastActionMessage}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
