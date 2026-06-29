import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api-client";
import {
  listInventoryValueSeries,
  listStockLedger,
  listStockMovements,
} from "@/features/inventory/inventory.service";

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

const mockedGet = vi.mocked(apiClient.get);

function httpError(status: number) {
  return { response: { status } };
}

describe("inventory API service", () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it("returns an empty ledger when the backend endpoint is missing", async () => {
    mockedGet.mockRejectedValueOnce(httpError(404));

    await expect(listStockLedger()).resolves.toEqual({
      data: [],
      meta: {
        pagination: {
          page: 1,
          pageSize: 0,
          total: 0,
        },
      },
    });
  });

  it("returns an empty report series when the backend endpoint is not implemented", async () => {
    mockedGet.mockRejectedValueOnce(httpError(501));

    await expect(listInventoryValueSeries()).resolves.toEqual({
      data: [],
      meta: {
        pagination: {
          page: 1,
          pageSize: 0,
          total: 0,
        },
      },
    });
  });

  it("does not hide auth failures behind empty fallback data", async () => {
    const error = httpError(401);
    mockedGet.mockRejectedValueOnce(error);

    await expect(listStockMovements()).rejects.toBe(error);
  });
});
