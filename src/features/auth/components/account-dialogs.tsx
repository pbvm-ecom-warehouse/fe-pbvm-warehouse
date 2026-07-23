"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ImageUp,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/lib/api-contract";
import { normalizeRoles, ROLE_LABELS } from "@/lib/rbac";
import type { WmsUserResponse } from "@/types/api";

import {
  changePassword,
  getCurrentUser,
  uploadCurrentUserAvatar,
} from "../services/auth.service";

const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function initials(name: string | undefined) {
  return (name ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
function formatError(error: unknown) {
  return getApiErrorMessage(error) ?? "Không kết nối được WMS.";
}

function formatRole(
  role: WmsUserResponse["role"],
  legacyRoles?: WmsUserResponse["roles"],
) {
  const normalized = normalizeRoles(role ?? legacyRoles);

  if (normalized.length > 0) {
    return normalized.map((role) => ROLE_LABELS[role]).join(", ");
  }

  return role || legacyRoles?.join(", ") || "Chưa phân quyền";
}

function formatDateTime(value: string | undefined) {
  if (!value) {
    return "Chưa có";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function ProfileRow({
  label,
  value,
}: {
  label: string;
  value: string | undefined;
}) {
  return (
    <div className="grid gap-1 rounded-lg border border-border/70 bg-muted/20 px-3 py-2 sm:grid-cols-[150px_1fr] sm:items-center">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-sm font-semibold">
        {value?.trim() || "Chưa khai báo"}
      </span>
    </div>
  );
}

export function AccountProfileDialog({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const queryClient = useQueryClient();
  const profileQuery = useQuery({
    enabled: open,
    queryFn: getCurrentUser,
    queryKey: ["auth", "me"],
  });
  const profile = profileQuery.data;
  const uploadAvatarMutation = useMutation({
    mutationFn: uploadCurrentUserAvatar,
    onError: (error) => toast.error(formatError(error)),
    onSuccess: (updatedProfile) => {
      queryClient.setQueryData(["auth", "me"], updatedProfile);
      toast.success("Đã cập nhật ảnh đại diện");
    },
  });

  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;
    if (!AVATAR_TYPES.has(file.type)) {
      toast.error("Ảnh đại diện chỉ nhận JPEG, PNG hoặc WebP.");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error("Ảnh đại diện không được vượt quá 5 MB.");
      return;
    }

    uploadAvatarMutation.mutate(file);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRound className="size-4 text-primary" />
            Hồ sơ nhân viên
          </DialogTitle>
          <DialogDescription>
            Thông tin lấy từ endpoint /api/wms/auth/me.
          </DialogDescription>
        </DialogHeader>

        {profileQuery.error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {formatError(profileQuery.error)}
          </div>
        ) : null}

        {profileQuery.isLoading ? (
          <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            Đang tải hồ sơ...
          </div>
        ) : profile ? (
          <div className="space-y-2">
            <div className="mb-4 flex flex-wrap items-center gap-4 rounded-lg border border-border/70 bg-muted/20 p-4">
              <Avatar className="size-20">
                {profile.avatarUrl ? (
                  <AvatarImage
                    alt={profile.name || profile.username}
                    src={profile.avatarUrl}
                  />
                ) : null}
                <AvatarFallback className="text-lg font-semibold">
                  {initials(profile.name || profile.username) || "WM"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">
                  {profile.name || profile.username}
                </div>
                <div className="text-sm text-muted-foreground">
                  JPEG, PNG hoặc WebP, tối đa 5 MB.
                </div>
                <Input
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={uploadAvatarMutation.isPending}
                  id="account-avatar"
                  onChange={handleAvatarChange}
                  type="file"
                />
                <Button asChild className="mt-3" size="sm" variant="outline">
                  <Label className="cursor-pointer" htmlFor="account-avatar">
                    {uploadAvatarMutation.isPending ? (
                      <LoaderCircle
                        className="animate-spin"
                        data-icon="inline-start"
                      />
                    ) : (
                      <ImageUp data-icon="inline-start" />
                    )}
                    {uploadAvatarMutation.isPending
                      ? "Đang tải ảnh"
                      : "Đổi ảnh đại diện"}
                  </Label>
                </Button>
              </div>
            </div>
            <ProfileRow label="Mã nhân viên" value={profile.id} />
            <ProfileRow label="Tên đăng nhập" value={profile.username} />
            <ProfileRow label="Tên hiển thị" value={profile.name} />
            <ProfileRow label="Email" value={profile.email} />
            <ProfileRow
              label="Vai trò"
              value={formatRole(profile.role, profile.roles)}
            />
            <ProfileRow label="Kho phụ trách" value={profile.warehouseId} />
            <div className="grid gap-1 rounded-lg border border-border/70 bg-muted/20 px-3 py-2 sm:grid-cols-[150px_1fr] sm:items-center">
              <span className="text-xs font-medium text-muted-foreground">
                Trạng thái
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  className={
                    profile.status === "ACTIVE"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-rose-200 bg-rose-50 text-rose-700"
                  }
                  variant="outline"
                >
                  {profile.status === "ACTIVE" ? "Đang hoạt động" : "Đã khóa"}
                </Badge>
                {profile.mustChangePassword ? (
                  <Badge
                    className="border-amber-200 bg-amber-50 text-amber-700"
                    variant="outline"
                  >
                    Cần đổi mật khẩu
                  </Badge>
                ) : null}
              </div>
            </div>
            <ProfileRow
              label="Ngày tạo"
              value={formatDateTime(profile.createdAt)}
            />
            <ProfileRow
              label="Cập nhật"
              value={formatDateTime(profile.updatedAt)}
            />
          </div>
        ) : null}

        <DialogFooter>
          <Button
            disabled={profileQuery.isFetching}
            onClick={() => void profileQuery.refetch()}
            type="button"
            variant="outline"
          >
            {profileQuery.isFetching ? (
              <LoaderCircle className="animate-spin" data-icon="inline-start" />
            ) : (
              <RefreshCw data-icon="inline-start" />
            )}
            Làm mới
          </Button>
          <Button onClick={() => onOpenChange(false)} type="button">
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ChangePasswordDialog({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const changePasswordMutation = useMutation({
    mutationFn: () => changePassword({ newPassword, oldPassword }),
    onError: (error) => setFormError(formatError(error)),
    onSuccess: () => {
      toast.success("Đã đổi mật khẩu WMS");
      resetForm();
      onOpenChange(false);
    },
  });

  function resetForm() {
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setFormError(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (newPassword.length < 8) {
      setFormError("Mật khẩu mới cần ít nhất 8 ký tự.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setFormError("Mật khẩu xác nhận không khớp.");
      return;
    }

    changePasswordMutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-4 text-primary" />
            Đổi mật khẩu
          </DialogTitle>
          <DialogDescription>
            Cập nhật mật khẩu đăng nhập nội bộ WMS.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {formError ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {formError}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="account-old-password">Mật khẩu hiện tại</Label>
            <Input
              autoComplete="current-password"
              id="account-old-password"
              required
              type="password"
              value={oldPassword}
              onChange={(event) => setOldPassword(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-new-password">Mật khẩu mới</Label>
            <Input
              autoComplete="new-password"
              id="account-new-password"
              minLength={8}
              required
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-confirm-password">
              Nhập lại mật khẩu mới
            </Label>
            <Input
              autoComplete="new-password"
              id="account-confirm-password"
              minLength={8}
              required
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              disabled={changePasswordMutation.isPending}
              onClick={() => handleOpenChange(false)}
              type="button"
              variant="outline"
            >
              Hủy
            </Button>
            <Button disabled={changePasswordMutation.isPending} type="submit">
              {changePasswordMutation.isPending ? (
                <LoaderCircle
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : (
                <KeyRound data-icon="inline-start" />
              )}
              Cập nhật mật khẩu
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
