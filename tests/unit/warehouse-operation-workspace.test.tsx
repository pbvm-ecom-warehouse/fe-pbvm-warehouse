import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WarehouseOperationWorkspace } from "@/features/warehouse-navigation/components/warehouse-operation-workspace";
import { fetchWarehouseLayout } from "@/features/warehouse-layout/services/warehouse-layout.service";
import {
  getNavigationPath,
  listRackCells,
} from "@/features/warehouse-navigation/services/warehouse-operations.service";

vi.mock(
  "@/features/warehouse-layout/services/warehouse-layout.service",
  () => ({
    fetchWarehouseLayout: vi.fn(),
  }),
);
vi.mock(
  "@/features/warehouse-navigation/services/warehouse-operations.service",
  () => ({
    getNavigationPath: vi.fn(),
    listRackCells: vi.fn(),
  }),
);
vi.mock("@/features/warehouse-navigation/components/rack-cell-viewer", () => ({
  RackCellViewer: ({
    cells,
    rackCode,
  }: {
    cells?: Array<{ contents: Array<{ images?: string[] | null }> }>;
    rackCode?: string;
  }) => (
    <div>
      <div>Mặt kệ kiểm thử {rackCode}</div>
      <div>Ảnh content {cells?.[0]?.contents[0]?.images?.[0] ?? "none"}</div>
    </div>
  ),
}));

const layout = {
  id: "layout-1",
  revision: 1,
  status: "PUBLISHED" as const,
  updatedAt: "2026-07-28T00:00:00.000Z",
  canvas: { widthM: 20, heightM: 12, gridM: 0.5 },
  rackTemplate: {
    widthM: 5,
    depthM: 1.5,
    heightM: 3,
    levelCount: 3,
    bayCount: 3,
  },
  zones: [],
  racks: [
    {
      id: "rack-1",
      zoneId: "zone-1",
      code: "RACK-01",
      name: "Rack 01",
      xM: 4,
      yM: 4,
      widthM: 5,
      depthM: 1.5,
      rotation: 0 as const,
      levelCount: 3,
      bayCount: 3,
      shelfCodes: ["RACK-01-T1", "RACK-01-T2", "RACK-01-T3"],
      accessPoint: { xM: 4, yM: 5.5 },
    },
  ],
  shelves: [],
  aisles: [],
  gates: [],
};

describe("WarehouseOperationWorkspace", () => {
  beforeEach(() => {
    vi.mocked(fetchWarehouseLayout).mockResolvedValue(layout);
    vi.mocked(listRackCells).mockResolvedValue([]);
    vi.mocked(getNavigationPath).mockResolvedValue({
      distanceM: 8,
      points: [
        { xM: 1, yM: 1 },
        { xM: 4, yM: 5.5 },
      ],
      startGateCode: "GATE-01",
      targetRackId: "rack-1",
    });
  });

  it("giữ bản đồ sau lần bấm rack đầu tiên và chỉ mở mặt kệ khi xác nhận lần hai", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <WarehouseOperationWorkspace
          operation="PUTAWAY"
          sku="SKU-01"
          remainingPackageCount={10}
          suggestions={[]}
          onConfirm={vi.fn()}
        />
      </QueryClientProvider>,
    );

    expect(
      screen.queryByLabelText("Sơ đồ đường đi trong kho"),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Mở bản đồ kho" }),
      ).toBeEnabled(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Mở bản đồ kho" }));
    const routeMap = await screen.findByLabelText("Sơ đồ đường đi trong kho");
    expect(routeMap).toBeVisible();
    expect(
      screen.getByRole("dialog", { name: "Bản đồ đường đi trong kho" }),
    ).toHaveClass("flex", "h-[92dvh]", "flex-col");
    expect(routeMap).toHaveClass("min-h-0", "flex-1");

    fireEvent.click(screen.getByRole("button", { name: "RACK-01" }));
    expect(screen.getByLabelText("Sơ đồ đường đi trong kho")).toBeVisible();
    expect(
      screen.queryByRole("dialog", { name: "Mặt kệ RACK-01" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Xem mặt kệ RACK-01" }));
    expect(
      await screen.findByRole("dialog", { name: "Mặt kệ RACK-01" }),
    ).toBeVisible();
    expect(await screen.findByText("Mặt kệ kiểm thử RACK-01")).toBeVisible();
    expect(
      screen.queryByLabelText("Sơ đồ đường đi trong kho"),
    ).not.toBeInTheDocument();
  });

  it("mở mặt kệ trực tiếp từ nút xem trên lựa chọn vị trí", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <WarehouseOperationWorkspace
          operation="PUTAWAY"
          sku="SKU-01"
          remainingPackageCount={10}
          suggestions={[
            {
              cellId: "cell-1",
              cellCode: "RACK-01-T1-B1",
              rackId: "rack-1",
              level: 1,
              bay: 1,
              path: {
                distanceM: 8,
                points: [
                  { xM: 1, yM: 1 },
                  { xM: 4, yM: 5.5 },
                ],
                startGateCode: "GATE-01",
                targetRackId: "rack-1",
              },
              capacity: 12,
            },
          ]}
          onConfirm={vi.fn()}
        />
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Xem mặt kệ RACK-01" }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Xem mặt kệ RACK-01" }));

    expect(
      await screen.findByRole("dialog", { name: "Mặt kệ RACK-01" }),
    ).toBeVisible();
    expect(await screen.findByText("Mặt kệ kiểm thử RACK-01")).toBeVisible();
  });

  it("mở bản đồ từ nút xem trên thẻ vị trí đã cất", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <WarehouseOperationWorkspace
          operation="PUTAWAY"
          sku="SKU-01"
          remainingPackageCount={0}
          readOnly
          suggestions={[
            {
              cellId: "cell-1",
              cellCode: "RACK-01-T1-B1",
              rackId: "rack-1",
              level: 1,
              bay: 1,
              path: {
                distanceM: 8,
                points: [
                  { xM: 1, yM: 1 },
                  { xM: 4, yM: 5.5 },
                ],
                startGateCode: "GATE-01",
                targetRackId: "rack-1",
              },
              quantity: 10,
              lotNumber: "LOT-260729-001",
              expiryDate: "2027-07-29T00:00:00.000Z",
            },
          ]}
          onConfirm={vi.fn()}
        />
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Xem bản đồ RACK-01" }),
      ).toBeEnabled(),
    );
    expect(screen.getByText("HSD 29/07/2027")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Xem bản đồ RACK-01" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Bản đồ vị trí đã cất",
    });
    expect(dialog).toBeVisible();
    expect(
      within(dialog).getByLabelText("Sơ đồ đường đi trong kho"),
    ).toBeVisible();
  });

});
