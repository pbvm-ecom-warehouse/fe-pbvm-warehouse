"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { getSessionQueryScope } from "@/lib/session-query-scope";
import { useAuthStore } from "@/stores/auth-store";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );
  const sessionScopeRef = React.useRef(
    getSessionQueryScope(useAuthStore.getState().user),
  );

  React.useEffect(
    () =>
      useAuthStore.subscribe((state) => {
        const nextScope = getSessionQueryScope(state.user);

        if (nextScope === sessionScopeRef.current) {
          return;
        }

        sessionScopeRef.current = nextScope;
        queryClient.clear();
      }),
    [queryClient],
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
