import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginPageClient } from "@/features/auth/components/login-page";
import { clearAuthTokens } from "@/lib/auth-token";
import { useAuthStore } from "@/stores/auth-store";

const router = {
  refresh: vi.fn(),
  replace: vi.fn(),
};

vi.mock("@/features/auth/services/auth.service", () => ({
  changePassword: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

const { login } = await import("@/features/auth/services/auth.service");
const mockedLogin = vi.mocked(login);

describe("login page", () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearAuthTokens();
    useAuthStore.setState({ hasHydrated: true, user: null });
    router.refresh.mockReset();
    router.replace.mockReset();
    mockedLogin.mockReset();
  });

  it("renders username/password login without Google or Firebase entry points", () => {
    render(<LoginPageClient />);

    expect(screen.getByLabelText("Tên đăng nhập")).toBeInTheDocument();
    expect(screen.getByLabelText("Mật khẩu")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Vào trang tổng quan/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/google/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/firebase/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/role preview local/i)).not.toBeInTheDocument();
  });

  it("submits trimmed username and password values", async () => {
    mockedLogin.mockResolvedValueOnce({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      mustChangePassword: false,
    });

    render(<LoginPageClient />);

    fireEvent.change(screen.getByLabelText("Tên đăng nhập"), {
      target: { value: "  receiver_1  " },
    });
    fireEvent.change(screen.getByLabelText("Mật khẩu"), {
      target: { value: "  TempPass123!  " },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Vào trang tổng quan/i }),
    );

    expect(mockedLogin).toHaveBeenCalledWith({
      username: "receiver_1",
      password: "TempPass123!",
    });
  });

  it("does not copy the login password into the forced password-change form", async () => {
    mockedLogin.mockImplementationOnce(async () => {
      useAuthStore.getState().setUser({
        id: "receiver-1",
        name: "Receiver 1",
        roles: ["RECEIVER"],
        tenantId: "demo-tenant",
        type: "user",
      });

      return {
        accessToken: "access-token",
        refreshToken: "refresh-token",
        mustChangePassword: true,
      };
    });

    render(<LoginPageClient />);

    fireEvent.change(screen.getByLabelText("Tên đăng nhập"), {
      target: { value: "receiver_1" },
    });
    fireEvent.change(screen.getByLabelText("Mật khẩu"), {
      target: { value: "TempPass123!" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Vào trang tổng quan/i }),
    );

    expect(await screen.findByText("Đổi mật khẩu tạm")).toBeInTheDocument();
    expect(screen.getByLabelText("Mật khẩu hiện tại")).toHaveValue("");
  });

  it("redirects straight to dashboard when a valid session already exists", () => {
    useAuthStore.setState({
      hasHydrated: true,
      user: {
        id: "admin-1",
        name: "Seed Admin",
        roles: ["ADMIN"],
        tenantId: "demo-tenant",
        type: "user",
      },
    });

    render(<LoginPageClient />);

    expect(screen.getByText("Đang chuyển vào WMS...")).toBeInTheDocument();
    expect(screen.queryByText("Phiên WMS hiện tại")).not.toBeInTheDocument();
    expect(router.replace).toHaveBeenCalledWith("/dashboard");
  });

  it("shows the forced password-change form for a persisted session that still requires it", () => {
    useAuthStore.setState({
      hasHydrated: true,
      user: {
        id: "receiver-1",
        name: "Receiver 1",
        roles: ["RECEIVER"],
        tenantId: "demo-tenant",
        type: "user",
        mustChangePassword: true,
      },
    });

    render(<LoginPageClient />);

    expect(screen.getByText("Đổi mật khẩu tạm")).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalledWith("/dashboard");
  });
});
