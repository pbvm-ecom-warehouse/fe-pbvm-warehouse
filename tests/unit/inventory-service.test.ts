import { describe, expect, it } from "vitest";

import {
  listInventoryValueSeries,
  listStockLedger,
  listStockMovements,
} from "@/features/inventory/inventory.service";
import { MissingBackendEndpointError } from "@/lib/api-contract";

describe("inventory API service", () => {
  it("blocks unsupported ledger endpoints without sending a request", async () => {
    await expect(listStockLedger()).rejects.toMatchObject({
      endpoint: "GET /api/wms/inventory/ledger",
    });
    await expect(listStockLedger()).rejects.toBeInstanceOf(
      MissingBackendEndpointError,
    );
  });

  it("blocks unsupported movement endpoints without fallback data", async () => {
    await expect(listStockMovements()).rejects.toMatchObject({
      endpoint: "GET /api/wms/inventory/movements",
    });
  });

  it("blocks unsupported report endpoints without fallback data", async () => {
    await expect(listInventoryValueSeries()).rejects.toMatchObject({
      endpoint: "GET /api/wms/reports/inventory-value-series",
    });
  });
});
