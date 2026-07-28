import { describe, expect, it } from "vitest";

import {
  cloneWarehouseLayout,
  findRackAccessPoint,
  getRackRect,
  isRackHeightWhitelistIssue,
  reconnectRackAccessPoints,
  snapToGrid,
  validateWarehouseLayoutClient,
} from "@/features/warehouse-layout/utils/warehouse-layout";
import type { WarehouseLayout } from "@/types/api";

const editorLayout: WarehouseLayout = {
  id: "single-warehouse-layout",
  revision: 1,
  status: "PUBLISHED",
  updatedAt: "2026-07-27T00:00:00.000Z",
  canvas: { widthM: 40, heightM: 24, gridM: 0.5 },
  rackTemplate: {
    widthM: 10,
    depthM: 1.5,
    heightM: 3,
    levelCount: 3,
    bayCount: 3,
  },
  zones: [
    {
      id: "zone-a",
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
      id: "rack-a1",
      zoneId: "zone-a",
      code: "A1",
      name: "Rack A1",
      xM: 3,
      yM: 3,
      widthM: 10,
      depthM: 1.5,
      rotation: 0,
      levelCount: 3,
      bayCount: 3,
      shelfCodes: ["A1-S01", "A1-S02", "A1-S03"],
      accessPoint: { xM: 8, yM: 6 },
    },
    {
      id: "rack-a2",
      zoneId: "zone-a",
      code: "A2",
      name: "Rack A2",
      xM: 3,
      yM: 11,
      widthM: 10,
      depthM: 1.5,
      rotation: 0,
      levelCount: 2,
      bayCount: 3,
      shelfCodes: ["A2-S01", "A2-S02"],
      accessPoint: { xM: 8, yM: 8 },
    },
  ],
  shelves: [],
  aisles: [
    {
      id: "main-01",
      code: "MAIN-01",
      type: "MAIN",
      xM: 18,
      yM: 0,
      widthM: 4,
      heightM: 24,
    },
    {
      id: "aisle-a1",
      code: "AISLE-A1",
      type: "RACK",
      xM: 1,
      yM: 6,
      widthM: 16,
      heightM: 2,
    },
  ],
  gates: [
    {
      id: "gate-01",
      code: "GATE-01",
      label: "Cổng vào",
      xM: 20,
      yM: 23,
    },
  ],
};

describe("warehouse architectural layout", () => {
  it("keeps main aisles wider than rack aisles", () => {
    const mainWidths = editorLayout.aisles
      .filter((aisle) => aisle.type === "MAIN")
      .map((aisle) => Math.min(aisle.widthM, aisle.heightM));
    const rackWidths = editorLayout.aisles
      .filter((aisle) => aisle.type === "RACK")
      .map((aisle) => Math.min(aisle.widthM, aisle.heightM));

    expect(Math.min(...mainWidths)).toBeGreaterThan(Math.max(...rackWidths));
    expect(
      validateWarehouseLayoutClient(editorLayout, {
        publishing: true,
      }),
    ).toEqual([]);
  });

  it("snaps editor coordinates and rotates rack footprints", () => {
    expect(snapToGrid(3.24, 0.5)).toBe(3);
    expect(snapToGrid(3.26, 0.5)).toBe(3.5);

    const rack = {
      ...editorLayout.racks[0],
      rotation: 90 as const,
    };

    expect(getRackRect(rack)).toMatchObject({
      widthM: rack.depthM,
      heightM: rack.widthM,
    });
  });

  it("báo rõ mã layout nào đang bị trùng", () => {
    const layout = cloneWarehouseLayout(editorLayout);
    layout.aisles.push({
      ...layout.aisles[1],
      id: "aisle-copy",
      code: "AISLE-A1",
      yM: 9,
    });

    expect(validateWarehouseLayoutClient(layout)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("AISLE-A1 đang bị dùng 2 lần"),
      ]),
    );
  });
  it("reports overlap errors before publish", () => {
    const layout = cloneWarehouseLayout(editorLayout);
    layout.racks[1].xM = layout.racks[0].xM;
    layout.racks[1].yM = layout.racks[0].yM;

    expect(validateWarehouseLayoutClient(layout, { publishing: true })).toEqual(
      expect.arrayContaining([expect.stringMatching(/chồng lên/)]),
    );
  });

  it("chặn rack có điểm tiếp cận không nằm trong lối đi", () => {
    const layout = cloneWarehouseLayout(editorLayout);
    layout.racks[0].accessPoint = { xM: 8, yM: 5 };

    expect(validateWarehouseLayoutClient(layout)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("A1 chưa nối với lối đi"),
      ]),
    );
  });

  it("chọn điểm tiếp cận gần rack nằm bên trong lối đi", () => {
    expect(
      findRackAccessPoint(
        editorLayout.racks[0],
        editorLayout.aisles,
        editorLayout.canvas.gridM,
      ),
    ).toEqual({ xM: 8, yM: 6 });
    expect(
      findRackAccessPoint(editorLayout.racks[0], [], editorLayout.canvas.gridM),
    ).toBeNull();
  });

  it("tự nối rack với lối đi gần nhất dù xa hơn 2 m", () => {
    const rack = {
      ...editorLayout.racks[0],
      xM: 28,
      yM: 15,
    };

    expect(findRackAccessPoint(rack, [editorLayout.aisles[1]], 0.5)).toEqual({
      xM: 17,
      yM: 8,
    });
  });

  it("ưu tiên lối đi giữa rack khi khoảng cách bằng đường chính", () => {
    const rack = {
      ...editorLayout.racks[0],
      xM: 8,
      yM: 8,
      widthM: 2,
      depthM: 2,
    };

    expect(
      findRackAccessPoint(
        rack,
        [
          {
            id: "main",
            code: "MAIN",
            type: "MAIN",
            xM: 4,
            yM: 8,
            widthM: 2,
            heightM: 2,
          },
          {
            id: "rack-aisle",
            code: "RACK-AISLE",
            type: "RACK",
            xM: 12,
            yM: 8,
            widthM: 2,
            heightM: 2,
          },
        ],
        0.5,
      ),
    ).toEqual({ xM: 12, yM: 9 });
  });

  it("tính lại access point của mọi rack sau khi aisle thay đổi", () => {
    const layout = cloneWarehouseLayout(editorLayout);
    layout.aisles = [
      {
        id: "new-rack-aisle",
        code: "AISLE-NEW",
        type: "RACK",
        xM: 14,
        yM: 0,
        widthM: 2,
        heightM: 24,
      },
    ];

    const reconnected = reconnectRackAccessPoints(layout);

    expect(reconnected.racks.map((rack) => rack.accessPoint)).toEqual([
      { xM: 14, yM: 3.75 },
      { xM: 14, yM: 11.75 },
    ]);
  });

  it("cập nhật zoneId khi rack được chuyển hoàn toàn sang zone khác", () => {
    const layout = cloneWarehouseLayout(editorLayout);
    layout.zones.push({
      id: "zone-b",
      code: "B",
      name: "Zone B",
      xM: 20,
      yM: 1,
      widthM: 16,
      heightM: 22,
      rotation: 0,
    });
    layout.racks[0] = {
      ...layout.racks[0],
      xM: 22,
      zoneId: "zone-a",
    };

    const reconnected = reconnectRackAccessPoints(layout);

    expect(reconnected.racks[0].zoneId).toBe("zone-b");
  });

  it("nhận diện backend cũ từ lỗi whitelist heightM", () => {
    expect(
      isRackHeightWhitelistIssue([
        {
          entity: "RACK_TEMPLATE",
          field: "heightM",
          code: "whitelistValidation",
        },
      ]),
    ).toBe(true);
    expect(
      isRackHeightWhitelistIssue([
        {
          entity: "RACK_TEMPLATE",
          field: "widthM",
          code: "VALUE_MUST_BE_POSITIVE",
        },
      ]),
    ).toBe(false);
  });
});
