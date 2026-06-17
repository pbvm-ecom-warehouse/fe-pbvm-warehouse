"use client";

import dynamic from "next/dynamic";

import type { StockValueChartClientProps } from "@/features/admin-shell/components/stock-value-chart-client";

export const StockValueChart = dynamic<StockValueChartClientProps>(
  () =>
    import("@/features/admin-shell/components/stock-value-chart-client").then(
      (module) => module.StockValueChartClient,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-72 w-full animate-pulse rounded-lg border border-dashed bg-muted/40" />
    ),
  },
);
