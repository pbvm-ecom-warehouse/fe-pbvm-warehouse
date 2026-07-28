import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-client", () => ({
  apiClient: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

import { apiClient } from "@/lib/api-client";
import {
  fetchWarehouseLayout,
  mapWarehouseLayoutResponse,
  resetWarehouseLayout,
  saveWarehouseLayout,
} from "@/features/warehouse-layout/services/warehouse-layout.service";

const apiLayout = {
  id: "single-warehouse-layout" as const,
  revision: 7,
  updatedAt: "2026-07-27T10:00:00.000Z",
  canvas: { widthM: 40, heightM: 24, gridM: 0.5 },
  zones: [
    {
      id: "z1",
      code: "A",
      name: "Zone A",
      xM: 1,
      yM: 1,
      widthM: 16,
      heightM: 22,
      rotation: 0,
    },
  ],
  racks: [
    {
      id: "r1",
      zoneId: "z1",
      code: "A1",
      name: "Rack A1",
      xM: 3,
      yM: 3,
      rotation: 0,
      accessPointXM: 8,
      accessPointYM: 6,
    },
  ],
  shelves: [
    { id: "s1", rackId: "r1", level: 1, code: "A1-T1", isStaging: false },
  ],
  aisles: [],
  gates: [],
  rackTemplate: {
    widthM: 10,
    depthM: 1.5,
    heightM: 3,
    levelCount: 3,
    bayCount: 3,
  },
};

describe("fetchWarehouseLayout", () => {
  it("giữ snapshot canonical và ráp kích thước/shelfCodes của rack", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: apiLayout });

    const layout = await fetchWarehouseLayout();

    expect(layout.racks[0]).toMatchObject({
      widthM: 10,
      depthM: 1.5,
      levelCount: 3,
      bayCount: 3,
      shelfCodes: ["A1-T1"],
    });
    expect(layout.shelves).toEqual([
      expect.objectContaining({ id: "s1", rackId: "r1" }),
    ]);
    expect(layout.canvas).toEqual({ widthM: 40, heightM: 24, gridM: 0.5 });
    expect(layout.revision).toBe(7);
    expect(layout.updatedAt).toBe("2026-07-27T10:00:00.000Z");
    expect(layout.status).toBe("PUBLISHED");
  });

  it("chặn snapshot legacy thiếu contract editor trước khi tạo draft", () => {
    const legacyLayout = {
      zones: [],
      racks: [],
      aisles: [],
      gates: [],
      rackTemplate: {
        widthM: 10,
        depthM: 1.5,
        levelCount: 3,
        bayCount: 3,
      },
    };

    expect(() => mapWarehouseLayoutResponse(legacyLayout as never)).toThrow(
      /canvas.*revision.*shelves/i,
    );
  });

  it("chặn snapshot có canvas thiếu kích thước hoặc metadata canonical", () => {
    const malformedLayout = {
      ...apiLayout,
      id: undefined,
      updatedAt: undefined,
      canvas: { widthM: 40, gridM: 0.5 },
    };

    expect(() => mapWarehouseLayoutResponse(malformedLayout)).toThrow(
      /id.*updatedAt.*canvas\.heightM/i,
    );
  });
});

describe("saveWarehouseLayout", () => {
  it("PATCH change-set và trả layout canonical mới", async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({
      data: {
        revision: 8,
        idMap: { "tmp:00000000-0000-4000-8000-000000000001": "z1" },
        layout: { ...apiLayout, revision: 8 },
      },
    });
    const request = {
      expectedRevision: 7,
      operations: [
        {
          op: "UPDATE" as const,
          entity: "CANVAS" as const,
          patch: { widthM: 40 },
        },
      ],
    };

    const result = await saveWarehouseLayout(request);

    expect(apiClient.patch).toHaveBeenCalledWith("/location/layout", request);
    expect(result.revision).toBe(8);
    expect(result.layout.revision).toBe(8);
  });
});


describe("resetWarehouseLayout", () => {
  it("POST reset endpoint và trả layout canonical mới", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: apiLayout });

    const result = await resetWarehouseLayout(7);

    expect(apiClient.post).toHaveBeenCalledWith("/location/layout/reset", {
      expectedRevision: 7,
    });
    expect(result.revision).toBe(7);
    expect(result.canvas).toEqual({ widthM: 40, heightM: 24, gridM: 0.5 });
  });
});
