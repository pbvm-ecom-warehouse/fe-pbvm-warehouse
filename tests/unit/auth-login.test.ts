import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api-client";
import { loginSchema } from "@/features/auth/schemas/login.schema";
import {
  changePasswordSchema,
} from "@/features/auth/schemas/change-password.schema";
import { changePassword, login, logout } from "@/features/auth/services/auth.service";
import {
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  setAuthTokens,
} from "@/lib/auth-token";
import { useAuthStore } from "@/stores/auth-store";

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockedGet = vi.mocked(apiClient.get);
const mockedPost = vi.mocked(apiClient.post);

describe("wms login schema", () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearAuthTokens();
    useAuthStore.getState().clearUser();
    mockedGet.mockReset();
    mockedPost.mockReset();
  });

  it("accepts username and password per WMS auth contract", () => {
    expect(
      loginSchema.safeParse({
        username: "receiver.one",
        password: "P@ssw0rd!",
      }).success,
    ).toBe(true);
  });

  it("rejects the old email plus tenant payload shape", () => {
    expect(
      loginSchema.safeParse({
        email: "ops@wms.local",
        password: "P@ssw0rd!",
        tenantId: "demo-tenant",
      }).success,
    ).toBe(false);
  });

  it("maps the authenticated user from /auth/me after login", async () => {
    mockedPost.mockResolvedValueOnce({
      data: {
        data: {
          accessToken: "opaque-access-token",
          refreshToken: "opaque-refresh-token",
          mustChangePassword: false,
        },
        meta: { requestId: "login-1" },
      },
    });
    mockedGet.mockResolvedValueOnce({
      data: {
        data: {
          id: "user-1",
          username: "receiver01",
          email: "receiver01@example.com",
          name: "Receiver 01",
          roles: ["RECEIVER"],
          status: "ACTIVE",
          mustChangePassword: false,
          warehouseId: "central",
          createdAt: "2026-06-27T00:00:00.000Z",
          updatedAt: "2026-06-27T00:00:00.000Z",
        },
        meta: { requestId: "me-1" },
      },
    });

    await login({ username: "receiver01", password: "P@ssw0rd123!" });

    expect(mockedPost).toHaveBeenCalledWith("/auth/login", {
      username: "receiver01",
      password: "P@ssw0rd123!",
    });
    expect(mockedGet).toHaveBeenCalledWith("/auth/me");
    expect(getAccessToken()).toBe("opaque-access-token");
    expect(useAuthStore.getState().user).toMatchObject({
      email: "receiver01@example.com",
      id: "user-1",
      name: "Receiver 01",
      roles: ["RECEIVER"],
      tenantId: "demo-tenant",
      type: "user",
      warehouseId: "central",
    });
  });

  it("validates and posts change-password payloads", async () => {
    const input = {
      oldPassword: "TempP@ssw0rd123!",
      newPassword: "NewP@ssw0rd123!",
    };

    expect(changePasswordSchema.safeParse(input).success).toBe(true);
    expect(
      changePasswordSchema.safeParse({
        oldPassword: "",
        newPassword: "short",
      }).success,
    ).toBe(false);

    mockedPost.mockResolvedValueOnce({
      data: {
        data: { success: true, mustChangePassword: false },
        meta: { requestId: "change-1" },
      },
    });

    await expect(changePassword(input)).resolves.toEqual({
      success: true,
      mustChangePassword: false,
    });
    expect(mockedPost).toHaveBeenCalledWith("/auth/change-password", input);
  });

  it("clears local tokens and user state even when logout API fails", async () => {
    setAuthTokens({
      accessToken: "access-before-logout",
      refreshToken: "refresh-before-logout",
    });
    useAuthStore.getState().setUser({
      id: "user-1",
      name: "Admin",
      roles: ["ADMIN"],
      tenantId: "demo-tenant",
      type: "user",
    });
    mockedPost.mockRejectedValueOnce(new Error("network"));

    await expect(logout()).rejects.toThrow("network");

    expect(mockedPost).toHaveBeenCalledWith("/auth/logout", {
      refreshToken: "refresh-before-logout",
    });
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });
});
