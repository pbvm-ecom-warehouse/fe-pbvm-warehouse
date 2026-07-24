import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api-client";
import {
  getLotReport,
  getPerformanceReport,
  getStockReport,
  toPerformanceApiRange,
} from "@/features/reports/services/report.service";

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

const mockedGet = vi.mocked(apiClient.get);

const stockRow = {
  available: 80,
  expired: 5,
  itemName: "Ly nhựa 700ml",
  onHand: 100,
  reserved: 15,
  sku: "SKU-01",
};

const lotRow = {
  expiryDate: "2026-07-25T00:00:00.000Z",
  expiryFlag: "expiringSoon" as const,
  itemName: "Bột sữa",
  lotNumber: "LOT-01",
  quantity: 12,
  sku: "SKU-LOT-01",
  status: "ACTIVE" as const,
};

describe("WMS report API service", () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it("requests stock with only the live Swagger SKU query", async () => {
    mockedGet.mockResolvedValueOnce({ data: [stockRow] });

    await expect(getStockReport({ sku: "  SKU-01  " })).resolves.toEqual([
      stockRow,
    ]);

    expect(mockedGet).toHaveBeenCalledWith("/reports/stock", {
      params: {
        sku: "SKU-01",
      },
    });
  });

  it("accepts a raw lot array as a defensive Swagger fallback", async () => {
    mockedGet.mockResolvedValueOnce({ data: [lotRow] });

    await expect(getLotReport({})).resolves.toEqual([lotRow]);

    expect(mockedGet).toHaveBeenCalledWith("/reports/stock/lots", {
      params: { sku: undefined, status: undefined },
    });
  });

  it("uses inclusive local calendar boundaries when requesting performance", async () => {
    const dateFrom = "2026-07-01";
    const dateTo = "2026-07-31";
    const range = toPerformanceApiRange(dateFrom, dateTo);

    expect(range).toEqual({
      dateFrom: new Date(2026, 6, 1, 0, 0, 0, 0).toISOString(),
      dateTo: new Date(2026, 6, 31, 23, 59, 59, 999).toISOString(),
    });

    mockedGet.mockResolvedValueOnce({
      data: {
        data: [{ movementCount: 4, totalQuantity: 20, type: "RETURN_IN" }],
        meta: {
          requestId: "req-performance-1",
          timestamp: "2026-07-18T08:00:00.000Z",
        },
      },
    });

    await expect(
      getPerformanceReport({ dateFrom, dateTo, sku: "  SKU-01  " }),
    ).resolves.toEqual([
      { movementCount: 4, totalQuantity: 20, type: "RETURN_IN" },
    ]);

    expect(mockedGet).toHaveBeenCalledWith("/reports/performance", {
      params: {
        ...range,
        sku: "SKU-01",
      },
    });
  });
});
