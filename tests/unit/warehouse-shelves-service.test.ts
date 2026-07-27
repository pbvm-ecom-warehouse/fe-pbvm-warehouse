import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-client", () => ({
  apiClient: { get: vi.fn() },
}));

import { apiClient } from "@/lib/api-client";
import {
  fetchShelfContents,
  fetchShelvesForRacks,
} from "@/features/warehouse-layout/services/warehouse-shelves.service";

describe("fetchShelfContents", () => {
  it("map response BE sang ShelfContentItem", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: [
        {
          id: "inv1",
          sku: "SKU-1",
          itemName: "Cốc 500ml",
          unit: "cái",
          quantity: 24,
          lotNumber: "LOT-01",
          expiryDate: "2026-12-31",
        },
      ],
    });

    const items = await fetchShelfContents("shelf1");

    expect(items).toEqual([
      {
        id: "inv1",
        sku: "SKU-1",
        itemName: "Cốc 500ml",
        unit: "cái",
        quantity: 24,
        lotNumber: "LOT-01",
        expiryDate: "2026-12-31",
      },
    ]);
  });
});

describe("fetchShelvesForRacks", () => {
  it("gọi listShelves song song cho từng rackId, trả map", async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string, config) => {
      const rackId = (config as { params?: { rackId?: string } })?.params
        ?.rackId;
      return Promise.resolve({
        data: [{ id: `shelf-${rackId}`, rackId, level: 1, code: `${rackId}-S01`, isStaging: false, createdAt: "", updatedAt: "" }],
      });
    });

    const map = await fetchShelvesForRacks(["rack1", "rack2"]);

    expect(map.get("rack1")).toHaveLength(1);
    expect(map.get("rack2")).toHaveLength(1);
  });
});
