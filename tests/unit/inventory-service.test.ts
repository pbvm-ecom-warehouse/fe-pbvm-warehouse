import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api-client";
import {
  listInventoryValueSeries,
  listStockLedger,
  listStockMovements,
} from "@/features/inventory/inventory.service";
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

describe("inventory API service", () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it("surfaces unsupported ledger endpoints instead of returning fake empty data", async () => {
    mockedGet.mockRejectedValueOnce(httpError(404));

    await expect(listStockLedger()).rejects.toBeInstanceOf(
      MissingBackendEndpointError,
    );
  });

  it("surfaces unsupported report endpoints instead of returning fake empty data", async () => {
    mockedGet.mockRejectedValueOnce(httpError(501));

    await expect(listInventoryValueSeries()).rejects.toMatchObject({
      endpoint: "GET /api/wms/reports/inventory-value-series",
      status: 501,
    });
  });

  it("does not hide auth failures behind empty fallback data", async () => {
    const error = httpError(401);
    mockedGet.mockRejectedValueOnce(error);

    await expect(listStockMovements()).rejects.toBe(error);
  });
});
