import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WarehouseLayout } from "@/types/api";

const {
  baseLayout,
  fetchWarehouseLayout,
  listRackCells,
  routeLayout,
  resetWarehouseLayout,
  saveWarehouseLayout,
} = vi.hoisted(() => {
  const layout: WarehouseLayout = {
    id: "single-warehouse-layout",
    revision: 3,
    updatedAt: "2026-07-27T10:00:00.000Z",
    status: "PUBLISHED",
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
  const routeLayout: WarehouseLayout = {
    ...layout,
    racks: [
      {
        id: "rack-1",
        zoneId: "zone-1",
        code: "RACK-01",
        name: "Rack 01",
        xM: 4,
        yM: 4,
        widthM: 6,
        depthM: 1.5,
        rotation: 0,
        levelCount: 2,
        bayCount: 3,
        shelfCodes: ["RACK-01-T1", "RACK-01-T2"],
        accessPoint: { xM: 4, yM: 5.5 },
      },
    ],
    aisles: [
      {
        id: "aisle-1",
        code: "AISLE-01",
        type: "MAIN",
        xM: 0,
        yM: 5,
        widthM: 20,
        heightM: 2,
      },
    ],
    gates: [{ id: "gate-1", code: "GATE-01", label: "Cổng 1", xM: 1, yM: 6 }],
  };

  return {
    baseLayout: layout,
    fetchWarehouseLayout: vi.fn().mockResolvedValue(layout),
    listRackCells: vi.fn().mockResolvedValue([]),
    routeLayout,
    resetWarehouseLayout: vi.fn().mockResolvedValue(layout),
    saveWarehouseLayout: vi.fn(),
  };
});

vi.mock(
  "@/features/warehouse-layout/services/warehouse-layout.service",
  () => ({
    fetchWarehouseLayout,
    resetWarehouseLayout,
    saveWarehouseLayout,
  }),
);

vi.mock(
  "@/features/warehouse-navigation/services/warehouse-operations.service",
  () => ({
    listRackCells,
  }),
);

vi.mock("@/hooks/use-session-user", () => ({
  useSessionUser: () => ({ id: "u1", roles: ["MANAGER"] }),
}));

vi.mock("@/features/warehouse-layout/components/warehouse-floor-plan", () => ({
  WarehouseFloorPlan: ({
    layout,
    onCreate,
    onSelect,
    tool,
  }: {
    layout: WarehouseLayout;
    onCreate?: (
      kind: "zone" | "rack" | "aisle" | "gate",
      point: { xM: number; yM: number },
    ) => void;
    onSelect?: (
      selection: { kind: "zone" | "rack"; id: string } | null,
    ) => void;
    tool: string;
  }) => (
    <div>
      <button
        aria-label="Sơ đồ kho"
        onClick={() => {
          if (
            tool === "zone" ||
            tool === "rack" ||
            tool === "aisle" ||
            tool === "gate"
          ) {
            onCreate?.(tool, { xM: 2, yM: 2 });
          }
        }}
      >
        canvas
      </button>
      <output aria-label="Số zone">{layout.zones.length}</output>
      <output aria-label="Số rack">{layout.racks.length}</output>
      {layout.zones.map((zone) => (
        <button
          aria-label={`Chọn zone ${zone.code}`}
          key={zone.id}
          onClick={() => onSelect?.({ kind: "zone", id: zone.id })}
          type="button"
        >
          {zone.code}
        </button>
      ))}
      {layout.racks.map((rack) => (
        <button
          aria-label={rack.name}
          key={rack.id}
          onClick={() => onSelect?.({ kind: "rack", id: rack.id })}
          type="button"
        >
          {rack.code}
        </button>
      ))}
    </div>
  ),
}));

import { WarehouseMapClient } from "@/features/warehouse-layout/components/warehouse-map-client";

function renderWithClient() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <WarehouseMapClient />
    </QueryClientProvider>,
  );
}

describe("WarehouseMapClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchWarehouseLayout.mockResolvedValue(structuredClone(baseLayout));
    listRackCells.mockResolvedValue([]);
    resetWarehouseLayout.mockResolvedValue(structuredClone(baseLayout));
    saveWarehouseLayout.mockImplementation(async (request) => ({
      revision: 4,
      idMap: {},
      layout: {
        ...structuredClone(baseLayout),
        revision: 4,
        zones: request.operations
          .filter(
            (operation: { entity: string }) => operation.entity === "ZONE",
          )
          .map((operation: { data: object }, index: number) => ({
            id: `z${index + 1}`,
            ...operation.data,
          })),
      },
    }));
  });

  it("render editor mới và không còn form/card kho legacy", async () => {
    renderWithClient();

    expect(await screen.findByText("Bản đồ kho 2D")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Khu vực" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xem" })).toBeInTheDocument();
    expect(
      screen.queryByText("Kích thước rack chuẩn (áp dụng toàn kho)"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Áp dụng cho toàn bộ rack"),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Cao toàn kệ (m)")).toHaveValue(2);
    expect(screen.getByLabelText("Kích thước mỗi khoang")).toHaveTextContent(
      "200 × 150 × 100 cm",
    );
  });

  it("mở mặt kệ khi click rack trong tool Xem", async () => {
    fetchWarehouseLayout.mockResolvedValueOnce(structuredClone(routeLayout));
    listRackCells.mockResolvedValueOnce([
      {
        id: "cell-1",
        rackId: "rack-1",
        shelfId: "shelf-1",
        level: 1,
        bay: 1,
        code: "RACK-01-T1-B1",
        barcode: "RACK-01-T1-B1",
        status: "ACTIVE",
        innerDepth: 100,
        innerWidth: 80,
        innerHeight: 60,
        usableVolumeCm3: 480000,
        occupiedVolumeCm3: 0,
        fillPercent: 0,
        contents: [],
      },
    ]);
    renderWithClient();
    await screen.findByText("Bản đồ kho 2D");

    fireEvent.click(screen.getByRole("button", { name: "Xem" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Chọn rack để xem mặt kệ",
    });
    expect(dialog).toBeVisible();
    expect(within(dialog).getByLabelText("Sơ đồ kho")).toBeVisible();

    fireEvent.click(within(dialog).getByLabelText("Rack 01"));

    expect(
      await screen.findByRole("dialog", { name: "Mặt kệ RACK-01" }),
    ).toBeVisible();
    expect(await screen.findByText("Mặt kệ RACK-01")).toBeVisible();
    expect(listRackCells).toHaveBeenCalledWith("rack-1");
  });

  it("giữ thao tác ở draft và chỉ gọi PATCH batch khi bấm lưu", async () => {
    renderWithClient();
    await screen.findByText("Bản đồ kho 2D");

    fireEvent.click(screen.getByRole("button", { name: "Khu vực" }));
    fireEvent.click(screen.getByLabelText("Sơ đồ kho"));

    expect(saveWarehouseLayout).not.toHaveBeenCalled();
    const saveButton = screen.getByRole("button", { name: "Lưu thay đổi" });
    expect(saveButton).toBeEnabled();
    fireEvent.click(saveButton);

    await waitFor(() => expect(saveWarehouseLayout).toHaveBeenCalledTimes(1));
    expect(saveWarehouseLayout.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        expectedRevision: 3,
        operations: [expect.objectContaining({ op: "CREATE", entity: "ZONE" })],
      }),
    );
  });

  it("không tạo rack khi chưa có lối đi kết nối", async () => {
    renderWithClient();
    await screen.findByText("Bản đồ kho 2D");

    fireEvent.click(screen.getByRole("button", { name: "Khu vực" }));
    fireEvent.click(screen.getByLabelText("Sơ đồ kho"));
    fireEvent.click(screen.getByRole("button", { name: "Rack" }));
    fireEvent.click(screen.getByLabelText("Sơ đồ kho"));

    expect(screen.getByLabelText("Số rack")).toHaveTextContent("0");
  });

  it("gọi API reset riêng sau khi xác nhận reset sơ đồ", async () => {
    renderWithClient();
    await screen.findByText("Bản đồ kho 2D");

    fireEvent.click(screen.getByRole("button", { name: "Reset sơ đồ" }));
    expect(resetWarehouseLayout).not.toHaveBeenCalled();

    fireEvent.click(
      await screen.findByRole("button", { name: "Xoá toàn bộ sơ đồ" }),
    );

    await waitFor(() => expect(resetWarehouseLayout).toHaveBeenCalledTimes(1));
    expect(resetWarehouseLayout).toHaveBeenCalledWith(3);
  });

  it("xóa phần tử bằng Delete và hỗ trợ phím tắt undo/redo", async () => {
    renderWithClient();
    await screen.findByText("Bản đồ kho 2D");

    fireEvent.click(screen.getByRole("button", { name: "Khu vực" }));
    fireEvent.click(screen.getByLabelText("Sơ đồ kho"));

    expect(screen.getByLabelText("Số zone")).toHaveTextContent("1");
    fireEvent.click(screen.getByLabelText("Chọn zone ZONE-01"));

    fireEvent.keyDown(document, { key: "Delete" });
    await waitFor(() => {
      expect(screen.getByLabelText("Số zone")).toHaveTextContent("0");
    });
    expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeDisabled();

    fireEvent.keyDown(document, { ctrlKey: true, key: "z" });
    await waitFor(() => {
      expect(screen.getByLabelText("Số zone")).toHaveTextContent("1");
    });
    expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeEnabled();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Làm lại" })).toBeEnabled();
    });

    fireEvent.keyDown(document, { ctrlKey: true, shiftKey: true, key: "Z" });
    await waitFor(() => {
      expect(screen.getByLabelText("Số zone")).toHaveTextContent("0");
    });
    expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeDisabled();
  });

  it("giữ draft và hiện banner khi revision conflict", async () => {
    saveWarehouseLayout.mockRejectedValueOnce({
      response: {
        status: 409,
        data: {
          error: {
            code: "LAYOUT_REVISION_CONFLICT",
            message: "Layout đã đổi",
            details: { expectedRevision: 3, currentRevision: 4 },
          },
        },
      },
    });
    renderWithClient();
    await screen.findByText("Bản đồ kho 2D");
    fireEvent.click(screen.getByRole("button", { name: "Khu vực" }));
    fireEvent.click(screen.getByLabelText("Sơ đồ kho"));
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    expect(
      await screen.findByText(/Draft đang dựa trên phiên bản 3/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Tải bản mới và bỏ draft" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeEnabled();
  });

  it("hiện lỗi version BE rõ ràng thay vì crash khi snapshot còn contract cũ", async () => {
    fetchWarehouseLayout.mockRejectedValueOnce(
      Object.assign(new Error("API layout cũ"), {
        code: "WAREHOUSE_LAYOUT_API_OUTDATED",
        missingFields: ["canvas", "revision", "shelves"],
      }),
    );

    renderWithClient();

    expect(
      await screen.findByText("Backend WMS chưa có API editor 2D"),
    ).toBeInTheDocument();
    expect(screen.getByText(/canvas, revision, shelves/i)).toBeInTheDocument();
    expect(screen.queryByText("Bản đồ kho 2D")).not.toBeInTheDocument();
  });
});
