import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getWmsHealth,
  getWmsRoot,
} from "@/features/settings/services/settings.service";
import { apiClient } from "@/lib/api-client";

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

const mockedGet = vi.mocked(apiClient.get);

describe("wms settings service", () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it("loads WMS health from GET /health and unwraps envelopes", async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        data: { status: "ok", db: "up", redis: "up" },
        meta: { requestId: "health-1" },
      },
    });

    await expect(getWmsHealth()).resolves.toEqual({
      status: "ok",
      db: "up",
      redis: "up",
    });
    expect(mockedGet).toHaveBeenCalledWith("/health");
  });

  it("loads the API root from GET / and accepts the raw string response", async () => {
    mockedGet.mockResolvedValueOnce({ data: "Hello World!" });

    await expect(getWmsRoot()).resolves.toBe("Hello World!");
    expect(mockedGet).toHaveBeenCalledWith("/");
  });
});
