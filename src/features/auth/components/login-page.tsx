"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Boxes,
  LoaderCircle,
  LogIn,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { isAxiosError } from "axios";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSessionUser } from "@/hooks/use-session-user";
import { clearAuthTokens, setTenantId } from "@/lib/auth-token";
import { env } from "@/lib/env";
import {
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  WMS_ROLES,
  type WmsRole,
} from "@/lib/rbac";
import { useAuthStore } from "@/stores/auth-store";

import { login, logout } from "../services/auth.service";
import { loginSchema } from "../schemas/login.schema";

const defaultCredentials = {
  password: "",
  username: "",
};

function buildLocalRoleUser(role: WmsRole) {
  return {
    id: `local-${role.toLowerCase()}`,
    name: `${ROLE_LABELS[role]} Local`,
    roles: [role] as WmsRole[],
    tenantId: env.NEXT_PUBLIC_DEFAULT_TENANT_ID,
    type: "user" as const,
    warehouseId: "MW-001",
  };
}

export function LoginPageClient() {
  const router = useRouter();
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const setUser = useAuthStore((state) => state.setUser);
  const user = useSessionUser();
  const [credentials, setCredentials] = useState(defaultCredentials);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSwitchingRole, setIsSwitchingRole] = useState<WmsRole | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentRoles = useMemo(() => user?.roles ?? [], [user?.roles]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const parsed = loginSchema.safeParse(credentials);

    if (!parsed.success) {
      setErrorMessage(parsed.error.issues[0]?.message ?? "Thông tin đăng nhập chưa hợp lệ");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await login(parsed.data);
      toast.success("Đăng nhập WMS thành công");

      if (result.mustChangePassword) {
        toast.message("Tài khoản này đang bật cờ đổi mật khẩu sau đăng nhập.");
      }

      router.replace("/dashboard");
    } catch (error) {
      if (isAxiosError(error)) {
        const apiMessage =
          (error.response?.data as { message?: string } | undefined)?.message;
        setErrorMessage(apiMessage ?? "Đăng nhập thất bại. Kiểm tra lại username và mật khẩu.");
      } else {
        setErrorMessage("Không thể kết nối WMS API.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLogout() {
    setErrorMessage(null);
    await logout();
    router.refresh();
  }

  function handleLocalRolePreview(role: WmsRole) {
    setErrorMessage(null);
    setIsSwitchingRole(role);
    clearAuthTokens();
    setTenantId(env.NEXT_PUBLIC_DEFAULT_TENANT_ID);
    setUser(buildLocalRoleUser(role));
    toast.message(`Đã mở local role preview cho ${ROLE_LABELS[role]}.`);
    router.replace("/dashboard");
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
              Bạn đã có phiên đăng nhập hoặc local preview. Có thể vào dashboard
              hoặc đăng xuất để đổi tài khoản.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-lg border border-border/70 bg-muted/25 p-4">
              <div className="text-sm font-semibold">{user.name}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Warehouse scope: {user.warehouseId ?? "chưa gán"} · Tenant:{" "}
                {user.tenantId}
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
              <Button className="sm:flex-1" onClick={() => router.replace("/dashboard")}>
                <ArrowRight data-icon="inline-start" />
                Vào dashboard
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
            <div className="mb-8 flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Boxes className="size-5" />
              </div>
              <div>
                <div className="text-lg font-bold">PBVM WMS</div>
                <div className="text-xs font-medium text-muted-foreground">
                  Warehouse operations
                </div>
              </div>
            </div>
            <h1 className="text-3xl font-bold tracking-normal">
              Đăng nhập nội bộ bằng username và mật khẩu.
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Theo docs WMS, nhân viên dùng tài khoản do ADMIN tạo với
              `username + password`. Role quyết định module nhìn thấy sau khi vào
              dashboard.
            </p>
          </div>
         
        </section>

        <div className="grid gap-4 p-6 sm:p-8 lg:p-10">
          <Card className="border-0 shadow-none">
            <CardHeader className="px-0 pt-0">
              <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground lg:hidden">
                <Boxes className="size-5" />
              </div>
              <CardTitle className="text-2xl">Đăng nhập WMS</CardTitle>
              <CardDescription>
                Dùng username và mật khẩu của nhân viên nội bộ.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <form className="space-y-4" noValidate onSubmit={handleLogin}>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
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
                <Button className="h-10 w-full" disabled={isSubmitting} type="submit">
                  {isSubmitting ? (
                    <LoaderCircle data-icon="inline-start" className="animate-spin" />
                  ) : (
                    <LogIn data-icon="inline-start" />
                  )}
                  Vào dashboard
                </Button>
              </form>
            </CardContent>
          </Card>

          {process.env.NODE_ENV !== "production" ? (
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="text-base">Role preview local</CardTitle>
                <CardDescription>
                  Chỉ để thử RBAC frontend khi chưa seed đủ user ở backend. Không
                  gọi API login thật.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {WMS_ROLES.map((role) => (
                  <button
                    key={role}
                    type="button"
                    className="rounded-lg border border-border/70 bg-card p-3 text-left transition hover:bg-accent/60 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isSwitchingRole !== null}
                    onClick={() => handleLocalRolePreview(role)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <UserRound className="size-4 text-primary" />
                        <span className="text-sm font-semibold">
                          {ROLE_LABELS[role]}
                        </span>
                      </div>
                      {isSwitchingRole === role ? (
                        <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
                      ) : null}
                    </div>
                    <div className="mt-1 text-xs leading-5 text-muted-foreground">
                      {ROLE_DESCRIPTIONS[role]}
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </main>
  );
}
