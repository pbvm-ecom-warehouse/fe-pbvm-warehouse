import { beforeEach, describe, expect, it, vi } from "vitest";

import { bootstrapAdmin } from "@/features/auth/services/auth.service";
import { apiClient } from "@/lib/api-client";

vi.mock("@/lib/api-client", () => ({
  apiClient: { post: vi.fn() },
}));

const mockedPost = vi.mocked(apiClient.post);

describe("WMS auth bootstrap service", () => {
  beforeEach(() => mockedPost.mockReset());

  it("keeps first-admin bootstrap in the auth module", async () => {
    const input = {
      username: "admin",
      password: "P@ssw0rd123!",
      email: "admin@example.com",
      name: "System Admin",
      roles: ["ADMIN"],
    };
    mockedPost.mockResolvedValueOnce({
      data: {
        data: {
          id: "admin-1",
          username: "admin",
          email: "admin@example.com",
          roles: ["ADMIN"],
          mustChangePassword: true,
        },
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
});
