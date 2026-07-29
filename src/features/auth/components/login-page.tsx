"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, LogIn, ShieldCheck } from "lucide-react";
import { isAxiosError } from "axios";
import { toast } from "sonner";

import { WmsLogo } from "@/components/brand/wms-logo";
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
import { useAuthStore } from "@/stores/auth-store";

import { changePassword, login } from "../services/auth.service";
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
  const requiresPasswordChange =
    needsPasswordChange || Boolean(user?.mustChangePassword);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const parsed = loginSchema.safeParse({
      ...credentials,
      username: credentials.username.trim(),
      password: credentials.password.trim(),
    });

    if (!parsed.success) {
      setErrorMessage(
        parsed.error.issues[0]?.message ?? "Thông tin đăng nhập chưa hợp lệ",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await login(parsed.data);

      if (result.mustChangePassword) {
        setPasswordChange(defaultPasswordChange);
        setNeedsPasswordChange(true);
        toast.message("Tài khoản cần đổi mật khẩu trước khi vào hệ thống.");
        return;
      }

      toast.success("Đăng nhập WMS thành công");
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

  useEffect(() => {
    if (user && !requiresPasswordChange) {
      router.replace("/dashboard");
    }
  }, [requiresPasswordChange, router, user]);

  if (!hasHydrated || (user && !requiresPasswordChange)) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4 py-10">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center gap-3 py-12 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            {!hasHydrated
              ? "Đang khởi tạo phiên WMS..."
              : "Đang chuyển vào WMS..."}
          </CardContent>
        </Card>
      </main>
    );
  }

  if (user && requiresPasswordChange) {
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
