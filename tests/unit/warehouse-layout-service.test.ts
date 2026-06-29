import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api-client";
import {
  getWarehouseLayout,
  publishWarehouseLayout,
  saveWarehouseLayoutDraft,
} from "@/features/warehouse-layout/services/warehouse-layout.service";
import { fallbackWarehouseLayout } from "@/features/warehouse-layout/utils/warehouse-layout";

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

  it("loads a published layout", async () => {
    mockedGet.mockResolvedValueOnce({
      data: { data: fallbackWarehouseLayout, meta: { requestId: "layout-1" } },
    });

    const layout = await getWarehouseLayout("central", "published");

    expect(mockedGet).toHaveBeenCalledWith("/warehouses/central/layout", {
      params: { status: "published" },
    });
    expect(layout?.racks).toHaveLength(3);
  });

  it("saves a complete draft snapshot with optimistic revision", async () => {
    mockedPut.mockResolvedValueOnce({ data: fallbackWarehouseLayout });

    await saveWarehouseLayoutDraft(fallbackWarehouseLayout);

    expect(mockedPut).toHaveBeenCalledWith(
      "/warehouses/central/layout/draft",
      expect.objectContaining({
        baseRevision: 1,
        canvas: fallbackWarehouseLayout.canvas,
        zones: fallbackWarehouseLayout.zones,
      }),
    );
  });

  it("publishes the selected draft revision", async () => {
    mockedPost.mockResolvedValueOnce({ data: fallbackWarehouseLayout });

    await publishWarehouseLayout("central", 4);

    expect(mockedPost).toHaveBeenCalledWith(
      "/warehouses/central/layout/publish",
      { draftRevision: 4 },
    );
  });
});
