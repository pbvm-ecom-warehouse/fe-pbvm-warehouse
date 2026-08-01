import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GoodsIssuesClient } from "@/features/goods-issues/components/goods-issues-client";
import type { GoodsIssue } from "@/features/goods-issues/services/goods-issue.service";
import type { SessionUser } from "@/lib/auth";

const serviceMocks = vi.hoisted(() => ({
  assignGoodsIssue: vi.fn(),
  confirmGoodsIssueLine: vi.fn(),
  getGoodsIssue: vi.fn(),
  listAllWmsUsers: vi.fn(),
  listGoodsIssuePickSuggestions: vi.fn(),
  listGoodsIssues: vi.fn(),
  listWmsUsers: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

let currentUser: SessionUser;

vi.mock("@/hooks/use-session-user", () => ({
  useSessionUser: () => currentUser,
}));

vi.mock("@/features/staff/services/staff.service", () => ({
  listAllWmsUsers: serviceMocks.listAllWmsUsers,
  listWmsUsers: serviceMocks.listWmsUsers,
}));

vi.mock("@/features/goods-issues/services/goods-issue.service", () => ({
  GOODS_ISSUE_STATUSES: ["PENDING", "PICKING", "CONFIRMED"],
  assignGoodsIssue: serviceMocks.assignGoodsIssue,
  confirmGoodsIssueLine: serviceMocks.confirmGoodsIssueLine,
  getGoodsIssue: serviceMocks.getGoodsIssue,
  listGoodsIssuePickSuggestions: serviceMocks.listGoodsIssuePickSuggestions,
  listGoodsIssues: serviceMocks.listGoodsIssues,
}));

vi.mock(
  "@/features/warehouse-navigation/components/warehouse-operation-workspace",
  () => ({
    WarehouseOperationWorkspace: ({
      onConfirm,
    }: {
      onConfirm: (value: {
        cellBarcode: string;
        itemBarcode: string;
        quantity: number;
        suggestedCellId?: string;
      }) => Promise<void>;
    }) => (
      <button
        type="button"
        onClick={() => {
          void onConfirm({
            cellBarcode: "CELL-A-01",
            itemBarcode: "8938500000123",
            quantity: 1,
            suggestedCellId: "cell-1",
          }).catch(() => undefined);
        }}
      >
        Xác nhận lấy hàng thử
      </button>
    ),
  }),
);

vi.mock("sonner", () => ({
  toast: {
    error: serviceMocks.toastError,
    success: serviceMocks.toastSuccess,
  },
}));

function session(id: string, roles: SessionUser["roles"]): SessionUser {
  return {
    id,
    name: `User ${id}`,
    roles,
    tenantId: "tenant-1",
    type: "user",
  };
}

const pendingIssue: GoodsIssue = {
  assignedShipperId: undefined,
  goodsIssueNumber: "GI-20260730-0001",
  id: "issue-1",
  items: [
    {
      itemId: "item-1",
      quantity: 2,
      remainingQty: 2,
      sku: "CUP-BLANK-700",
    },
  ],
  orderCode: "ORD-20260730-0001",
  orderId: "order-1",
  status: "PENDING",
};

function renderGoodsIssues() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const result = render(<GoodsIssuesClient />, { wrapper });

  return {
    ...result,
    rerenderClient: () => result.rerender(<GoodsIssuesClient />),
  };
}

describe("goods issue protected workflow", () => {
  beforeEach(() => {
    Object.values(serviceMocks).forEach((mock) => mock.mockReset());
    currentUser = session("admin-a", ["ADMIN"]);
    serviceMocks.listGoodsIssues.mockResolvedValue({
      data: [],
      limit: 20,
      page: 1,
      total: 0,
    });
    serviceMocks.listAllWmsUsers.mockResolvedValue({
      data: [],
      limit: 100,
      page: 1,
      total: 0,
    });
    serviceMocks.listWmsUsers.mockResolvedValue({
      data: [],
      limit: 20,
      page: 1,
      total: 0,
    });
  });

  it("refetches list data when the user or role scope changes", async () => {
    const view = renderGoodsIssues();
    await waitFor(() =>
      expect(serviceMocks.listGoodsIssues).toHaveBeenCalledTimes(1),
    );

    currentUser = session("manager-b", ["MANAGER"]);
    view.rerenderClient();

    await waitFor(() =>
      expect(serviceMocks.listGoodsIssues).toHaveBeenCalledTimes(2),
    );
  });

  it("shows a disabled loading state and an explicit empty shipper state", async () => {
    let resolveShippers:
      | ((value: {
          data: [];
          limit: number;
          page: number;
          total: number;
        }) => void)
      | undefined;
    serviceMocks.listGoodsIssues.mockResolvedValue({
      data: [pendingIssue],
      limit: 20,
      page: 1,
      total: 1,
    });
    serviceMocks.getGoodsIssue.mockResolvedValue(pendingIssue);
    serviceMocks.listAllWmsUsers.mockReturnValue(
      new Promise((resolve) => {
        resolveShippers = resolve;
      }),
    );

    renderGoodsIssues();
    fireEvent.click(
      await screen.findByRole("button", { name: "Xem chi tiết" }),
    );
    const detail = await screen.findByRole("dialog", {
      name: "Chi tiết phiếu xuất kho",
    });
    expect(
      within(detail).getByText("Đang tải danh sách Shipper..."),
    ).toBeVisible();
    expect(
      within(detail).getByRole("combobox", { name: "Chọn Shipper" }),
    ).toBeDisabled();

    resolveShippers?.({ data: [], limit: 100, page: 1, total: 0 });

    expect(
      await within(detail).findByText(
        "Không có Shipper đang hoạt động để gán.",
      ),
    ).toBeVisible();
  });

  it("offers retry when loading active shippers fails", async () => {
    serviceMocks.listGoodsIssues.mockResolvedValue({
      data: [pendingIssue],
      limit: 20,
      page: 1,
      total: 1,
    });
    serviceMocks.getGoodsIssue.mockResolvedValue(pendingIssue);
    serviceMocks.listAllWmsUsers
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({
        data: [],
        limit: 100,
        page: 1,
        total: 0,
      });

    renderGoodsIssues();
    fireEvent.click(
      await screen.findByRole("button", { name: "Xem chi tiết" }),
    );
    const detail = await screen.findByRole("dialog", {
      name: "Chi tiết phiếu xuất kho",
    });
    fireEvent.click(
      await within(detail).findByRole("button", {
        name: "Thử tải lại Shipper",
      }),
    );

    await waitFor(() =>
      expect(serviceMocks.listAllWmsUsers).toHaveBeenCalledTimes(2),
    );
    expect(
      await within(detail).findByText(
        "Không có Shipper đang hoạt động để gán.",
      ),
    ).toBeVisible();
  });

  it.each([
    "GOODS_ISSUE_SOURCE_QUARANTINED",
    "STOCK_INSUFFICIENT",
    "GOODS_ISSUE_SOURCE_NOT_PICKABLE",
  ])("reloads FEFO suggestions after stale pick error %s", async (code) => {
    const assignedIssue: GoodsIssue = {
      ...pendingIssue,
      assignedShipperId: "shipper-a",
      status: "PICKING",
    };
    currentUser = session("shipper-a", ["SHIPPER"]);
    serviceMocks.listGoodsIssues.mockResolvedValue({
      data: [assignedIssue],
      limit: 20,
      page: 1,
      total: 1,
    });
    serviceMocks.getGoodsIssue.mockResolvedValue(assignedIssue);
    serviceMocks.listGoodsIssuePickSuggestions.mockResolvedValue([
      {
        bay: 1,
        cellCode: "CELL-A-01",
        cellId: "cell-1",
        level: 1,
        path: { distanceM: 1, points: [] },
        quantity: 2,
        rackId: "rack-1",
        shelfCode: "SHELF-A",
        shelfId: "shelf-1",
      },
    ]);
    serviceMocks.confirmGoodsIssueLine.mockRejectedValue({
      response: {
        data: {
          error: {
            code,
            message: "Nguồn lấy hàng không còn khả dụng",
          },
        },
      },
    });

    renderGoodsIssues();
    fireEvent.click(
      await screen.findByRole("button", { name: "Xem chi tiết" }),
    );
    const detail = await screen.findByRole("dialog", {
      name: "Chi tiết phiếu xuất kho",
    });
    fireEvent.click(await within(detail).findByText("CUP-BLANK-700"));
    fireEvent.click(
      await within(detail).findByRole("button", {
        name: "Xác nhận lấy hàng thử",
      }),
    );

    await waitFor(() =>
      expect(serviceMocks.listGoodsIssuePickSuggestions).toHaveBeenCalledTimes(
        2,
      ),
    );
    await waitFor(() => {
      expect(serviceMocks.listGoodsIssues).toHaveBeenCalledTimes(2);
      expect(serviceMocks.getGoodsIssue).toHaveBeenCalledTimes(2);
    });
  });
});
