import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ComponentProps } from "react";

import { StaffClient } from "@/features/staff/components/staff-client";
import type { SessionUser } from "@/lib/auth";

vi.mock("@/components/ui/avatar", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/ui/avatar")>();
  return {
    ...actual,
    AvatarImage: (props: ComponentProps<"img">) => createElement("img", props),
  };
});
vi.mock("@/hooks/use-session-user", () => ({
  useSessionUser: vi.fn(),
}));

vi.mock("@/features/staff/services/staff.service", () => ({
  createWmsUser: vi.fn(),
  deleteWmsUser: vi.fn(),
  getWmsUser: vi.fn(),
  listWmsUsers: vi.fn(),
  lockWmsUser: vi.fn(),
  resetWmsUserPassword: vi.fn(),
  unlockWmsUser: vi.fn(),
  updateWmsUser: vi.fn(),
  updateWmsUserRole: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const { useSessionUser } = await import("@/hooks/use-session-user");
const { getWmsUser, listWmsUsers } =
  await import("@/features/staff/services/staff.service");
const mockedUseSessionUser = vi.mocked(useSessionUser);
const mockedGetWmsUser = vi.mocked(getWmsUser);
const mockedListWmsUsers = vi.mocked(listWmsUsers);

function sessionUser(roles: SessionUser["roles"]): SessionUser {
  return {
    id: `unit-${roles.join("-").toLowerCase()}`,
    name: "Unit User",
    roles,
    tenantId: "demo-tenant",
    type: "user",
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
    mockedGetWmsUser.mockReset();
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
          role: "ADMIN",
          status: "ACTIVE",
          updatedAt: "2026-07-16T01:31:58.557Z",
          username: "admin",
        },
        {
          createdAt: "2026-07-13T07:15:00.000Z",
          email: "printer01@pbvm.local",
          id: "printer-001",
          mustChangePassword: false,
          name: "Le Anh Thu",
          role: "PRINTER",
          status: "LOCKED",
          updatedAt: "2026-07-16T03:35:00.000Z",
          username: "printer01",
        },
      ],
      limit: 20,
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
      screen.queryByRole("button", { name: /Bootstrap admin/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /^Tạo nhân viên$/i }).length,
    ).toBeGreaterThan(0);
  });

  it("lets MANAGER view staff while protecting ADMIN targets", async () => {
    mockedUseSessionUser.mockReturnValue(sessionUser(["MANAGER"]));
    mockedListWmsUsers.mockResolvedValue({
      data: [
        {
          id: "admin-001",
          username: "admin",
          name: "Administrator",
          role: "ADMIN",
          status: "ACTIVE",
          mustChangePassword: false,
        },
      ],
      limit: 20,
      page: 1,
      total: 1,
    });

    renderStaff();

    expect(await screen.findByText("Administrator")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Tạo nhân viên/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sửa/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Khóa$/i })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /Tạo nhân viên/i }));
    const roleSelect = screen.getByRole("combobox", {
      name: "Vai trò khi tạo nhân viên",
    });
    expect(roleSelect).toHaveTextContent("Receiver");
    expect(
      screen.queryByRole("checkbox", { name: "Admin" }),
    ).not.toBeInTheDocument();
  });

  it("prevents an ADMIN from deleting the active account", async () => {
    const activeUser = sessionUser(["ADMIN"]);
    mockedUseSessionUser.mockReturnValue(activeUser);
    mockedListWmsUsers.mockResolvedValue({
      data: [
        {
          id: activeUser.id,
          username: "current-admin",
          name: "Current Admin",
          role: "ADMIN",
          status: "ACTIVE",
          mustChangePassword: false,
        },
      ],
      limit: 20,
      page: 1,
      total: 1,
    });

    renderStaff();

    expect(await screen.findByText("Current Admin")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Xóa current-admin" }),
    ).toBeDisabled();
    expect(
      screen.getByText("Không thể tự xóa tài khoản đang đăng nhập."),
    ).toBeInTheDocument();
  });

  it("allows profile changes without forcing a password reset", async () => {
    mockedUseSessionUser.mockReturnValue(sessionUser(["ADMIN"]));
    mockedListWmsUsers.mockResolvedValue({
      data: [
        {
          id: "receiver-001",
          username: "receiver01",
          name: "Receiver 01",
          role: "RECEIVER",
          status: "ACTIVE",
          mustChangePassword: false,
        },
      ],
      limit: 20,
      page: 1,
      total: 1,
    });

    renderStaff();
    fireEvent.click(await screen.findByRole("button", { name: "Sửa" }));

    expect(screen.getByLabelText("Mật khẩu tạm mới")).not.toBeRequired();
  });

  it("keeps private identifiers out of rows and loads them in the detail drawer", async () => {
    mockedUseSessionUser.mockReturnValue(sessionUser(["ADMIN"]));
    mockedListWmsUsers.mockResolvedValue({
      data: [
        {
          id: "receiver-private-id",
          username: "receiver.private",
          email: "receiver.private@example.com",
          name: "Nguyen Van Nhan",
          role: "RECEIVER",
          status: "ACTIVE",
          mustChangePassword: true,
          updatedAt: "2026-07-23T08:30:00.000Z",
        },
      ],
      limit: 20,
      page: 1,
      total: 1,
    });
    mockedGetWmsUser.mockResolvedValue({
      id: "receiver-private-id",
      username: "receiver.private",
      email: "receiver.private@example.com",
      name: "Nguyen Van Nhan",
      role: "RECEIVER",
      status: "ACTIVE",
      mustChangePassword: true,
      avatarUrl: "https://cdn.example.com/receiver.webp",
      createdAt: "2026-07-20T08:30:00.000Z",
      updatedAt: "2026-07-23T08:30:00.000Z",
    });

    renderStaff();

    const table = await screen.findByRole("table");
    expect(table).toHaveTextContent("Nguyen Van Nhan");
    expect(table).not.toHaveTextContent("receiver-private-id");
    expect(table).not.toHaveTextContent("receiver.private");
    expect(table).not.toHaveTextContent("receiver.private@example.com");
    expect(
      screen.queryByRole("columnheader", { name: "Liên hệ" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Xem chi tiết Nguyen Van Nhan",
      }),
    );

    await waitFor(() =>
      expect(mockedGetWmsUser).toHaveBeenCalledWith("receiver-private-id"),
    );
    expect(await screen.findByText("Chi tiết nhân viên")).toBeInTheDocument();
    expect(screen.getByText("receiver-private-id")).toBeInTheDocument();
    expect(screen.getByText("receiver.private")).toBeInTheDocument();
    expect(
      screen.getByText("receiver.private@example.com"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Nguyen Van Nhan" }),
    ).toHaveAttribute("src", "https://cdn.example.com/receiver.webp");
  });
  it("sends search terms to the server instead of filtering client-side", async () => {
    mockedUseSessionUser.mockReturnValue(sessionUser(["ADMIN"]));
    mockedListWmsUsers.mockResolvedValue({
      data: [],
      limit: 20,
      page: 1,
      total: 0,
    });

    renderStaff();
    fireEvent.change(screen.getByLabelText("Tìm kiếm"), {
      target: { value: "receiver01" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lọc" }));

    await waitFor(() =>
      expect(mockedListWmsUsers).toHaveBeenLastCalledWith(
        expect.objectContaining({
          search: "receiver01",
        }),
      ),
    );
  });
});
