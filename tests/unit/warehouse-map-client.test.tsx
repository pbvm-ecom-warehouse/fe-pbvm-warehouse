import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/features/warehouse-layout/services/warehouse-layout.service", () => ({
  fetchWarehouseLayout: vi.fn().mockResolvedValue({
    id: "single-warehouse-layout",
    revision: 1,
    status: "PUBLISHED",
    canvas: { widthM: 20, heightM: 20, gridM: 0.5 },
    zones: [
      { id: "z1", code: "A", name: "Zone A", xM: 1, yM: 1, widthM: 10, heightM: 10, rotation: 0 },
    ],
    racks: [],
    aisles: [],
    gates: [],
  }),
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
});
