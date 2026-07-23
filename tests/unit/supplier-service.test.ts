import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api-client";
import {
  changeSupplierStatus,
  listSupplierItemsBySupplier,
  listSuppliers,
  normalizeSupplierListResponse,
  updateSupplierItem,
  upsertSupplierItem,
} from "@/features/suppliers/services/supplier.service";

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
  },
}));

const mockedGet = vi.mocked(apiClient.get);
const mockedPatch = vi.mocked(apiClient.patch);
const mockedPost = vi.mocked(apiClient.post);

const supplier = {
  code: "NCC-001",
  createdAt: "2026-07-02T00:00:00.000Z",
  id: "sup-1",
  name: "Công ty ABC",
  status: "ACTIVE" as const,
  updatedAt: "2026-07-02T00:00:00.000Z",
};

describe("supplier API service", () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedPatch.mockReset();
    mockedPost.mockReset();
  });

  it("normalizes backend nested pagination envelopes", () => {
    expect(
      normalizeSupplierListResponse({
        data: {
          data: [supplier],
          limit: 20,
          page: 2,
          total: 21,
        },
        meta: { requestId: "req-1" },
      }),
    ).toEqual({
      data: [supplier],
      limit: 20,
      page: 2,
      total: 21,
    });
  });

  it("lists suppliers with documented query params", async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        data: { data: [supplier], limit: 20, page: 1, total: 1 },
        meta: { requestId: "req-2" },
      },
    });

    await expect(
      listSuppliers({
        limit: 20,
        page: 1,
        search: "ABC",
        status: "ACTIVE",
      }),
    ).resolves.toMatchObject({ data: [supplier], total: 1 });
    expect(mockedGet).toHaveBeenCalledWith("/supplier", {
      params: {
        limit: 20,
        page: 1,
        search: "ABC",
        status: "ACTIVE",
      },
    });
  });

  it("omits ALL status filters", async () => {
    mockedGet.mockResolvedValueOnce({ data: [] });

    await listSuppliers({ status: "ALL" });

    expect(mockedGet).toHaveBeenCalledWith("/supplier", {
      params: {
        limit: undefined,
        page: undefined,
        search: undefined,
        status: undefined,
      },
    });
  });

  it("changes supplier status through the status sub-route", async () => {
    mockedPatch.mockResolvedValueOnce({ data: supplier });

    await changeSupplierStatus("sup-1", "BLACKLIST");

    expect(mockedPatch).toHaveBeenCalledWith("/supplier/sup-1/status", {
      status: "BLACKLIST",
    });
  });

  it("uses supplier item routes exposed by backend Swagger", async () => {
    mockedGet.mockResolvedValueOnce({ data: [] });
    mockedPost.mockResolvedValueOnce({
      data: {
        id: "si-1",
        isActive: true,
        itemId: "item-1",
        purchasePrice: 15000,
        supplierId: "sup-1",
        updatedAt: "2026-07-02T00:00:00.000Z",
      },
    });

    await listSupplierItemsBySupplier("sup-1");
    await upsertSupplierItem({
      itemId: "item-1",
      purchasePrice: 15000,
      supplierId: "sup-1",
    });

    expect(mockedGet).toHaveBeenCalledWith("/supplier/items/by-supplier/sup-1");
    expect(mockedPost).toHaveBeenCalledWith("/supplier/items", {
      itemId: "item-1",
      purchasePrice: 15000,
      supplierId: "sup-1",
    });
  });
  it("never sends immutable item and supplier ids when updating a supplier item", async () => {
    mockedPatch.mockResolvedValueOnce({
      data: {
        id: "si-1",
        isActive: true,
        itemId: "item-1",
        purchasePrice: 17500,
        supplierId: "sup-1",
        updatedAt: "2026-07-23T00:00:00.000Z",
      },
    });

    await updateSupplierItem("si-1", {
      itemId: "item-2",
      purchasePrice: 17500,
      supplierId: "sup-2",
    } as never);

    expect(mockedPatch).toHaveBeenCalledWith("/supplier/items/si-1", {
      purchasePrice: 17500,
    });
  });
});
