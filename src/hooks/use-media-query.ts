"use client";

import * as React from "react";

export function useMediaQuery(query: string) {
  const subscribe = React.useCallback(
    (callback: () => void) => {
      const mediaQuery = window.matchMedia(query);
      mediaQuery.addEventListener("change", callback);

      return () => mediaQuery.removeEventListener("change", callback);
    },
    [query],
  );

  const getSnapshot = React.useCallback(
    () =>
      typeof window === "undefined" ? false : window.matchMedia(query).matches,
    [query],
  );

  return React.useSyncExternalStore(subscribe, getSnapshot, () => false);
}
