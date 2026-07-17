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
  listWmsUsers: vi.fn(),
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
const { listWmsUsers } = await import("@/features/auth/services/auth.service");
const mockedUseSessionUser = vi.mocked(useSessionUser);
const mockedListWmsUsers = vi.mocked(listWmsUsers);

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
    mockedListWmsUsers.mockReset();
  });

  it("shows create action and staff list to ADMIN", async () => {
    mockedUseSessionUser.mockReturnValue(sessionUser(["ADMIN"]));
    mockedListWmsUsers.mockResolvedValue({
      data: [
        {
          createdAt: "2026-07-16T01:31:58.557Z",
          email: "admin@pbvm.local",
          id: "admin-001",
          mustChangePassword: false,
          name: "Administrator",
          roles: ["ADMIN"],
          status: "ACTIVE",
          updatedAt: "2026-07-16T01:31:58.557Z",
          username: "admin",
          warehouseId: "central",
        },
        {
          createdAt: "2026-07-13T07:15:00.000Z",
          email: "printer01@pbvm.local",
          id: "printer-001",
          mustChangePassword: false,
          name: "Le Anh Thu",
          roles: ["PRINTER"],
          status: "LOCKED",
          updatedAt: "2026-07-16T03:35:00.000Z",
          username: "printer01",
          warehouseId: "central",
        },
      ],
      limit: 100,
      page: 1,
      total: 2,
    });

    renderStaff();

    expect(
      screen.getByRole("heading", { name: "Nhân viên" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Danh sách nhân viên")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Tạo nhân viên$/i }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Administrator")).toBeInTheDocument();
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