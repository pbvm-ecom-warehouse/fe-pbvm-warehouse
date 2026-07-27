import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { WarehouseLayout } from "@/types/api";

const { baseLayout, layoutWithRack } = vi.hoisted(() => {
  const base: WarehouseLayout = {
    id: "single-warehouse-layout",
    revision: 1,
    status: "PUBLISHED",
    canvas: { widthM: 20, heightM: 20, gridM: 0.5 },
    zones: [
      {
        id: "z1",
        code: "A",
        name: "Zone A",
        xM: 1,
        yM: 1,
        widthM: 10,
        heightM: 10,
        rotation: 0,
      },
    ],
    racks: [],
    aisles: [],
    gates: [],
  };

  const withRack: WarehouseLayout = {
    ...base,
    racks: [
      {
        id: "r1",
        zoneId: "z1",
        code: "R1",
        name: "Rack R1",
        xM: 2,
        yM: 2,
        widthM: 3,
        depthM: 1,
        rotation: 0,
        levelCount: 1,
        bayCount: 1,
        // Task 8: BE thật không trả shelfCodes cho rack nữa, luôn rỗng.
        shelfCodes: [],
        accessPoint: { xM: 2, yM: 2 },
      },
    ],
  };

  return { baseLayout: base, layoutWithRack: withRack };
});

vi.mock("@/features/warehouse-layout/services/warehouse-layout.service", () => ({
  fetchWarehouseLayout: vi.fn().mockResolvedValue(baseLayout),
  fetchRackTemplate: vi.fn().mockResolvedValue({
    widthM: 10,
    depthM: 1.5,
    levelCount: 3,
    bayCount: 3,
  }),
  patchZone: vi.fn(),
  patchRack: vi.fn(),
  patchAisle: vi.fn(),
  patchGate: vi.fn(),
  updateRackTemplate: vi.fn(),
}));

vi.mock("@/features/warehouse-layout/services/warehouse-shelves.service", () => ({
  fetchShelvesForRacks: vi.fn().mockResolvedValue(new Map()),
  fetchShelfContents: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/hooks/use-session-user", () => ({
  useSessionUser: () => ({ id: "u1", roles: ["MANAGER"] }),
}));

import { WarehouseMapClient } from "@/features/warehouse-layout/components/warehouse-map-client";
import { fetchWarehouseLayout } from "@/features/warehouse-layout/services/warehouse-layout.service";
import { fetchShelvesForRacks } from "@/features/warehouse-layout/services/warehouse-shelves.service";

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe("WarehouseMapClient", () => {
  it("hiển thị sơ đồ kho sau khi tải layout thành công", async () => {
    renderWithClient(<WarehouseMapClient />);

    await waitFor(() => {
      expect(screen.getByLabelText("Sơ đồ kho")).toBeInTheDocument();
    });
  });

  it("bấm vào rack chọn đúng shelf thật đầu tiên thay vì mã rack (rack.shelfCodes luôn rỗng)", async () => {
    vi.mocked(fetchWarehouseLayout).mockResolvedValueOnce(layoutWithRack);
    vi.mocked(fetchShelvesForRacks).mockResolvedValueOnce(
      new Map([
        [
          "r1",
          [
            {
              id: "shelf-1",
              rackId: "r1",
              level: 1,
              code: "R1-01",
              isStaging: false,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        ],
      ]),
    );

    renderWithClient(<WarehouseMapClient />);

    const rackHandle = await screen.findByLabelText("Mở Rack R1");

    // Đợi shelvesQuery (fetchShelvesForRacks) resolve trước khi bấm, để
    // đảm bảo state "shelves" đã có dữ liệu thật lúc handleOpenRack chạy —
    // giống hành vi thật khi user bấm sau khi trang đã tải xong.
    await waitFor(() => {
      expect(vi.mocked(fetchShelvesForRacks)).toHaveBeenCalled();
    });
    await vi.mocked(fetchShelvesForRacks).mock.results[0]?.value;

    fireEvent.click(rackHandle);

    // Rack elevation phải mở với shelf thật "R1-01" (đã chọn), KHÔNG phải mã
    // rack "R1" (fallback sai khi rack.shelfCodes[0] là undefined).
    const shelfButton = await screen.findByRole("button", {
      name: /R1-01/,
    });
    expect(shelfButton).toHaveAttribute("aria-pressed", "true");
  });
});
