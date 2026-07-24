"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle, LogIn, ShieldCheck } from "lucide-react";
import { isAxiosError } from "axios";
import { toast } from "sonner";

import { WmsLogo } from "@/components/brand/wms-logo";
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
import { useSessionUser } from "@/hooks/use-session-user";
import { getApiErrorMessage } from "@/lib/api-contract";
import { ROLE_LABELS } from "@/lib/rbac";
import { useAuthStore } from "@/stores/auth-store";

import { changePassword, login, logout } from "../services/auth.service";
import { changePasswordSchema } from "../schemas/change-password.schema";
import { loginSchema } from "../schemas/login.schema";

const defaultCredentials = {
  password: "",
  username: "",
};

const defaultPasswordChange = {
  oldPassword: "",
  newPassword: "",
};

export function LoginPageClient() {
  const router = useRouter();
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const user = useSessionUser();
  const [credentials, setCredentials] = useState(defaultCredentials);
  const [passwordChange, setPasswordChange] = useState(defaultPasswordChange);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentRoles = useMemo(() => user?.roles ?? [], [user?.roles]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const parsed = loginSchema.safeParse(credentials);

    if (!parsed.success) {
      setErrorMessage(
        parsed.error.issues[0]?.message ?? "Thông tin đăng nhập chưa hợp lệ",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await login(parsed.data);
      toast.success("Đăng nhập WMS thành công");

      if (result.mustChangePassword) {
        setPasswordChange(defaultPasswordChange);
        setNeedsPasswordChange(true);
        toast.message("Tài khoản cần đổi mật khẩu trước khi vào hệ thống.");
        return;
      }

      router.replace("/dashboard");
    } catch (error) {
      if (isAxiosError(error)) {
        const apiMessage = getApiErrorMessage(error);
        setErrorMessage(
          apiMessage ??
            "Đăng nhập thất bại. Kiểm tra lại username và mật khẩu.",
        );
      } else {
        setErrorMessage("Không kết nối được WMS.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const parsed = changePasswordSchema.safeParse(passwordChange);

    if (!parsed.success) {
      setErrorMessage(
        parsed.error.issues[0]?.message ?? "Thông tin đổi mật khẩu chưa hợp lệ",
      );
      return;
    }

    setIsChangingPassword(true);

    try {
      const result = await changePassword(parsed.data);

      if (result.mustChangePassword) {
        setErrorMessage(
          "Tài khoản vẫn cần đổi mật khẩu. Hãy thử mật khẩu mới khác.",
        );
        return;
      }

      toast.success("Đã đổi mật khẩu WMS");
      setNeedsPasswordChange(false);
      setPasswordChange(defaultPasswordChange);
      router.replace("/dashboard");
    } catch (error) {
      if (isAxiosError(error)) {
        const apiMessage = getApiErrorMessage(error);
        setErrorMessage(apiMessage ?? "Không đổi được mật khẩu.");
      } else {
        setErrorMessage("Không kết nối được WMS.");
      }
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function handleLogout() {
    setErrorMessage(null);
    await logout();
    router.refresh();
  }

  if (!hasHydrated) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4 py-10">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center gap-3 py-12 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            Đang khởi tạo phiên WMS...
          </CardContent>
        </Card>
      </main>
    );
  }

  if (user && needsPasswordChange) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4 py-10">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <ShieldCheck className="size-5 text-primary" />
              Đổi mật khẩu tạm
            </CardTitle>
            <CardDescription>
              Cập nhật mật khẩu mới trước khi vào hệ thống.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              autoComplete="off"
              className="space-y-4"
              noValidate
              onSubmit={handleChangePassword}
            >
              <div className="space-y-2">
                <Label htmlFor="oldPassword">Mật khẩu hiện tại</Label>
                <Input
                  autoComplete="off"
                  id="oldPassword"
                  type="password"
                  value={passwordChange.oldPassword}
                  onChange={(event) =>
                    setPasswordChange((current) => ({
                      ...current,
                      oldPassword: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">Mật khẩu mới</Label>
                <Input
                  autoComplete="new-password"
                  id="newPassword"
                  type="password"
                  value={passwordChange.newPassword}
                  onChange={(event) =>
                    setPasswordChange((current) => ({
                      ...current,
                      newPassword: event.target.value,
                    }))
                  }
                />
              </div>
              {errorMessage ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {errorMessage}
                </div>
              ) : null}
              <Button
                className="h-10 w-full"
                disabled={isChangingPassword}
                type="submit"
              >
                {isChangingPassword ? (
                  <LoaderCircle
                    data-icon="inline-start"
                    className="animate-spin"
                  />
                ) : (
                  <ShieldCheck data-icon="inline-start" />
                )}
                Cập nhật mật khẩu
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (user) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4 py-10">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <ShieldCheck className="size-5 text-primary" />
              Phiên WMS hiện tại
            </CardTitle>
            <CardDescription>
              Bạn đã có phiên đăng nhập. Có thể vào trang tổng quan hoặc đăng
              xuất để đổi tài khoản.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-lg border border-border/70 bg-muted/25 p-4">
              <div className="text-sm font-semibold">{user.name}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Kho trung tâm · Đơn vị: {user.tenantId}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {currentRoles.map((role) => (
                  <Badge key={role} variant="outline">
                    {ROLE_LABELS[role]}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                className="sm:flex-1"
                onClick={() => router.replace("/dashboard")}
              >
                <ArrowRight data-icon="inline-start" />
                Vào trang tổng quan
              </Button>
              <Button
                className="sm:flex-1"
                onClick={handleLogout}
                variant="outline"
              >
                Đăng xuất
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-xl border bg-card shadow-[0_28px_70px_-46px_rgba(15,23,42,0.55)] lg:grid-cols-[0.92fr_1fr]">
        <section className="hidden border-r bg-muted/25 p-8 lg:flex lg:flex-col lg:justify-between">
          <div>
            <WmsLogo className="mb-8" subtitle="Vận hành kho" />
            <h1 className="text-3xl font-bold tracking-normal">
              Đăng nhập nội bộ bằng username và mật khẩu.
            </h1>
          </div>
        </section>

        <div className="grid gap-4 p-6 sm:p-8 lg:p-10">
          <Card className="border-0 shadow-none">
            <CardHeader className="px-0 pt-0">
              <WmsLogo className="mb-2 lg:hidden" showWordmark={false} />
              <CardTitle className="text-2xl">Đăng nhập WMS</CardTitle>
              <CardDescription>
                Dùng username và mật khẩu của nhân viên nội bộ.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <form className="space-y-4" noValidate onSubmit={handleLogin}>
                <div className="space-y-2">
                  <Label htmlFor="username">Tên đăng nhập</Label>
                  <Input
                    autoComplete="username"
                    id="username"
                    placeholder="admin"
                    value={credentials.username}
                    onChange={(event) =>
                      setCredentials((current) => ({
                        ...current,
                        username: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Mật khẩu</Label>
                  <Input
                    autoComplete="current-password"
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={credentials.password}
                    onChange={(event) =>
                      setCredentials((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                  />
                </div>
                {errorMessage ? (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {errorMessage}
                  </div>
                ) : null}
                <Button
                  className="h-10 w-full"
                  disabled={isSubmitting}
                  type="submit"
                >
                  {isSubmitting ? (
                    <LoaderCircle
                      data-icon="inline-start"
                      className="animate-spin"
                    />
                  ) : (
                    <LogIn data-icon="inline-start" />
                  )}
                  Vào trang tổng quan
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
