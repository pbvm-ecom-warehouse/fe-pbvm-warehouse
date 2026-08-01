import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PutawayTasksClient } from "@/features/warehouse-navigation/components/putaway-tasks-client";
import type { SessionUser } from "@/lib/auth";

const serviceMocks = vi.hoisted(() => ({
  getGoodsReceiptNote: vi.fn(),
  listPutawayTasks: vi.fn(),
}));

vi.mock("@/hooks/use-session-user", () => ({
  useSessionUser: vi.fn(
    (): SessionUser => ({
      id: "receiver-1",
      name: "Receiver One",
      roles: ["RECEIVER"],
      tenantId: "demo-tenant",
      type: "user",
    }),
  ),
}));

vi.mock("@/features/purchases/services/goods-receipt-note.service", () => ({
  getGoodsReceiptNote: serviceMocks.getGoodsReceiptNote,
}));

vi.mock(
  "@/features/warehouse-navigation/services/putaway-task.service",
  () => ({
    confirmPutawayLine: vi.fn(),
    listPutawayTasks: serviceMocks.listPutawayTasks,
  }),
);

function renderPutawayTasks() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <PutawayTasksClient />
    </QueryClientProvider>,
  );
}

describe("put-away workspace tabs", () => {
  beforeEach(() => {
    serviceMocks.getGoodsReceiptNote.mockReset();
    serviceMocks.listPutawayTasks.mockReset();

    serviceMocks.listPutawayTasks.mockResolvedValue({
      data: [],
      limit: 100,
      page: 1,
      total: 0,
    });
  });

  it("does not expose legacy inventory reconciliation under Cất hàng", async () => {
    renderPutawayTasks();

    expect(
      screen.getByRole("tab", { name: "Lệnh cất hàng" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: "Phân khoang tồn cũ" }),
    ).not.toBeInTheDocument();
  });
});
