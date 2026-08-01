import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  calculateFitViewBox,
  WarehouseFloorPlan,
} from "@/features/warehouse-layout/components/warehouse-floor-plan";
import type { WarehouseLayout } from "@/types/api";

const layout: WarehouseLayout = {
  id: "single-warehouse-layout",
  revision: 1,
  status: "PUBLISHED",
  updatedAt: "2026-07-27T00:00:00.000Z",
  canvas: { widthM: 20, heightM: 12, gridM: 0.5 },
  rackTemplate: {
    widthM: 5,
    depthM: 1.5,
    heightM: 2,
    levelCount: 2,
    bayCount: 2,
  },
  zones: [],
  racks: [],
  shelves: [],
  aisles: [],
  gates: [{ id: "gate-1", code: "GATE-01", label: "Cổng nhận", xM: 2, yM: 2 }],
};

beforeAll(() => {
  Object.defineProperty(SVGSVGElement.prototype, "createSVGPoint", {
    configurable: true,
    value() {
      return {
        x: 0,
        y: 0,
        matrixTransform() {
          return { x: this.x, y: this.y };
        },
      };
    },
  });
  Object.defineProperty(SVGSVGElement.prototype, "getScreenCTM", {
    configurable: true,
    value: () => ({ inverse: () => ({}) }),
  });
  Object.defineProperty(SVGSVGElement.prototype, "setPointerCapture", {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(SVGSVGElement.prototype, "releasePointerCapture", {
    configurable: true,
    value: vi.fn(),
  });
});

describe("WarehouseFloorPlan editor tools", () => {
  it("vẽ đường chia khoang ngang khi rack xoay 90 độ", () => {
    const rotatedLayout: WarehouseLayout = {
      ...layout,
      racks: [
        {
          id: "rack-rotated",
          zoneId: "zone-1",
          code: "RACK-90",
          name: "Rack xoay",
          xM: 2,
          yM: 2,
          widthM: 5,
          depthM: 1.5,
          rotation: 90,
          levelCount: 3,
          bayCount: 3,
          shelfCodes: ["RACK-90-T1", "RACK-90-T2", "RACK-90-T3"],
          accessPoint: { xM: 2, yM: 4.5 },
        },
      ],
    };

    render(<WarehouseFloorPlan layout={rotatedLayout} tool="select" />);

    const rack = screen.getByRole("button", { name: "Rack xoay" });
    const dividers = rack.querySelectorAll("line");

    expect(dividers).toHaveLength(2);
    dividers.forEach((divider) => {
      expect(divider.getAttribute("y1")).toBe(divider.getAttribute("y2"));
      expect(divider.getAttribute("x1")).not.toBe(divider.getAttribute("x2"));
    });
  });

  it("phát create event đã snap khi dùng công cụ khu vực", () => {
    const onCreate = vi.fn();
    render(
      <WarehouseFloorPlan
        editable
        layout={layout}
        onCreate={onCreate}
        tool="zone"
      />,
    );

    fireEvent.pointerDown(screen.getByLabelText("Sơ đồ kho"), {
      button: 0,
      clientX: 4.2,
      clientY: 5.1,
      pointerId: 1,
    });

    expect(onCreate).toHaveBeenCalledWith("zone", { xM: 4, yM: 5 });
  });

  it("Gate chỉ có thể di chuyển, không render resize handle", () => {
    render(
      <WarehouseFloorPlan
        editable
        layout={layout}
        selection={{ kind: "gate", id: "gate-1" }}
      />,
    );

    expect(
      screen.queryByLabelText("Thay đổi kích thước"),
    ).not.toBeInTheDocument();
  });

  it("kéo cả group trong khu vực khi giữ Ctrl", () => {
    const onMoveGroup = vi.fn();
    const groupLayout: WarehouseLayout = {
      ...layout,
      zones: [
        {
          id: "zone-1",
          code: "ZONE-01",
          name: "Khu vực 1",
          xM: 1,
          yM: 1,
          widthM: 8,
          heightM: 5,
          rotation: 0,
        },
      ],
      racks: [
        {
          id: "rack-1",
          zoneId: "zone-1",
          code: "RACK-01",
          name: "Rack 1",
          xM: 2,
          yM: 2,
          widthM: 5,
          depthM: 1.5,
          rotation: 0,
          levelCount: 2,
          bayCount: 2,
          shelfCodes: ["RACK-01-T1", "RACK-01-T2"],
          accessPoint: { xM: 4.5, yM: 4 },
        },
      ],
      aisles: [
        {
          id: "aisle-1",
          code: "AISLE-01",
          type: "RACK",
          xM: 2,
          yM: 4,
          widthM: 4,
          heightM: 0.8,
        },
      ],
      gates: [
        { id: "gate-1", code: "GATE-01", label: "Cổng nhận", xM: 3, yM: 3 },
      ],
    };

    render(
      <WarehouseFloorPlan
        editable
        layout={groupLayout}
        onMoveGroup={onMoveGroup}
        tool="select"
      />,
    );

    fireEvent.pointerDown(
      screen.getByLabelText("Khu vực 1, Lưu trữ, 8 x 5 mét"),
      {
        button: 0,
        clientX: 1,
        clientY: 1,
        ctrlKey: true,
        pointerId: 1,
      },
    );
    fireEvent.pointerMove(screen.getByLabelText("Sơ đồ kho"), {
      clientX: 2,
      clientY: 1.5,
      pointerId: 1,
    });

    expect(onMoveGroup).toHaveBeenCalledWith(
      expect.arrayContaining([
        {
          selection: { kind: "zone", id: "zone-1" },
          position: { xM: 2, yM: 1.5 },
        },
        {
          selection: { kind: "rack", id: "rack-1" },
          position: { xM: 3, yM: 2.5 },
        },
        {
          selection: { kind: "aisle", id: "aisle-1" },
          position: { xM: 3, yM: 4.5 },
        },
        {
          selection: { kind: "gate", id: "gate-1" },
          position: { xM: 4, yM: 3.5 },
        },
      ]),
    );
  });
  it("đánh dấu phần tử lỗi geometry bằng màu đỏ", () => {
    render(
      <WarehouseFloorPlan
        invalidSelectionKeys={new Set(["gate:gate-1"])}
        layout={layout}
      />,
    );

    const gate = screen.getByLabelText("Cổng nhận");
    expect(gate.querySelector("circle")).toHaveAttribute("fill", "#dc2626");
  });

  it("fit viewBox theo đúng tỷ lệ khung và vẫn chứa toàn bộ boundary", () => {
    const viewBox = calculateFitViewBox(40, 24, 1000, 600, 1);

    expect(viewBox.width / viewBox.height).toBeCloseTo(1000 / 600);
    expect(viewBox.x).toBeLessThanOrEqual(0);
    expect(viewBox.y).toBeLessThanOrEqual(0);
    expect(viewBox.x + viewBox.width).toBeGreaterThanOrEqual(40);
    expect(viewBox.y + viewBox.height).toBeGreaterThanOrEqual(24);
  });

  it("focus lối đi không dùng outline mặc định và chọn bằng bàn phím", () => {
    const onSelect = vi.fn();
    const layoutWithAisle: WarehouseLayout = {
      ...layout,
      aisles: [
        {
          id: "aisle-1",
          code: "AISLE-01",
          type: "MAIN",
          xM: 8,
          yM: 0,
          widthM: 2,
          heightM: 12,
        },
      ],
    };
    render(
      <WarehouseFloorPlan
        editable
        layout={layoutWithAisle}
        onSelect={onSelect}
        tool="select"
      />,
    );

    const aisle = screen.getByRole("button", { name: "Đường chính AISLE-01" });
    expect(aisle).toHaveClass("outline-none");
    fireEvent.focus(aisle);
    expect(onSelect).toHaveBeenCalledWith({ kind: "aisle", id: "aisle-1" });
  });
});
