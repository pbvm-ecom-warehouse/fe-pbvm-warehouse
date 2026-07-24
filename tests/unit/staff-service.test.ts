import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createWmsUser,
  deleteWmsUser,
  getWmsUser,
  listWmsUsers,
  lockWmsUser,
  resetWmsUserPassword,
  unlockWmsUser,
  updateWmsUser,
  updateWmsUserRole,
} from "@/features/staff/services/staff.service";
import { apiClient } from "@/lib/api-client";

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

const userResponse = {
  id: "user-1",
  username: "receiver01",
  email: "receiver01@example.com",
  name: "Receiver 01",
  role: "RECEIVER",
  status: "ACTIVE" as const,
  mustChangePassword: true,
  createdAt: "2026-06-27T00:00:00.000Z",
  updatedAt: "2026-06-27T00:00:00.000Z",
};

describe("staff service", () => {
  beforeEach(() => {
    mockedDelete.mockReset();
    mockedGet.mockReset();
    mockedPatch.mockReset();
    mockedPost.mockReset();
  });

  it("lists users through /users with server filters and pagination", async () => {
    const query = {
      limit: 20,
      page: 2,
      role: "RECEIVER",
      search: "receiver",
      status: "ACTIVE" as const,
    };
    mockedGet.mockResolvedValueOnce({
      data: {
        data: [userResponse],
        meta: {
          pagination: { page: 2, pageSize: 20, total: 21, totalPages: 2 },
          requestId: "list-1",
        },
      },
    });

    await expect(listWmsUsers(query)).resolves.toEqual({
      data: [userResponse],
      limit: 20,
      page: 2,
      total: 21,
    });
    expect(mockedGet).toHaveBeenCalledWith("/users", { params: query });
  });

  it("gets, creates and updates a user through UsersModule", async () => {
    const createInput = {
      username: "receiver01",
      password: "TempP@ssw0rd123!",
      role: "RECEIVER",
    };
    const updateInput = {
      name: "Receiver Updated",
      email: "updated@example.com",
      phone: "0901000000",
    };
    mockedGet.mockResolvedValueOnce({
      data: { data: userResponse, meta: { requestId: "get-1" } },
    });
    mockedPost.mockResolvedValueOnce({
      data: {
        data: {
          id: userResponse.id,
          username: userResponse.username,
          email: userResponse.email,
          role: userResponse.role,
          mustChangePassword: true,
        },
        meta: { requestId: "create-1" },
      },
    });
    mockedPatch.mockResolvedValueOnce({
      data: {
        data: { ...userResponse, ...updateInput },
        meta: { requestId: "update-1" },
      },
    });

    await expect(getWmsUser("user/1")).resolves.toEqual(userResponse);
    await expect(createWmsUser(createInput)).resolves.toMatchObject({
      id: "user-1",
    });
    await expect(updateWmsUser("user/1", updateInput)).resolves.toMatchObject(
      updateInput,
    );
    expect(mockedGet).toHaveBeenCalledWith("/users/user%2F1");
    expect(mockedPost).toHaveBeenCalledWith("/users", createInput);
    expect(mockedPatch).toHaveBeenCalledWith("/users/user%2F1", updateInput);
  });

  it("updates the single role, lock state and password through /users/{id}", async () => {
    mockedPatch.mockResolvedValueOnce({
      data: { data: { ...userResponse, role: "PICKER" } },
    });
    mockedPost
      .mockResolvedValueOnce({
        data: { data: { ...userResponse, status: "LOCKED" } },
      })
      .mockResolvedValueOnce({ data: { data: userResponse } })
      .mockResolvedValueOnce({
        data: { data: { success: true, mustChangePassword: true } },
      });

    await updateWmsUserRole("user-1", { role: "PICKER" });
    await lockWmsUser("user-1");
    await unlockWmsUser("user-1");
    await resetWmsUserPassword("user-1", {
      temporaryPassword: "TempP@ssw0rd123!",
    });

    expect(mockedPatch).toHaveBeenCalledWith("/users/user-1/role", {
      role: "PICKER",
    });
    expect(mockedPost).toHaveBeenNthCalledWith(1, "/users/user-1/lock");
    expect(mockedPost).toHaveBeenNthCalledWith(2, "/users/user-1/unlock");
    expect(mockedPost).toHaveBeenNthCalledWith(
      3,
      "/users/user-1/reset-password",
      { temporaryPassword: "TempP@ssw0rd123!" },
    );
  });

  it("soft deletes a user through DELETE /users/{id}", async () => {
    mockedDelete.mockResolvedValueOnce({ data: undefined, status: 204 });

    await expect(deleteWmsUser("user-1")).resolves.toBeUndefined();
    expect(mockedDelete).toHaveBeenCalledWith("/users/user-1");
  });
});
