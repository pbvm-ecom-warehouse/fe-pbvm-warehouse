import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-client", () => ({
  apiClient: { get: vi.fn(), patch: vi.fn(), put: vi.fn() },
}));

import { apiClient } from "@/lib/api-client";
import {
  fetchRackTemplate,
  fetchWarehouseLayout,
} from "@/features/warehouse-layout/services/warehouse-layout.service";

describe("fetchWarehouseLayout", () => {
  it("map response BE sang WarehouseLayout, ráp kích thước rack từ rackTemplate dùng chung, tính canvas từ bounding box zone", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        zones: [
          { id: "z1", code: "A", name: "Zone A", xM: 1, yM: 1, widthM: 16, heightM: 22, rotation: 0 },
        ],
        racks: [
          { id: "r1", zoneId: "z1", code: "A1", name: "Rack A1", xM: 3, yM: 3, rotation: 0, accessPointXM: 8, accessPointYM: 6 },
        ],
        aisles: [],
        gates: [],
        rackTemplate: { widthM: 10, depthM: 1.5, levelCount: 3, bayCount: 3 },
      },
    });

    const layout = await fetchWarehouseLayout();

    expect(layout.zones).toHaveLength(1);
    expect(layout.racks[0].widthM).toBe(10);
    expect(layout.racks[0].depthM).toBe(1.5);
    expect(layout.racks[0].levelCount).toBe(3);
    expect(layout.racks[0].bayCount).toBe(3);
    expect(layout.canvas.widthM).toBeGreaterThanOrEqual(17); // 1 + 16
    expect(layout.canvas.heightM).toBeGreaterThanOrEqual(23); // 1 + 22
    expect(layout.status).toBe("PUBLISHED");
  });
});

describe("fetchRackTemplate", () => {
  it("gọi GET /location/rack-template", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { widthM: 10, depthM: 1.5, levelCount: 3, bayCount: 3 },
    });

    const template = await fetchRackTemplate();

    expect(template.widthM).toBe(10);
    expect(apiClient.get).toHaveBeenCalledWith("/location/rack-template");
  });
});
