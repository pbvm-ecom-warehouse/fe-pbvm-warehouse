import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { WarehouseFloorPlan } from "@/features/warehouse-layout/components/warehouse-floor-plan";
import type { WarehouseLayout } from "@/types/api";

const layout: WarehouseLayout = {
  id: "single-warehouse-layout",
  revision: 1,
  status: "PUBLISHED",
  updatedAt: "2026-07-27T00:00:00.000Z",
  canvas: { widthM: 20, heightM: 12, gridM: 0.5 },
  rackTemplate: { widthM: 5, depthM: 1.5, levelCount: 2, bayCount: 2 },
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
});

describe("WarehouseFloorPlan editor tools", () => {
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
});
