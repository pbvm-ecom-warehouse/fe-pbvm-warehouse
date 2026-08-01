import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import {
  invalidateGoodsReturnConfirmQueries,
  invalidateScrapMutationQueries,
} from "@/features/warehouse-navigation/utils/invalidate-warehouse-queries";

function seededClient(queryKeys: readonly (readonly unknown[])[]) {
  const queryClient = new QueryClient();
  queryKeys.forEach((queryKey) => queryClient.setQueryData(queryKey, "cached"));
  return queryClient;
}

function expectInvalidated(
  queryClient: QueryClient,
  queryKeys: readonly (readonly unknown[])[],
) {
  queryKeys.forEach((queryKey) => {
    expect(queryClient.getQueryState(queryKey)?.isInvalidated).toBe(true);
  });
}

describe("warehouse mutation cache invalidation", () => {
  it("invalidates scrap, count, stock, map and picking data after scrap changes", async () => {
    const affectedKeys = [
      ["scrap-notes", "detail", "scrap-1"],
      ["stock-counts", "detail", "count-1"],
      ["goods-issues", "scope-a", "suggestions", "issue-1", "item-1"],
      ["warehouse-operation", "rack-cells", "rack-1"],
      ["dashboard", "stock-items"],
      ["reports", "stock", { warehouseId: "warehouse-1" }],
    ] as const;
    const unrelatedKey = ["suppliers", "list"] as const;
    const queryClient = seededClient([...affectedKeys, unrelatedKey]);

    await invalidateScrapMutationQueries(queryClient);

    expectInvalidated(queryClient, affectedKeys);
    expect(queryClient.getQueryState(unrelatedKey)?.isInvalidated).toBe(false);
  });

  it("invalidates both putaway and scrap branches after confirming a goods return", async () => {
    const affectedKeys = [
      ["goods-returns", "detail", "return-1"],
      ["putaway-tasks", "detail", "putaway-1"],
      ["scrap-notes", "detail", "scrap-1"],
      ["goods-issues", "scope-a", "list", 1, "ALL"],
      ["warehouse-operation", "rack-cells", "rack-1"],
      ["dashboard", "stock-items"],
      ["reports", "stock", { warehouseId: "warehouse-1" }],
    ] as const;
    const unrelatedKey = ["suppliers", "list"] as const;
    const queryClient = seededClient([...affectedKeys, unrelatedKey]);

    await invalidateGoodsReturnConfirmQueries(queryClient);

    expectInvalidated(queryClient, affectedKeys);
    expect(queryClient.getQueryState(unrelatedKey)?.isInvalidated).toBe(false);
  });
});
