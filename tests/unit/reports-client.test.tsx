import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReportsClient } from "@/features/reports/components/reports-client";
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

const stockPage = {
  data: [
    {
      available: 80,
      expired: 5,
      itemName: "Ly nhựa 700ml",
      onHand: 100,
      reserved: 15,
      sku: "SKU-01",
      warehouseId: "wh-1",
      warehouseName: "Kho trung tâm",
    },
  ],
  pagination: {
    hasNext: false,
    hasPrev: false,
    limit: 20,
    page: 1,
    totalItems: 1,
    totalPages: 1,
  },
};

const lotPage = {
  data: [
    {
      expiryDate: "2026-07-20T00:00:00.000Z",
      expiryFlag: "expired" as const,
      itemName: "Bột sữa",
      lotNumber: "LOT-01",
      quantity: 12,
      sku: "SKU-LOT-01",
      status: "EXPIRED" as const,
      warehouseId: "wh-1",
      warehouseName: "Kho trung tâm",
    },
  ],
  pagination: {
    hasNext: false,
    hasPrev: false,
    limit: 20,
    page: 1,
    totalItems: 1,
    totalPages: 1,
  },
};

function renderReports() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ReportsClient />
    </QueryClientProvider>,
  );
}

describe("reports page client", () => {
  beforeEach(() => {
    mockedGetLotReport.mockReset();
    mockedGetPerformanceReport.mockReset();
    mockedGetStockReport.mockReset();
    mockedListWarehouses.mockReset();
    mockedGetLotReport.mockResolvedValue(lotPage);
    mockedGetPerformanceReport.mockResolvedValue([
      { movementCount: 4, totalQuantity: -12, type: "ISSUE" },
      { movementCount: 2, totalQuantity: 8, type: "RETURN_IN" },
    ]);
    mockedGetStockReport.mockResolvedValue(stockPage);
    mockedListWarehouses.mockResolvedValue([
      {
        address: "123 Đường kho",
        createdAt: "2026-07-01T00:00:00.000Z",
        id: "wh-1",
        isActive: true,
        name: "Kho trung tâm",
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
    ]);
  });

  it("loads the stock report by default and removes the old placeholder controls", async () => {
    renderReports();

    expect(await screen.findByRole("heading", { name: "Báo cáo kho" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Tồn kho" })).toHaveAttribute(
      "data-state",
      "active",
    );
    expect(await screen.findByText("SKU-01")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Theo lô" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Hiệu suất" })).toBeInTheDocument();
    expect(screen.queryByText("Tạo báo cáo")).not.toBeInTheDocument();
    expect(screen.queryByText("Giá trị kho")).not.toBeInTheDocument();
    expect(screen.queryByText("Báo cáo gần đây")).not.toBeInTheDocument();
  });

  it("applies a trimmed lot SKU and resets its page to one", async () => {
    renderReports();

    fireEvent.click(screen.getByRole("tab", { name: "Theo lô" }));
    const skuInput = await screen.findByLabelText("SKU chính xác");
    fireEvent.change(skuInput, { target: { value: "  LOT-01  " } });
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng" }));

    await waitFor(() =>
      expect(mockedGetLotReport).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1, sku: "LOT-01" }),
      ),
    );
    expect(await screen.findByText("Đã hết hạn", { selector: "span" })).toBeInTheDocument();
  });

  it("shows signed performance totals for the selected date range", async () => {
    renderReports();

    fireEvent.click(screen.getByRole("tab", { name: "Hiệu suất" }));

    expect(await screen.findByText("Xuất kho")).toBeInTheDocument();
    expect(screen.getByText("Nhập hoàn")).toBeInTheDocument();
    expect(screen.getByText("-12")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
  });
});
