import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StaffClient } from "@/features/staff/components/staff-client";
import type { SessionUser } from "@/lib/auth";

vi.mock("@/hooks/use-session-user", () => ({
  useSessionUser: vi.fn(),
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
const mockedUseSessionUser = vi.mocked(useSessionUser);

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

function renderStaff() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <StaffClient />
    </QueryClientProvider>,
  );
}

describe("staff page", () => {
  beforeEach(() => {
    mockedUseSessionUser.mockReset();
  });

  it("shows create action and staff list to ADMIN", () => {
    mockedUseSessionUser.mockReturnValue(sessionUser(["ADMIN"]));

    renderStaff();

    expect(
      screen.getByRole("heading", { name: "Nhân viên" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Danh sách nhân viên")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Tạo nhân viên$/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Administrator")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /Sửa/i }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: /^Khóa$/i }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /^Mở$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Tạo nhân viên$/i }));

    expect(screen.getByText("Tạo tài khoản WMS")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Bootstrap admin/i }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /^Tạo nhân viên$/i }).length,
    ).toBeGreaterThan(0);
  });

  it("keeps staff mutation controls hidden from MANAGER", () => {
    mockedUseSessionUser.mockReturnValue(sessionUser(["MANAGER"]));

    renderStaff();

    expect(
      screen.getByText("Bạn cần quyền Admin để quản lý tài khoản nhân viên."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Tạo tài khoản WMS")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Tạo nhân viên/i }),
    ).not.toBeInTheDocument();
  });
});
