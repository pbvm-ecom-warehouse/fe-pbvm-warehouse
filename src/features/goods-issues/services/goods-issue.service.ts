import { apiClient } from "@/lib/api-client";
import { normalizeApiList, type ApiListLike } from "@/lib/api-list";
import { type ApiEnvelope, unwrapApiData } from "@/lib/api-contract";

export const GOODS_ISSUE_STATUSES = ["PENDING", "CONFIRMED"] as const;

export type GoodsIssueStatus = (typeof GOODS_ISSUE_STATUSES)[number];

export type GoodsIssueItem = {
  itemId: string;
  sku: string;
  quantity: number;
  remainingQty: number;
  unit?: string;
};

export type GoodsIssue = {
  id: string;
  orderId: string;
  warehouseId: string;
  status: GoodsIssueStatus;
  items: GoodsIssueItem[];
  createdAt?: string;
  updatedAt?: string;
};

export type QueryGoodsIssuesInput = {
  status?: GoodsIssueStatus | "ALL";
  warehouseId?: string;
  page?: number;
  limit?: number;
};

export type PickSuggestion = {
  shelfId: string;
  shelfCode: string;
  lotId?: string | null;
  lotNumber?: string | null;
  expiryDate?: string | null;
  quantity: number;
};

export type ConfirmGoodsIssueLineInput = {
  itemBarcode: string;
  shelfCode: string;
  quantity: number;
  lotId?: string;
};

function optionalText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function normalizeGoodsIssueListResponse(
  payload: ApiListLike<GoodsIssue>,
) {
  return normalizeApiList(payload);
}

export async function listGoodsIssues(input: QueryGoodsIssuesInput = {}) {
  const response = await apiClient.get<ApiListLike<GoodsIssue>>(
    "/goods-issues",
    {
      params: {
        limit: input.limit,
        page: input.page,
        status:
          input.status && input.status !== "ALL" ? input.status : undefined,
        warehouseId: optionalText(input.warehouseId),
      },
    },
  );

  return normalizeGoodsIssueListResponse(response.data);
}

export async function getGoodsIssue(goodsIssueId: string) {
  const response = await apiClient.get<ApiEnvelope<GoodsIssue> | GoodsIssue>(
    `/goods-issues/${encodeURIComponent(goodsIssueId)}`,
  );

  return unwrapApiData(response.data);
}

export async function listGoodsIssuePickSuggestions({
  goodsIssueId,
  itemId,
}: {
  goodsIssueId: string;
  itemId: string;
}) {
  const response = await apiClient.get<
    ApiEnvelope<PickSuggestion[]> | PickSuggestion[]
  >(
    `/goods-issues/${encodeURIComponent(goodsIssueId)}/items/${encodeURIComponent(
      itemId,
    )}/suggestions`,
  );

  return unwrapApiData(response.data);
}

export async function confirmGoodsIssueLine(
  goodsIssueId: string,
  input: ConfirmGoodsIssueLineInput,
) {
  const response = await apiClient.post<ApiEnvelope<GoodsIssue> | GoodsIssue>(
    `/goods-issues/${encodeURIComponent(goodsIssueId)}/confirm-line`,
    input,
  );

  return unwrapApiData(response.data);
}
