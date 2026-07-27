import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WarehouseLayout } from "@/types/api";

const { baseLayout, fetchWarehouseLayout, saveWarehouseLayout } = vi.hoisted(
  () => {
    const layout: WarehouseLayout = {
      id: "single-warehouse-layout",
      revision: 3,
      updatedAt: "2026-07-27T10:00:00.000Z",
      status: "PUBLISHED",
      canvas: { widthM: 40, heightM: 24, gridM: 0.5 },
      rackTemplate: {
        widthM: 6,
        depthM: 1.5,
        levelCount: 2,
        bayCount: 3,
      },
      zones: [],
      racks: [],
      shelves: [],
      aisles: [],
      gates: [],
    };

    return {
      baseLayout: layout,
      fetchWarehouseLayout: vi.fn().mockResolvedValue(layout),
      saveWarehouseLayout: vi.fn(),
    };
  },
);

vi.mock(
  "@/features/warehouse-layout/services/warehouse-layout.service",
  () => ({
    fetchWarehouseLayout,
    saveWarehouseLayout,
  }),
);

vi.mock("@/hooks/use-session-user", () => ({
  useSessionUser: () => ({ id: "u1", roles: ["MANAGER"] }),
}));

vi.mock("@/features/warehouse-layout/components/warehouse-floor-plan", () => ({
  WarehouseFloorPlan: ({
    onCreate,
    tool,
  }: {
    onCreate?: (
      kind: "zone" | "rack" | "aisle" | "gate",
      point: { xM: number; yM: number },
    ) => void;
    tool: string;
  }) => (
    <button
      aria-label="Sơ đồ kho"
      onClick={() => {
        if (tool === "zone") onCreate?.("zone", { xM: 2, yM: 2 });
      }}
    >
      canvas
    </button>
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
    expect(
      screen.queryByText("Kích thước rack chuẩn (áp dụng toàn kho)"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Áp dụng cho toàn bộ rack"),
    ).not.toBeInTheDocument();
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
      await screen.findByText(/đã được cập nhật ở phiên khác/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Tải bản mới" }),
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
