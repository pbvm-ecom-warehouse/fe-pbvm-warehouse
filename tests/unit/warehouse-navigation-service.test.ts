import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api-client";
import { listPutawaySuggestionResult } from "@/features/warehouse-navigation/services/putaway-navigation.service";
import { MissingBackendEndpointError } from "@/lib/api-contract";

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

const mockedGet = vi.mocked(apiClient.get);

function httpError(status: number) {
  return { response: { status } };
}

describe("warehouse navigation services", () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it("requests put-away suggestions with the Swagger query shape", async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        data: {
          suggestions: [{ capacity: 120, shelfCode: "A1-S02" }],
          warning: null,
        },
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
        qty: 80,
        sku: "CUP-BLANK-500",
        warehouseId: "central",
      },
    });
    expect(result).toEqual({
      source: "api",
      suggestions: [{ capacity: 120, shelfCode: "A1-S02" }],
      warning: null,
    });
  });

  it("keeps backend warnings from put-away suggestions", async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        suggestions: [],
        warning: "INSUFFICIENT_CAPACITY",
      },
    });

    await expect(
      listPutawaySuggestionResult({
        sku: "SKU-001",
        quantity: 999,
        warehouseId: "central",
      }),
    ).resolves.toMatchObject({
      suggestions: [],
      warning: "INSUFFICIENT_CAPACITY",
    });
  });

  it("surfaces missing put-away API instead of returning local suggestions", async () => {
    mockedGet.mockRejectedValueOnce(httpError(404));

    await expect(
      listPutawaySuggestionResult({
        sku: "CUP-BLANK-500",
        quantity: 80,
        warehouseId: "central",
      }),
    ).rejects.toBeInstanceOf(MissingBackendEndpointError);
  });
});
