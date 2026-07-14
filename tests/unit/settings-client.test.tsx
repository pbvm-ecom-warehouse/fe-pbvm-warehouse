import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsClient } from "@/features/settings/components/settings-client";
import type { SessionUser } from "@/lib/auth";

vi.mock("@/hooks/use-session-user", () => ({
  useSessionUser: vi.fn(),
}));

vi.mock("@/features/settings/services/settings.service", () => ({
  getWmsHealth: vi.fn(),
  getWmsRoot: vi.fn(),
}));

vi.mock("@/features/auth/services/auth.service", () => ({
  bootstrapAdmin: vi.fn(),
  createWmsUser: vi.fn(),
  lockWmsUser: vi.fn(),
  resetWmsUserPassword: vi.fn(),
  unlockWmsUser: vi.fn(),
  updateWmsUserRoles: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const { useSessionUser } = await import("@/hooks/use-session-user");
const { getWmsHealth, getWmsRoot } = await import(
  "@/features/settings/services/settings.service"
);

const mockedUseSessionUser = vi.mocked(useSessionUser);
const mockedGetWmsHealth = vi.mocked(getWmsHealth);
const mockedGetWmsRoot = vi.mocked(getWmsRoot);

function sessionUser(roles: SessionUser["roles"]): SessionUser {
  return {
    id: `unit-${roles.join("-").toLowerCase()}`,
    name: "Unit User",
    roles,
    tenantId: "demo-tenant",
    type: "user",
    warehouseId: "central",
  };
}

function renderSettings() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <SettingsClient />
    </QueryClientProvider>,
  );
}

describe("settings page", () => {
  beforeEach(() => {
    mockedUseSessionUser.mockReset();
    mockedGetWmsHealth.mockReset();
    mockedGetWmsRoot.mockReset();
    mockedGetWmsHealth.mockResolvedValue({
      status: "ok",
      db: "up",
      redis: "up",
    });
    mockedGetWmsRoot.mockResolvedValue("Hello World!");
  });

  it("shows health and admin user action forms to ADMIN", async () => {
    mockedUseSessionUser.mockReturnValue(sessionUser(["ADMIN"]));

    renderSettings();

    expect(await screen.findByText("Trạng thái hệ thống")).toBeInTheDocument();
    expect(screen.getByText("Kết nối WMS")).toBeInTheDocument();
    expect(screen.getByText("Quản lý tài khoản WMS")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Khởi tạo quản trị viên/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Tạo nhân viên/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Cập nhật vai trò/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Khóa nhân viên$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Mở khóa nhân viên/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Đặt lại mật khẩu/i }),
    ).toBeInTheDocument();
  });

  it("keeps mutation controls hidden from MANAGER", async () => {
    mockedUseSessionUser.mockReturnValue(sessionUser(["MANAGER"]));

    renderSettings();

    expect(await screen.findByText("Trạng thái hệ thống")).toBeInTheDocument();
    expect(screen.getByText("Kết nối WMS")).toBeInTheDocument();
    expect(screen.queryByText("Quản lý tài khoản WMS")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Tạo nhân viên/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Đặt lại mật khẩu/i }),
    ).not.toBeInTheDocument();
  });
});
