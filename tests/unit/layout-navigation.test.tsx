import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardHeader } from "@/components/layout/dashboard-header";
import { SidebarContent } from "@/components/layout/app-sidebar";
import type { SessionUser } from "@/lib/auth";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/dashboard"),
  useRouter: vi.fn(() => ({ replace: vi.fn() })),
}));

vi.mock("@/hooks/use-session-user", () => ({
  useSessionUser: vi.fn(),
}));

vi.mock("@/features/auth/services/auth.service", () => ({
  logout: vi.fn(),
}));

const { useSessionUser } = await import("@/hooks/use-session-user");
const mockedUseSessionUser = vi.mocked(useSessionUser);

function sessionUser(
  roles: SessionUser["roles"],
  warehouseId?: string,
): SessionUser {
  return {
    id: `unit-${roles.join("-").toLowerCase()}`,
    name: "Unit User",
    roles,
    tenantId: "demo-tenant",
    type: "user",
    warehouseId,
  };
}

describe("dashboard navigation chrome", () => {
  beforeEach(() => {
    mockedUseSessionUser.mockReset();
  });

  it("shows static all-system scope for ADMIN in the sidebar", () => {
    mockedUseSessionUser.mockReturnValue(sessionUser(["ADMIN"]));

    render(<SidebarContent />);

    expect(screen.getByText("Phạm vi truy cập")).toBeInTheDocument();
    expect(screen.getByText("Toàn hệ thống")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Nhân viên/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Chưa gán kho")).not.toBeInTheDocument();
  });

  it("shows assigned warehouse scope for staff without a fake dropdown", () => {
    mockedUseSessionUser.mockReturnValue(sessionUser(["RECEIVER"], "central"));

    render(<SidebarContent />);

    expect(screen.getByText("Kho phụ trách")).toBeInTheDocument();
    expect(screen.getByText("central")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Nhân viên/i }),
    ).not.toBeInTheDocument();
  });

  it("opens admin user menu with staff, system, and logout actions", async () => {
    mockedUseSessionUser.mockReturnValue(sessionUser(["ADMIN"]));

    render(<DashboardHeader />);

    fireEvent.pointerDown(screen.getByRole("button", { name: /Admin/i }));

    expect(
      await screen.findByRole("menuitem", { name: /Nhân viên/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Hệ thống/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Đăng xuất/i }),
    ).toBeInTheDocument();
  });
});
