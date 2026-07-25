import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LocationStructureClient } from "@/features/warehouse-structure/components/location-structure-client";

vi.mock(
  "@/features/warehouse-structure/services/warehouse-structure.service",
  () => ({
    createRack: vi.fn(),
    createShelf: vi.fn(),
    createZone: vi.fn(),
    deleteRack: vi.fn(),
    deleteShelf: vi.fn(),
    deleteZone: vi.fn(),
    listRacks: vi.fn(),
    listShelves: vi.fn(),
    listZones: vi.fn(),
    updateRack: vi.fn(),
    updateShelf: vi.fn(),
    updateZone: vi.fn(),
  }),
);

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const service = await import(
  "@/features/warehouse-structure/services/warehouse-structure.service"
);
const mockedListZones = vi.mocked(service.listZones);
const mockedListRacks = vi.mocked(service.listRacks);
const mockedListShelves = vi.mocked(service.listShelves);

function renderLocations() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <LocationStructureClient />
    </QueryClientProvider>,
  );
}

describe("LocationStructureClient view derivation", () => {
  beforeEach(() => {
    mockedListZones.mockReset();
    mockedListRacks.mockReset();
    mockedListShelves.mockReset();
  });

  it("does not fetch racks until a zone is explicitly clicked", async () => {
    mockedListZones.mockResolvedValue([
      { id: "zone-1", code: "A", name: "Khu A", createdAt: "", updatedAt: "" },
    ]);
    mockedListRacks.mockResolvedValue([]);

    renderLocations();

    await screen.findByText("Khu A");
    expect(mockedListRacks).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Khu A"));

    await waitFor(() => expect(mockedListRacks).toHaveBeenCalledWith("zone-1"));
  });
});

describe("LocationStructureClient breadcrumb", () => {
  beforeEach(() => {
    mockedListZones.mockReset();
    mockedListRacks.mockReset();
    mockedListShelves.mockReset();
  });

  it("shows breadcrumb and navigates back to zone list on root click", async () => {
    mockedListZones.mockResolvedValue([
      { id: "zone-1", code: "A", name: "Khu A", createdAt: "", updatedAt: "" },
    ]);
    mockedListRacks.mockResolvedValue([
      {
        id: "rack-1",
        zoneId: "zone-1",
        code: "R1",
        name: "Kệ 1",
        createdAt: "",
        updatedAt: "",
      },
    ]);

    renderLocations();

    // Initially, only zones are shown, so there's one "Khu A" in the table
    const zoneTableRow = await screen.findByText("Khu A");
    fireEvent.click(zoneTableRow);

    // After clicking, racks should be visible
    expect(await screen.findByText("Kệ 1")).toBeInTheDocument();

    // Breadcrumb should now be visible with "Kho tổng" button
    expect(
      screen.getByRole("button", { name: "Kho tổng" }),
    ).toBeInTheDocument();

    // Click the "Kho tổng" button to navigate back to zone list
    fireEvent.click(screen.getByRole("button", { name: "Kho tổng" }));

    // Zone table should still be visible
    expect(await screen.findByText("Khu A")).toBeInTheDocument();
    // Racks should no longer be fetched (still only once from initial zone click)
    expect(mockedListRacks).toHaveBeenCalledTimes(1);
  });
});

describe("LocationStructureClient stat badges", () => {
  beforeEach(() => {
    mockedListZones.mockReset();
    mockedListRacks.mockReset();
    mockedListShelves.mockReset();
  });

  it("shows zone count at root and shelf/staging counts at shelf view", async () => {
    mockedListZones.mockResolvedValue([
      { id: "zone-1", code: "A", name: "Khu A", createdAt: "", updatedAt: "" },
    ]);
    mockedListRacks.mockResolvedValue([
      {
        id: "rack-1",
        zoneId: "zone-1",
        code: "R1",
        name: "Kệ 1",
        createdAt: "",
        updatedAt: "",
      },
    ]);
    mockedListShelves.mockResolvedValue([
      {
        id: "shelf-1",
        rackId: "rack-1",
        code: "S1",
        level: 1,
        isStaging: true,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "shelf-2",
        rackId: "rack-1",
        code: "S2",
        level: 2,
        isStaging: false,
        createdAt: "",
        updatedAt: "",
      },
    ]);

    renderLocations();

    expect(await screen.findByText("1 khu vực")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Khu A"));
    expect(await screen.findByText("1 kệ")).toBeInTheDocument();

    fireEvent.click(await screen.findByText("Kệ 1"));
    expect(await screen.findByText("2 tầng kệ")).toBeInTheDocument();
    expect(screen.getByText("1 khu tạm")).toBeInTheDocument();
  });
});

describe("LocationStructureClient single-panel drill-down", () => {
  beforeEach(() => {
    mockedListZones.mockReset();
    mockedListRacks.mockReset();
    mockedListShelves.mockReset();
  });

  it("shows only one table at a time as the user drills down", async () => {
    mockedListZones.mockResolvedValue([
      { id: "zone-1", code: "A", name: "Khu A", createdAt: "", updatedAt: "" },
    ]);
    mockedListRacks.mockResolvedValue([
      {
        id: "rack-1",
        zoneId: "zone-1",
        code: "R1",
        name: "Kệ 1",
        createdAt: "",
        updatedAt: "",
      },
    ]);
    mockedListShelves.mockResolvedValue([
      {
        id: "shelf-1",
        rackId: "rack-1",
        code: "S1",
        level: 1,
        isStaging: true,
        createdAt: "",
        updatedAt: "",
      },
    ]);

    renderLocations();

    expect(await screen.findByText("Khu A")).toBeInTheDocument();
    expect(screen.queryByText("Kệ 1")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thêm khu vực" })).toBeInTheDocument();

    fireEvent.click(screen.getByText("Khu A"));

    expect(await screen.findByText("Kệ 1")).toBeInTheDocument();
    // "Khu A" now only appears once, in the breadcrumb — the zone table
    // (and its row) is gone, replaced by the rack table.
    expect(screen.getAllByText("Khu A")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Thêm kệ" })).toBeInTheDocument();

    fireEvent.click(screen.getByText("Kệ 1"));

    expect(await screen.findByText("S1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thêm tầng kệ" })).toBeInTheDocument();
  });
});
