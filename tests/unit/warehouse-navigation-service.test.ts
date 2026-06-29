import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api-client";
import {
  listPutawaySuggestionResult,
  listShelfContents,
} from "@/features/warehouse-navigation/services/putaway-navigation.service";

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

const mockedGet = vi.mocked(apiClient.get);

describe("warehouse navigation services", () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it("requests put-away suggestions from the fixed gate entry point", async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        data: [],
        meta: { requestId: "req-1" },
      },
    });

    const result = await listPutawaySuggestionResult({
      sku: "CUP-BLANK-500",
      quantity: 80,
      warehouseId: "central",
    });

    expect(mockedGet).toHaveBeenCalledWith("/putaway/suggestions", {
      params: {
        from: "GATE-01",
        qty: 80,
        sku: "CUP-BLANK-500",
        warehouseId: "central",
      },
    });
    expect(result).toEqual({
      source: "api",
      suggestions: [],
    });
  });

  it("unwraps shelf contents from the shelf contents endpoint", async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: "stock-1",
            sku: "CUP-BLANK-500",
            itemName: "Ly trắng 500ml",
            quantity: 24,
            unit: "cái",
            placement: { x: 8, y: 10, width: 38, height: 24, label: "A" },
            status: "AVAILABLE",
          },
        ],
        meta: { requestId: "req-2" },
      },
    });

    const contents = await listShelfContents({
      shelfCode: "A1-S02",
      warehouseId: "central",
    });

    expect(mockedGet).toHaveBeenCalledWith(
      "/warehouse/shelves/A1-S02/contents",
      { params: { warehouseId: "central" } },
    );
    expect(contents).toHaveLength(1);
    expect(contents[0]).toMatchObject({
      id: "stock-1",
      placement: { x: 8, y: 10, width: 38, height: 24, label: "A" },
      sku: "CUP-BLANK-500",
    });
  });
});
