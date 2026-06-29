import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  bootstrapAdmin,
  createWmsUser,
  lockWmsUser,
  resetWmsUserPassword,
  unlockWmsUser,
  updateWmsUserRoles,
} from "@/features/auth/services/auth.service";
import { apiClient } from "@/lib/api-client";

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
  },
}));

const mockedPatch = vi.mocked(apiClient.patch);
const mockedPost = vi.mocked(apiClient.post);

const createUserResponse = {
  id: "user-1",
  username: "receiver01",
  email: "receiver01@example.com",
  roles: ["RECEIVER"],
  mustChangePassword: true,
};

const userResponse = {
  ...createUserResponse,
  name: "Receiver 01",
  status: "ACTIVE",
  warehouseId: "central",
  createdAt: "2026-06-27T00:00:00.000Z",
  updatedAt: "2026-06-27T00:00:00.000Z",
};

describe("wms auth admin services", () => {
  beforeEach(() => {
    mockedPatch.mockReset();
    mockedPost.mockReset();
  });

  it("bootstraps the first admin with the public endpoint", async () => {
    const input = {
      username: "admin",
      password: "P@ssw0rd123!",
      email: "admin@example.com",
      name: "System Admin",
      roles: ["ADMIN"],
    };
    mockedPost.mockResolvedValueOnce({
      data: {
        data: { ...createUserResponse, username: "admin", roles: ["ADMIN"] },
        meta: { requestId: "bootstrap-1" },
      },
    });

    await expect(bootstrapAdmin(input)).resolves.toMatchObject({
      username: "admin",
      roles: ["ADMIN"],
      mustChangePassword: true,
    });
    expect(mockedPost).toHaveBeenCalledWith("/auth/bootstrap-admin", input);
  });

  it("creates WMS users through the admin endpoint", async () => {
    const input = {
      username: "receiver01",
      password: "TempP@ssw0rd123!",
      email: "receiver01@example.com",
      name: "Receiver 01",
      roles: ["RECEIVER"],
    };
    mockedPost.mockResolvedValueOnce({
      data: { data: createUserResponse, meta: { requestId: "create-1" } },
    });

    await expect(createWmsUser(input)).resolves.toEqual(createUserResponse);
    expect(mockedPost).toHaveBeenCalledWith("/auth/users", input);
  });

  it("updates user roles with PATCH /auth/users/{id}/roles", async () => {
    mockedPatch.mockResolvedValueOnce({
      data: {
        data: { ...userResponse, roles: ["RECEIVER", "PICKER"] },
        meta: { requestId: "roles-1" },
      },
    });

    await expect(
      updateWmsUserRoles("user-1", { roles: ["RECEIVER", "PICKER"] }),
    ).resolves.toMatchObject({ roles: ["RECEIVER", "PICKER"] });
    expect(mockedPatch).toHaveBeenCalledWith("/auth/users/user-1/roles", {
      roles: ["RECEIVER", "PICKER"],
    });
  });

  it("locks and unlocks users without request bodies", async () => {
    mockedPost
      .mockResolvedValueOnce({
        data: {
          data: { ...userResponse, status: "LOCKED" },
          meta: { requestId: "lock-1" },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: { ...userResponse, status: "ACTIVE" },
          meta: { requestId: "unlock-1" },
        },
      });

    await expect(lockWmsUser("user-1")).resolves.toMatchObject({
      status: "LOCKED",
    });
    await expect(unlockWmsUser("user-1")).resolves.toMatchObject({
      status: "ACTIVE",
    });
    expect(mockedPost).toHaveBeenNthCalledWith(1, "/auth/users/user-1/lock");
    expect(mockedPost).toHaveBeenNthCalledWith(2, "/auth/users/user-1/unlock");
  });

  it("resets a temporary password and keeps mustChangePassword true", async () => {
    const input = { temporaryPassword: "TempP@ssw0rd123!" };
    mockedPost.mockResolvedValueOnce({
      data: {
        data: { success: true, mustChangePassword: true },
        meta: { requestId: "reset-1" },
      },
    });

    await expect(resetWmsUserPassword("user-1", input)).resolves.toEqual({
      success: true,
      mustChangePassword: true,
    });
    expect(mockedPost).toHaveBeenCalledWith(
      "/auth/users/user-1/reset-password",
      input,
    );
  });
});
