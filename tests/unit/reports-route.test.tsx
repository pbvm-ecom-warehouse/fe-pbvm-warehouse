import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ReportsPage from "@/app/(dashboard)/reports/page";
import {
  getLotReport,
  getPerformanceReport,
  getStockReport,
} from "@/features/reports/services/report.service";
import { listWarehouses } from "@/features/warehouse-structure/services/warehouse-structure.service";

vi.mock("@/features/reports/services/report.service", () => ({
  getLotReport: vi.fn(),
  getPerformanceReport: vi.fn(),
  getStockReport: vi.fn(),
}));

vi.mock("@/features/warehouse-structure/services/warehouse-structure.service", () => ({
  listWarehouses: vi.fn(),
}));

const mockedGetLotReport = vi.mocked(getLotReport);
const mockedGetPerformanceReport = vi.mocked(getPerformanceReport);
const mockedGetStockReport = vi.mocked(getStockReport);
const mockedListWarehouses = vi.mocked(listWarehouses);

describe("reports route", () => {
  beforeEach(() => {
    mockedGetLotReport.mockReset();
    mockedGetPerformanceReport.mockReset();
    mockedGetStockReport.mockReset();
    mockedListWarehouses.mockReset();
    mockedGetLotReport.mockResolvedValue({
      data: [],
      pagination: {
        hasNext: false,
        hasPrev: false,
        limit: 20,
        page: 1,
        totalItems: 0,
        totalPages: 0,
      },
    });
    mockedGetPerformanceReport.mockResolvedValue([]);
    mockedGetStockReport.mockResolvedValue({
      data: [],
      pagination: {
        hasNext: false,
        hasPrev: false,
        limit: 20,
        page: 1,
        totalItems: 0,
        totalPages: 0,
      },
    });
    mockedListWarehouses.mockResolvedValue([]);
  });

  it("mounts the live report interface instead of the static module placeholder", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ReportsPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("heading", { name: "Báo cáo kho" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Tồn kho" })).toBeInTheDocument();
    expect(screen.queryByText("Tạo báo cáo")).not.toBeInTheDocument();
    expect(screen.queryByText("Báo cáo gần đây")).not.toBeInTheDocument();
  });
});
