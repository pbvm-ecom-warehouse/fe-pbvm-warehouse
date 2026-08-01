import { QueryClient, useQueryClient } from "@tanstack/react-query";
import { act, render, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it } from "vitest";

import type { SessionUser } from "@/lib/auth";
import { QueryProvider } from "@/providers/query-provider";
import { useAuthStore } from "@/stores/auth-store";

function user(id: string, roles: SessionUser["roles"]): SessionUser {
  return {
    id,
    name: `User ${id}`,
    roles,
    tenantId: "tenant-1",
    type: "user",
  };
}

function QueryClientProbe({
  onReady,
}: {
  onReady: (queryClient: QueryClient) => void;
}) {
  const queryClient = useQueryClient();

  useEffect(() => {
    onReady(queryClient);
  }, [onReady, queryClient]);

  return null;
}

describe("QueryProvider session isolation", () => {
  beforeEach(() => {
    useAuthStore.setState({
      hasHydrated: true,
      user: user("admin-a", ["ADMIN"]),
    });
  });

  it("clears protected cached data when the session identity changes", async () => {
    let queryClient: QueryClient | undefined;

    render(
      <QueryProvider>
        <QueryClientProbe
          onReady={(client) => {
            queryClient = client;
          }}
        />
      </QueryProvider>,
    );

    await waitFor(() => expect(queryClient).toBeDefined());
    act(() => {
      queryClient?.setQueryData(
        ["goods-issues", "list", "admin-a"],
        "private-admin-a",
      );
    });
    expect(queryClient?.getQueryData(["goods-issues", "list", "admin-a"])).toBe(
      "private-admin-a",
    );

    act(() => {
      useAuthStore.getState().setUser(user("shipper-b", ["SHIPPER"]));
    });

    await waitFor(() =>
      expect(
        queryClient?.getQueryData(["goods-issues", "list", "admin-a"]),
      ).toBeUndefined(),
    );
  });
});
