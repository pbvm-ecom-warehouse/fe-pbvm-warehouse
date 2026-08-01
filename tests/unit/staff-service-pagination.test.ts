import { beforeEach, describe, expect, it, vi } from "vitest";

import { listAllWmsUsers } from "@/features/staff/services/staff.service";
import { apiClient } from "@/lib/api-client";
import type { WmsUserResponse } from "@/types/api";

vi.mock("@/lib/api-client", () => ({
  apiClient: { get: vi.fn() },
}));

const mockedGet = vi.mocked(apiClient.get);

function shipper(index: number): WmsUserResponse {
  return {
    id: `shipper-${index}`,
    mustChangePassword: false,
    name: `Shipper ${index}`,
    role: "SHIPPER",
    status: "ACTIVE",
    username: `shipper.${index}`,
  };
}

describe("staff service pagination", () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it("loads every active shipper instead of stopping at the default 20", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => shipper(index));
    const secondPage = [shipper(100)];
    mockedGet
      .mockResolvedValueOnce({
        data: {
          data: firstPage,
          meta: { pagination: { page: 1, pageSize: 100, total: 101 } },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: secondPage,
          meta: { pagination: { page: 2, pageSize: 100, total: 101 } },
        },
      });

    await expect(
      listAllWmsUsers({ role: "SHIPPER", status: "ACTIVE" }),
    ).resolves.toMatchObject({
      data: [...firstPage, ...secondPage],
      limit: 100,
      page: 1,
      total: 101,
    });

    expect(mockedGet).toHaveBeenNthCalledWith(1, "/users", {
      params: {
        limit: 100,
        page: 1,
        role: "SHIPPER",
        status: "ACTIVE",
      },
    });
    expect(mockedGet).toHaveBeenNthCalledWith(2, "/users", {
      params: {
        limit: 100,
        page: 2,
        role: "SHIPPER",
        status: "ACTIVE",
      },
    });
  });
});
