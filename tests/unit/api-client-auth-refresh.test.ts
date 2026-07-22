import { beforeEach, describe, expect, it, vi } from "vitest";

const axiosMocks = vi.hoisted(() => ({
  apiClient: {
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
  refreshClient: {
    post: vi.fn(),
  },
}));

vi.mock("axios", () => ({
  default: {
    create: vi
      .fn()
      .mockReturnValueOnce(axiosMocks.apiClient)
      .mockReturnValueOnce(axiosMocks.refreshClient),
  },
}));

import "@/lib/api-client";
import {
  getAccessToken,
  getRefreshToken,
  setAuthTokens,
  setTenantId,
} from "@/lib/auth-token";
import { useAuthStore } from "@/stores/auth-store";

const responseErrorHandler = axiosMocks.apiClient.interceptors.response.use.mock.calls[0]?.[1] as (
  error: unknown,
) => Promise<unknown>;

describe("api client refresh failure", () => {
  beforeEach(() => {
    window.localStorage.clear();
    axiosMocks.refreshClient.post.mockReset();
    setAuthTokens({
      accessToken: "expired-access-token",
      refreshToken: "expired-refresh-token",
    });
    setTenantId("stale-tenant");
    useAuthStore.getState().setUser({
      id: "stale-user",
      name: "Stale User",
      roles: ["ADMIN"],
      tenantId: "stale-tenant",
      type: "user",
    });
  });

  it("clears the complete local session when refresh token is rejected", async () => {
    const refreshError = new Error("refresh token rejected");
    axiosMocks.refreshClient.post.mockRejectedValueOnce(refreshError);

    await expect(
      responseErrorHandler({
        config: { headers: {}, url: "/stock/items" },
        response: { status: 401 },
      }),
    ).rejects.toBe(refreshError);

    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(window.localStorage.getItem("tenant_id")).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });
});
