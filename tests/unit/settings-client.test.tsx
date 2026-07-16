import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsClient } from "@/features/settings/components/settings-client";

vi.mock("@/features/settings/services/settings.service", () => ({
  getWmsHealth: vi.fn(),
  getWmsRoot: vi.fn(),
}));

const { getWmsHealth, getWmsRoot } =
  await import("@/features/settings/services/settings.service");

const mockedGetWmsHealth = vi.mocked(getWmsHealth);
const mockedGetWmsRoot = vi.mocked(getWmsRoot);

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
    mockedGetWmsHealth.mockReset();
    mockedGetWmsRoot.mockReset();
    mockedGetWmsHealth.mockResolvedValue({
      status: "ok",
      db: "up",
      redis: "up",
    });
    mockedGetWmsRoot.mockResolvedValue("Hello World!");
  });

  it("shows only real system health and WMS connection checks", async () => {
    renderSettings();

    expect(await screen.findByText("Hệ thống")).toBeInTheDocument();
    expect(screen.getByText("Trạng thái hệ thống")).toBeInTheDocument();
    expect(screen.getByText("Kết nối WMS")).toBeInTheDocument();
    expect(screen.queryByText("Quản lý tài khoản WMS")).not.toBeInTheDocument();
    expect(screen.queryByText("Tạo tài khoản WMS")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Tạo nhân viên/i }),
    ).not.toBeInTheDocument();
  });
});
