import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { createElement, type ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardHeader } from "@/components/layout/dashboard-header";
import { SidebarContent } from "@/components/layout/app-sidebar";
import type { SessionUser } from "@/lib/auth";

vi.mock("@/components/ui/avatar", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/ui/avatar")>();
  return {
    ...actual,
    AvatarImage: (props: ComponentProps<"img">) => createElement("img", props),
  };
});
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/dashboard"),
  useRouter: vi.fn(() => ({ replace: vi.fn() })),
}));

vi.mock("@/hooks/use-session-user", () => ({
  useSessionUser: vi.fn(),
}));

vi.mock("@/features/auth/services/auth.service", () => ({
  changePassword: vi.fn(),
  getCurrentUser: vi.fn(),
  logout: vi.fn(),
  uploadCurrentUserAvatar: vi.fn(),
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

function renderDashboardHeader() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardHeader />
    </QueryClientProvider>,
  );
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
    expect(
      screen.queryByRole("button", { name: /Đăng xuất/i }),
    ).not.toBeInTheDocument();
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

  it("opens user menu with profile, password, and logout actions", async () => {
    mockedUseSessionUser.mockReturnValue({
      ...sessionUser(["ADMIN"]),
      avatarUrl: "https://cdn.example.com/admin.webp",
    });

    renderDashboardHeader();

    expect(screen.getByRole("img", { name: "Unit User" })).toHaveAttribute(
      "src",
      "https://cdn.example.com/admin.webp",
    );
    fireEvent.pointerDown(screen.getByRole("button", { name: /Admin/i }));

    expect(
      await screen.findByRole("menuitem", { name: /Hồ sơ/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Đổi mật khẩu/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Đăng xuất/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /Nhân viên/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /Hệ thống/i }),
    ).not.toBeInTheDocument();
  });
});
