import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdjustmentsClient } from "@/features/adjustments/components/adjustments-client";
import type { SessionUser } from "@/lib/auth";

const serviceMocks = vi.hoisted(() => ({
  approveScrapNote: vi.fn(),
  approveStockCount: vi.fn(),
  countStockCountItem: vi.fn(),
  createStockCount: vi.fn(),
  createStockCountScrap: vi.fn(),
  getScrapNote: vi.fn(),
  getStockCount: vi.fn(),
  listScrapNotes: vi.fn(),
  listStockCounts: vi.fn(),
  rejectScrapNote: vi.fn(),
}));

vi.mock("@/hooks/use-session-user", () => ({
  useSessionUser: vi.fn(
    (): SessionUser => ({
      id: "counter-1",
      name: "Counter One",
      roles: ["COUNTER"],
      tenantId: "demo-tenant",
      type: "user",
    }),
  ),
}));

vi.mock("@/features/adjustments/services/stock-count.service", () => ({
  STOCK_COUNT_STATUSES: ["DRAFT", "IN_PROGRESS", "COMPLETED", "APPROVED"],
  approveStockCount: serviceMocks.approveStockCount,
  countStockCountItem: serviceMocks.countStockCountItem,
  createStockCount: serviceMocks.createStockCount,
  getStockCount: serviceMocks.getStockCount,
  listStockCounts: serviceMocks.listStockCounts,
}));

vi.mock("@/features/adjustments/services/scrap-note.service", () => ({
  SCRAP_NOTE_STATUSES: ["DRAFT", "APPROVED", "REJECTED"],
  approveScrapNote: serviceMocks.approveScrapNote,
  createStockCountScrap: serviceMocks.createStockCountScrap,
  getScrapNote: serviceMocks.getScrapNote,
  listScrapNotes: serviceMocks.listScrapNotes,
  rejectScrapNote: serviceMocks.rejectScrapNote,
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const stockCount = {
  id: "sc-1",
  zoneId: null,
  status: "COMPLETED" as const,
  note: "Kiểm kê cuối ca",
  createdBy: "manager-1",
  items: [
    {
      itemId: "item-1",
      sku: "CUP-RND-PP-700-WHT",
      shelfId: "SHELF-A-01",
      lotId: null,
      systemQty: 10,
      actualQty: 10,
      delta: 0,
      reason: null,
      images: [],
    },
  ],
  createdAt: "2026-07-30T00:00:00.000Z",
  updatedAt: "2026-07-30T00:00:00.000Z",
};

function renderAdjustments() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AdjustmentsClient />
    </QueryClientProvider>,
  );
}

describe("stock-count scrap proposal UI", () => {
  beforeEach(() => {
    Object.values(serviceMocks).forEach((mock) => mock.mockReset());
    serviceMocks.listStockCounts.mockResolvedValue({
      data: [stockCount],
      limit: 20,
      page: 1,
      total: 1,
    });
    serviceMocks.getStockCount.mockResolvedValue(stockCount);
    serviceMocks.listScrapNotes.mockResolvedValue({
      data: [],
      limit: 20,
      page: 1,
      total: 0,
    });
    serviceMocks.createStockCountScrap.mockResolvedValue({
      id: "scrap-1",
      sourceStockCountId: "sc-1",
      status: "DRAFT",
      items: [],
    });
  });

  it("creates from a counted line, resets the dialog, and hides free creation", async () => {
    renderAdjustments();

    fireEvent.click(
      await screen.findByRole("button", { name: "Xem chi tiết" }),
    );
    const proposalButton = await screen.findByRole("button", {
      name: "Đề xuất hủy",
    });
    expect(proposalButton).toBeEnabled();
    fireEvent.click(proposalButton);

    const dialog = screen.getByRole("dialog", {
      name: "Đề xuất hủy từ dòng kiểm kê",
    });
    expect(within(dialog).getByText("CUP-RND-PP-700-WHT")).toBeVisible();
    expect(within(dialog).getByText("SHELF-A-01")).toBeVisible();
    expect(within(dialog).getByText("10")).toBeVisible();

    fireEvent.change(within(dialog).getByLabelText("Barcode SKU"), {
      target: { value: "8938500000123" },
    });
    fireEvent.change(within(dialog).getByLabelText("Số lượng hủy"), {
      target: { value: "2" },
    });
    fireEvent.change(within(dialog).getByLabelText("Lý do hủy"), {
      target: { value: "Hai thùng bị vỡ" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Gửi đề xuất hủy" }),
    );

    await waitFor(() =>
      expect(serviceMocks.createStockCountScrap).toHaveBeenCalledWith({
        input: {
          images: [],
          itemBarcode: "8938500000123",
          lotId: undefined,
          quantity: 2,
          reason: "Hai thùng bị vỡ",
          shelfId: "SHELF-A-01",
        },
        itemId: "item-1",
        stockCountId: "sc-1",
      }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", {
          name: "Đề xuất hủy từ dòng kiểm kê",
        }),
      ).not.toBeInTheDocument(),
    );

    fireEvent.click(proposalButton);
    const reopened = screen.getByRole("dialog", {
      name: "Đề xuất hủy từ dòng kiểm kê",
    });
    expect(within(reopened).getByLabelText("Barcode SKU")).toHaveValue("");
    expect(within(reopened).getByLabelText("Số lượng hủy")).toHaveValue(1);

    fireEvent.click(within(reopened).getByRole("button", { name: "Hủy" }));
    const scrapTab = screen.getByRole("tab", { name: "Phiếu hủy" });
    fireEvent.mouseDown(scrapTab, { button: 0, ctrlKey: false });
    fireEvent.click(scrapTab);
    expect(
      screen.queryByRole("button", { name: "Tạo phiếu hủy" }),
    ).not.toBeInTheDocument();
  });
});
