import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getWarehouseLayout,
  listShelfContents,
  publishWarehouseLayout,
  saveWarehouseLayoutDraft,
} from "@/features/warehouse-layout/services/warehouse-layout.service";
import { fallbackWarehouseLayout } from "@/features/warehouse-layout/utils/warehouse-layout";
import { apiClient } from "@/lib/api-client";
import { MissingBackendEndpointError } from "@/lib/api-contract";

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

const mockedGet = vi.mocked(apiClient.get);
const mockedPost = vi.mocked(apiClient.post);
const mockedPut = vi.mocked(apiClient.put);

describe("warehouse layout service", () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedPost.mockReset();
    mockedPut.mockReset();
  });

  it("loads a published warehouse layout from the contract endpoint", async () => {
    mockedGet.mockResolvedValueOnce({
      data: { data: fallbackWarehouseLayout, meta: { requestId: "req-1" } },
    });

    await expect(getWarehouseLayout("central", "published")).resolves.toEqual(
      fallbackWarehouseLayout,
    );
    expect(mockedGet).toHaveBeenCalledWith("/warehouse/central/layout", {
      params: { status: "published" },
    });
  });

  it("saves draft layout through the draft endpoint", async () => {
    const saved = { ...fallbackWarehouseLayout, revision: 2, status: "DRAFT" as const };
    mockedPut.mockResolvedValueOnce({ data: { data: saved, meta: {} } });

    await expect(saveWarehouseLayoutDraft(saved)).resolves.toEqual(saved);
    expect(mockedPut).toHaveBeenCalledWith(
      "/warehouse/central/layout/draft",
      saved,
    );
  });

  it("publishes a draft revision", async () => {
    mockedPost.mockResolvedValueOnce({ data: fallbackWarehouseLayout });

    await expect(publishWarehouseLayout("central", 4)).resolves.toEqual(
      fallbackWarehouseLayout,
    );
    expect(mockedPost).toHaveBeenCalledWith(
      "/warehouse/central/layout/publish",
      { draftRevision: 4 },
    );
  });

  it("lists shelf contents for the rack zoom view", async () => {
    const contents = [
      {
        id: "stock-1",
        itemName: "Ly trắng 500ml",
        quantity: 24,
        sku: "CUP-BLANK-500",
        unit: "cái",
      },
    ];
    mockedGet.mockResolvedValueOnce({ data: { data: contents, meta: {} } });

    await expect(
      listShelfContents({ shelfCode: "A1-S02", warehouseId: "central" }),
    ).resolves.toEqual(contents);
    expect(mockedGet).toHaveBeenCalledWith(
      "/warehouse/shelves/A1-S02/contents",
      { params: { warehouseId: "central" } },
    );
  });

  it("converts missing layout endpoint responses to MissingBackendEndpointError", async () => {
    mockedGet.mockRejectedValueOnce({ response: { status: 404 } });

    const promise = getWarehouseLayout("central", "published");

    await expect(promise).rejects.toBeInstanceOf(MissingBackendEndpointError);
    await expect(promise).rejects.toMatchObject({
      endpoint: "GET /api/wms/warehouse/central/layout?status=published",
    });
  });
});

