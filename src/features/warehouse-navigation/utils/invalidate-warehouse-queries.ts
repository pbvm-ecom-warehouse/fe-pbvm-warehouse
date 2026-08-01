import type { QueryClient, QueryKey } from "@tanstack/react-query";

const stockAvailabilityQueryRoots = [
  ["goods-issues"],
  ["warehouse-operation", "rack-cells"],
  ["putaway-suggestions"],
  ["stock-items"],
  ["dashboard", "stock-items"],
  ["reports", "stock"],
] as const satisfies readonly QueryKey[];

const scrapMutationQueryRoots = [
  ["scrap-notes"],
  ["stock-counts"],
  ...stockAvailabilityQueryRoots,
] as const satisfies readonly QueryKey[];

const goodsReturnConfirmQueryRoots = [
  ["goods-returns"],
  ["putaway-tasks"],
  ["scrap-notes"],
  ...stockAvailabilityQueryRoots,
] as const satisfies readonly QueryKey[];

async function invalidateQueryRoots(
  queryClient: QueryClient,
  queryRoots: readonly QueryKey[],
) {
  await Promise.all(
    queryRoots.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
}

export function invalidateScrapMutationQueries(queryClient: QueryClient) {
  return invalidateQueryRoots(queryClient, scrapMutationQueryRoots);
}

export function invalidateGoodsReturnConfirmQueries(queryClient: QueryClient) {
  return invalidateQueryRoots(queryClient, goodsReturnConfirmQueryRoots);
}
