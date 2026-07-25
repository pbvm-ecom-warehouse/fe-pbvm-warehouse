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
