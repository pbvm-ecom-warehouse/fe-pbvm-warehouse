"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  Server,
  ShieldCheck,
  UnlockKeyhole,
  UserPlus,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSessionUser } from "@/hooks/use-session-user";
import {
  hasAnyRole,
  ROLE_LABELS,
  WMS_ROLES,
  type WmsRole,
} from "@/lib/rbac";
import type {
  CreateUserInput,
  CreateUserResponse,
  WmsHealthResponse,
  WmsRootResponse,
} from "@/types/api";
import {
  bootstrapAdmin,
  createWmsUser,
  lockWmsUser,
  resetWmsUserPassword,
  unlockWmsUser,
  updateWmsUserRoles,
} from "@/features/auth/services/auth.service";

import { getWmsHealth, getWmsRoot } from "../services/settings.service";

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

function formatRootResponse(response: WmsRootResponse | undefined) {
  if (response === undefined) {
    return "Chưa có phản hồi.";
  }

  if (typeof response === "string") {
    return response;
  }

  return response.message ?? JSON.stringify(response);
}

function buildCreatePayload(
  form: typeof defaultCreateForm,
  roles: readonly WmsRole[],
): CreateUserInput {
  return {
    username: form.username.trim(),
    password: form.password,
    email: optionalText(form.email),
    name: optionalText(form.name),
    roles: [...roles],
  };
}

function toggleRole(current: readonly WmsRole[], role: WmsRole) {
  return current.includes(role)
    ? current.filter((currentRole) => currentRole !== role)
    : [...current, role];
}

function StatusLine({
  label,
  value,
}: {
  label: string;
  value: string | undefined;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Badge
        className="max-w-[180px] justify-start truncate"
        variant={value === "up" || value === "ok" ? "default" : "outline"}
      >
        {value === "up" || value === "ok" ? "Hoạt động" : value ?? "Chưa rõ"}
      </Badge>
    </div>
  );
}

function HealthCard({
  health,
  isLoading,
  error,
  onRefresh,
}: {
  health: WmsHealthResponse | undefined;
  isLoading: boolean;
  error: unknown;
  onRefresh: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="size-4 text-primary" />
            Trạng thái hệ thống
          </CardTitle>
          <CardDescription>Trạng thái dịch vụ</CardDescription>
        </div>
        <Button
          aria-label="Làm mới trạng thái hệ thống"
          onClick={onRefresh}
          size="icon-sm"
          type="button"
          variant="outline"
        >
          {isLoading ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <RefreshCw />
          )}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {formatUnknownError(error)}
          </div>
        ) : null}
        <StatusLine label="Trạng thái" value={health?.status} />
        <StatusLine label="Cơ sở dữ liệu" value={health?.db} />
        <StatusLine label="Bộ nhớ đệm" value={health?.redis} />
      </CardContent>
    </Card>
  );
}

function RootCard({
  root,
  isLoading,
  error,
  onRefresh,
}: {
  root: WmsRootResponse | undefined;
  isLoading: boolean;
  error: unknown;
  onRefresh: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="size-4 text-primary" />
            Kết nối WMS
          </CardTitle>
          <CardDescription>Kết nối hệ thống</CardDescription>
        </div>
        <Button
          aria-label="Làm mới kết nối WMS"
          onClick={onRefresh}
          size="icon-sm"
          type="button"
          variant="outline"
        >
          {isLoading ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <RefreshCw />
          )}
        </Button>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {formatUnknownError(error)}
          </div>
        ) : (
          <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-3 text-sm font-medium">
            {formatRootResponse(root)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RoleCheckboxes({
  idPrefix,
  roles,
  onChange,
}: {
  idPrefix: string;
  roles: readonly WmsRole[];
  onChange: (roles: WmsRole[]) => void;
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

export function SettingsClient() {
  const user = useSessionUser();
  const isAdmin = hasAnyRole(user?.roles, ["ADMIN"]);
  const [createForm, setCreateForm] = useState(defaultCreateForm);
  const [targetUserId, setTargetUserId] = useState("");
  const [targetRoles, setTargetRoles] = useState<WmsRole[]>(["RECEIVER"]);
  const [temporaryPassword, setTemporaryPassword] = useState("TempP@ssw0rd123!");
  const [lastCreatedUser, setLastCreatedUser] =
    useState<CreateUserResponse | null>(null);
  const [lastActionMessage, setLastActionMessage] = useState<string | null>(
    null,
  );

  const healthQuery = useQuery({
    queryKey: ["settings", "wms-health"],
    queryFn: getWmsHealth,
  });
  const rootQuery = useQuery({
    queryKey: ["settings", "wms-root"],
    queryFn: getWmsRoot,
  });

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
      setLastActionMessage("Đã đặt lại mật khẩu tạm và bật yêu cầu đổi mật khẩu.");
      toast.success("Đã đặt lại mật khẩu");
    },
  });

  function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    createUserMutation.mutate(buildCreatePayload(createForm, selectedCreateRoles));
  }

  function handleBootstrapAdmin() {
    bootstrapMutation.mutate(buildCreatePayload(createForm, ["ADMIN"]));
  }

  function handleUpdateRoles(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateRolesMutation.mutate();
  }

  const isCreateBusy = bootstrapMutation.isPending || createUserMutation.isPending;
  const isActionBusy =
    updateRolesMutation.isPending ||
    lockMutation.isPending ||
    unlockMutation.isPending ||
    resetPasswordMutation.isPending;
  const trimmedTargetUserId = targetUserId.trim();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-normal">
          Cài đặt WMS
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Theo dõi trạng thái hệ thống và quản lý tài khoản nhân viên nội bộ.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <HealthCard
          error={healthQuery.error}
          health={healthQuery.data}
          isLoading={healthQuery.isLoading || healthQuery.isFetching}
          onRefresh={() => void healthQuery.refetch()}
        />
        <RootCard
          error={rootQuery.error}
          isLoading={rootQuery.isLoading || rootQuery.isFetching}
          onRefresh={() => void rootQuery.refetch()}
          root={rootQuery.data}
        />
      </div>

      {isAdmin ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserPlus className="size-4 text-primary" />
                Quản lý tài khoản WMS
              </CardTitle>
              <CardDescription>
                Tạo tài khoản nhân viên và xử lý quyền truy cập theo vai trò.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleCreateUser}>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="settings-username">Tên đăng nhập</Label>
                    <Input
                      autoComplete="off"
                      id="settings-username"
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
                    <Label htmlFor="settings-password">Mật khẩu tạm</Label>
                    <Input
                      autoComplete="new-password"
                      id="settings-password"
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
                    <Label htmlFor="settings-email">Email</Label>
                    <Input
                      autoComplete="off"
                      id="settings-email"
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
                    <Label htmlFor="settings-name">Tên hiển thị</Label>
                    <Input
                      autoComplete="off"
                      id="settings-name"
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
                    <div>Vai trò: {lastCreatedUser.roles.map((role) => ROLE_LABELS[role as WmsRole] ?? role).join(", ")}</div>
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
                Nhập mã nhân viên để cập nhật quyền, khóa/mở khóa hoặc đặt lại
                mật khẩu.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleUpdateRoles}>
                <div className="space-y-2">
                  <Label htmlFor="settings-target-user-id">Mã nhân viên</Label>
                  <Input
                    autoComplete="off"
                    id="settings-target-user-id"
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
                  <Label htmlFor="settings-temporary-password">
                    Mật khẩu tạm mới
                  </Label>
                  <Input
                    autoComplete="new-password"
                    id="settings-temporary-password"
                    minLength={8}
                    type="password"
                    value={temporaryPassword}
                    onChange={(event) =>
                      setTemporaryPassword(event.target.value)
                    }
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
      ) : null}
    </div>
  );
}
