import { describe, expect, it } from "vitest";

import {
  buildWarehouseLayoutOperations,
  reconcileRackShelves,
  setStagingRack,
} from "@/features/warehouse-layout/utils/warehouse-layout-operations";
import type { WarehouseLayout } from "@/types/api";

const base: WarehouseLayout = {
  id: "single-warehouse-layout",
  revision: 4,
  status: "PUBLISHED",
  updatedAt: "2026-07-27T00:00:00.000Z",
  canvas: { widthM: 40, heightM: 24, gridM: 0.5 },
  rackTemplate: {
    widthM: 6,
    depthM: 1.5,
    heightM: 2,
    levelCount: 2,
    bayCount: 3,
  },
  zones: [],
  racks: [],
  shelves: [],
  aisles: [],
  gates: [],
};

describe("buildWarehouseLayoutOperations", () => {
  it("tạo Zone → Rack → Shelf với tham chiếu ID tạm đúng thứ tự", () => {
    const zoneId = "tmp:00000000-0000-4000-8000-000000000001";
    const rackId = "tmp:00000000-0000-4000-8000-000000000002";
    const shelfId = "tmp:00000000-0000-4000-8000-000000000003";
    const draft: WarehouseLayout = {
      ...structuredClone(base),
      zones: [
        {
          id: zoneId,
          code: "A",
          name: "Khu A",
          xM: 1,
          yM: 1,
          widthM: 12,
          heightM: 8,
          rotation: 0,
        },
      ],
      racks: [
        {
          id: rackId,
          zoneId,
          code: "A-01",
          name: "Rack A-01",
          xM: 2,
          yM: 2,
          widthM: 6,
          depthM: 1.5,
          rotation: 0,
          levelCount: 2,
          bayCount: 3,
          shelfCodes: ["A-01-T1"],
          accessPoint: { xM: 5, yM: 4 },
        },
      ],
      shelves: [
        { id: shelfId, rackId, level: 1, code: "A-01-T1", isStaging: false },
      ],
    };

    const operations = buildWarehouseLayoutOperations(base, draft);

    expect(operations.map(({ entity }) => entity)).toEqual([
      "ZONE",
      "RACK",
      "SHELF",
    ]);
    expect(operations[1]).toMatchObject({
      op: "CREATE",
      clientId: rackId,
      data: { zoneId },
    });
    expect(operations[2]).toMatchObject({
      op: "CREATE",
      clientId: shelfId,
      data: { rackId },
    });
  });

  it("update canvas/template và chỉ gửi field thay đổi", () => {
    const draft = structuredClone(base);
    draft.canvas.widthM = 48;
    draft.rackTemplate!.depthM = 2;

    expect(buildWarehouseLayoutOperations(base, draft)).toEqual([
      { op: "UPDATE", entity: "CANVAS", patch: { widthM: 48 } },
      { op: "UPDATE", entity: "RACK_TEMPLATE", patch: { depthM: 2 } },
    ]);
  });

  it("chia đều tổng chiều cao và đồng bộ lại kích thước mọi tầng", () => {
    const layout = structuredClone(base);
    layout.rackTemplate = {
      widthM: 8,
      depthM: 2,
      heightM: 3,
      levelCount: 3,
      bayCount: 4,
    };
    layout.racks = [
      {
        id: "r1",
        zoneId: "z1",
        code: "RACK-01",
        name: "Kệ 1",
        xM: 1,
        yM: 1,
        widthM: 6,
        depthM: 1.5,
        rotation: 0,
        levelCount: 2,
        bayCount: 3,
        shelfCodes: ["RACK-01-T1", "RACK-01-T2"],
        accessPoint: { xM: 4, yM: 3 },
      },
    ];
    layout.shelves = [
      {
        id: "s1",
        rackId: "r1",
        level: 1,
        code: "RACK-01-T1",
        innerWidth: 600,
        innerDepth: 150,
        innerHeight: 75,
        isStaging: false,
      },
    ];

    const next = reconcileRackShelves(layout, () => "tmp:new");

    expect(next.shelves).toHaveLength(3);
    expect(next.shelves).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: 1,
          innerWidth: 800,
          innerDepth: 200,
          innerHeight: 100,
        }),
        expect.objectContaining({
          level: 3,
          innerWidth: 800,
          innerDepth: 200,
          innerHeight: 100,
        }),
      ]),
    );
  });

  it("xóa Shelf trước Rack trước Zone để vượt delete guards", () => {
    const persisted = structuredClone(base);
    persisted.zones = [
      {
        id: "z1",
        code: "A",
        name: "Khu A",
        xM: 1,
        yM: 1,
        widthM: 12,
        heightM: 8,
        rotation: 0,
      },
    ];
    persisted.racks = [
      {
        id: "r1",
        zoneId: "z1",
        code: "A-01",
        name: "Rack A-01",
        xM: 2,
        yM: 2,
        widthM: 6,
        depthM: 1.5,
        rotation: 0,
        levelCount: 2,
        bayCount: 3,
        shelfCodes: ["A-01-T1"],
        accessPoint: { xM: 5, yM: 4 },
      },
    ];
    persisted.shelves = [
      { id: "s1", rackId: "r1", level: 1, code: "A-01-T1", isStaging: false },
    ];

    expect(buildWarehouseLayoutOperations(persisted, base)).toEqual([
      { op: "DELETE", entity: "SHELF", id: "s1" },
      { op: "DELETE", entity: "RACK", id: "r1" },
      { op: "DELETE", entity: "ZONE", id: "z1" },
    ]);
  });
  it("xóa lối đi cũ trước khi tạo lối đi mới dùng lại cùng mã", () => {
    const persisted = structuredClone(base);
    persisted.aisles = [
      {
        id: "aisle-old",
        code: "AISLE-03",
        type: "MAIN",
        xM: 1,
        yM: 1,
        widthM: 8,
        heightM: 1,
      },
    ];
    const draft = structuredClone(base);
    draft.aisles = [
      {
        id: "tmp:00000000-0000-4000-8000-000000000004",
        code: "AISLE-03",
        type: "MAIN",
        xM: 2,
        yM: 2,
        widthM: 10,
        heightM: 1,
      },
    ];

    expect(buildWarehouseLayoutOperations(persisted, draft)).toEqual([
      { op: "DELETE", entity: "AISLE", id: "aisle-old" },
      {
        op: "CREATE",
        entity: "AISLE",
        clientId: "tmp:00000000-0000-4000-8000-000000000004",
        data: {
          code: "AISLE-03",
          type: "MAIN",
          xM: 2,
          yM: 2,
          widthM: 10,
          heightM: 1,
        },
      },
    ]);
  });
  it("chọn nhận tạm theo cả rack và giữ mọi rack khác là vị trí lưu trữ", () => {
    const layout = structuredClone(base);
    layout.racks = [
      {
        id: "rack-temp",
        zoneId: "z1",
        code: "RACK-00",
        name: "Kệ tạm",
        xM: 0,
        yM: 0,
        widthM: 6,
        depthM: 1.5,
        rotation: 0,
        levelCount: 3,
        bayCount: 3,
        shelfCodes: ["RACK-00-T1", "RACK-00-T2", "RACK-00-T3"],
        accessPoint: { xM: 1, yM: 1 },
      },
      {
        id: "rack-storage",
        zoneId: "z1",
        code: "RACK-10",
        name: "Kệ chính",
        xM: 10,
        yM: 0,
        widthM: 6,
        depthM: 1.5,
        rotation: 0,
        levelCount: 3,
        bayCount: 3,
        shelfCodes: ["RACK-10-T1", "RACK-10-T2", "RACK-10-T3"],
        accessPoint: { xM: 11, yM: 1 },
      },
    ];
    layout.shelves = [
      {
        id: "t1",
        rackId: "rack-temp",
        level: 1,
        code: "RACK-00-T1",
        isStaging: false,
      },
      {
        id: "t2",
        rackId: "rack-temp",
        level: 2,
        code: "RACK-00-T2",
        isStaging: false,
      },
      {
        id: "t3",
        rackId: "rack-temp",
        level: 3,
        code: "RACK-00-T3",
        isStaging: false,
      },
      {
        id: "s1",
        rackId: "rack-storage",
        level: 1,
        code: "RACK-10-T1",
        isStaging: true,
      },
      {
        id: "s2",
        rackId: "rack-storage",
        level: 2,
        code: "RACK-10-T2",
        isStaging: false,
      },
      {
        id: "s3",
        rackId: "rack-storage",
        level: 3,
        code: "RACK-10-T3",
        isStaging: false,
      },
    ];

    const next = setStagingRack(layout, "rack-temp");

    expect(next.shelves.map((shelf) => [shelf.id, shelf.isStaging])).toEqual([
      ["t1", true],
      ["t2", true],
      ["t3", true],
      ["s1", false],
      ["s2", false],
      ["s3", false],
    ]);
  });
  it("bổ sung tầng còn thiếu theo rack template và giữ rack nhận tạm theo cả 3 tầng", () => {
    const layout = structuredClone(base);
    layout.rackTemplate = {
      widthM: 10,
      depthM: 1.5,
      heightM: 3,
      levelCount: 3,
      bayCount: 4,
    };
    layout.racks = [
      {
        id: "rack-temp",
        zoneId: "z1",
        code: "RACK-00",
        name: "Kệ tạm",
        xM: 0,
        yM: 0,
        widthM: 10,
        depthM: 1.5,
        rotation: 0,
        levelCount: 2,
        bayCount: 4,
        shelfCodes: ["RACK-00-T1", "RACK-00-T2"],
        accessPoint: { xM: 1, yM: 1 },
      },
    ];
    layout.shelves = [
      {
        id: "t1",
        rackId: "rack-temp",
        level: 1,
        code: "RACK-00-T1",
        isStaging: true,
      },
      {
        id: "t2",
        rackId: "rack-temp",
        level: 2,
        code: "RACK-00-T2",
        isStaging: true,
      },
    ];

    const next = reconcileRackShelves(layout, () => "tmp:new-t3");

    expect(next.racks[0]).toMatchObject({
      levelCount: 3,
      shelfCodes: ["RACK-00-T1", "RACK-00-T2", "RACK-00-T3"],
    });
    expect(next.shelves).toHaveLength(3);
    expect(next.shelves[2]).toEqual({
      id: "tmp:new-t3",
      rackId: "rack-temp",
      level: 3,
      code: "RACK-00-T3",
      innerDepth: 150,
      innerWidth: 1000,
      innerHeight: 100,
      isStaging: true,
    });
  });
});
