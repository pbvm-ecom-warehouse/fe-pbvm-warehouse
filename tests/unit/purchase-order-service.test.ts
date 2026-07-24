import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api-client";
import {
  createPurchaseOrder,
  getPurchaseOrder,
  listPurchaseOrders,
  normalizePurchaseOrderListResponse,
} from "@/features/purchases/services/purchase-order.service";

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockedGet = vi.mocked(apiClient.get);
const mockedPost = vi.mocked(apiClient.post);

const purchaseOrder = {
  createdAt: "2026-07-03T00:00:00.000Z",
  id: "po-1",
  items: [
    {
      expectedQty: 10,
      itemId: "item-1",
      sku: "SKU-001",
      unit: "cái",
      unitPrice: 15000,
    },
  ],
  orderDate: "2026-07-03T00:00:00.000Z",
  poNumber: "PO-0001",
  status: "DRAFT" as const,
  supplierId: "sup-1",
  updatedAt: "2026-07-03T00:00:00.000Z",
};

describe("purchase order API service", () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedPost.mockReset();
  });

  it("normalizes nested list pagination envelopes", () => {
    expect(
      normalizePurchaseOrderListResponse({
        data: {
          data: [purchaseOrder],
          limit: 20,
          page: 1,
          total: 1,
        },
        meta: { requestId: "req-1" },
      }),
    ).toEqual({
      data: [purchaseOrder],
      limit: 20,
      page: 1,
      total: 1,
    });
  });

  it("lists purchase orders with Swagger query params", async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        data: { data: [purchaseOrder], limit: 20, page: 1, total: 1 },
        meta: { requestId: "req-2" },
      },
    });

    await expect(
      listPurchaseOrders({
        limit: 20,
        page: 1,
        status: "DRAFT",
        supplierId: "sup-1",
      }),
    ).resolves.toMatchObject({ data: [purchaseOrder], total: 1 });

    expect(mockedGet).toHaveBeenCalledWith("/purchase-orders", {
      params: {
        limit: 20,
        page: 1,
        status: "DRAFT",
        supplierId: "sup-1",
      },
    });
  });

  it("gets purchase order detail by id", async () => {
    mockedGet.mockResolvedValueOnce({
      data: { data: purchaseOrder, meta: { requestId: "req-3" } },
    });

    await expect(getPurchaseOrder("po-1")).resolves.toEqual(purchaseOrder);
    expect(mockedGet).toHaveBeenCalledWith("/purchase-orders/po-1");
  });

  it("creates purchase orders with the documented body shape", async () => {
    mockedPost.mockResolvedValueOnce({ data: purchaseOrder });

    await createPurchaseOrder({
      expectedDate: "2026-07-10",
      items: purchaseOrder.items,
      note: "Đặt hàng test",
      supplierId: "sup-1",
    });

    expect(mockedPost).toHaveBeenCalledWith("/purchase-orders", {
      expectedDate: "2026-07-10",
      items: purchaseOrder.items,
      note: "Đặt hàng test",
      supplierId: "sup-1",
    });
  });
});
