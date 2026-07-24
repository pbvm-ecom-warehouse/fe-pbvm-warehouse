import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api-client";
import {
  createZone,
  deleteRack,
  listZones,
  updateShelf,
} from "@/features/warehouse-structure/services/warehouse-structure.service";

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    delete: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
  },
}));

const mockedDelete = vi.mocked(apiClient.delete);
const mockedGet = vi.mocked(apiClient.get);
const mockedPatch = vi.mocked(apiClient.patch);
const mockedPost = vi.mocked(apiClient.post);

describe("warehouse structure API service", () => {
  beforeEach(() => {
    mockedDelete.mockReset();
    mockedGet.mockReset();
    mockedPatch.mockReset();
    mockedPost.mockReset();
  });

  it("lists zones from the single-warehouse location endpoint", async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        data: [
          {
            code: "A",
            createdAt: "2026-07-02T00:00:00.000Z",
            id: "zone-1",
            name: "Khu A",
            updatedAt: "2026-07-02T00:00:00.000Z",
          },
        ],
        meta: { requestId: "req-1" },
      },
    });

    await expect(listZones()).resolves.toMatchObject([
      { id: "zone-1", name: "Khu A" },
    ]);
    expect(mockedGet).toHaveBeenCalledWith("/location/zones");
  });

  it("creates zones without the removed warehouseId field", async () => {
    mockedPost.mockResolvedValueOnce({
      data: { id: "zone-1", code: "A", name: "Khu A" },
    });

    await createZone({ code: "A", name: "Khu A" });

    expect(mockedPost).toHaveBeenCalledWith("/location/zones", {
      code: "A",
      name: "Khu A",
    });
  });

  it("updates shelf dimensions through the backend shelf route", async () => {
    mockedPatch.mockResolvedValueOnce({
      data: { id: "shelf-1", code: "A1-T1", level: 1, rackId: "rack-1" },
    });

    await updateShelf("shelf-1", {
      code: "A1-T1",
      fillFactor: 0.8,
      innerDepth: 120,
      innerHeight: 50,
      innerWidth: 80,
      isStaging: false,
      level: 1,
    });

    expect(mockedPatch).toHaveBeenCalledWith("/location/shelves/shelf-1", {
      code: "A1-T1",
      fillFactor: 0.8,
      innerDepth: 120,
      innerHeight: 50,
      innerWidth: 80,
      isStaging: false,
      level: 1,
    });
  });

  it("deletes racks through the soft-delete endpoint", async () => {
    mockedDelete.mockResolvedValueOnce({ data: null });

    await deleteRack("rack-1");

    expect(mockedDelete).toHaveBeenCalledWith("/location/racks/rack-1");
  });
});
