import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginPageClient } from "@/features/auth/components/login-page";
import { clearAuthTokens } from "@/lib/auth-token";
import { useAuthStore } from "@/stores/auth-store";

const router = {
  refresh: vi.fn(),
  replace: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

describe("login page", () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearAuthTokens();
    useAuthStore.setState({ hasHydrated: true, user: null });
    router.refresh.mockReset();
    router.replace.mockReset();
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
});
