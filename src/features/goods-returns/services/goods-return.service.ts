import { appendIndexedEvidenceImages } from "@/components/evidence-images/evidence-image-utils";
import { apiClient } from "@/lib/api-client";
import { normalizeApiList, type ApiListLike } from "@/lib/api-list";
import { type ApiEnvelope, unwrapApiData } from "@/lib/api-contract";

export const GOODS_RETURN_STATUSES = [
  "DRAFT",
  "INSPECTED",
  "RESTOCKED",
  "CANCELLED",
] as const;

export const GOODS_RETURN_ITEM_CONDITIONS = ["GOOD", "DAMAGED"] as const;

export type GoodsReturnStatus = (typeof GOODS_RETURN_STATUSES)[number];
export type GoodsReturnItemCondition =
  (typeof GOODS_RETURN_ITEM_CONDITIONS)[number];

export type GoodsReturnItem = {
  itemId: string;
  sku: string;
  quantity: number;
  condition: GoodsReturnItemCondition | null;
  shelfId: string | null;
  lotId: string | null;
  scrapNoteId: string | null;
  images: string[];
};

export type GoodsReturn = {
  id: string;
  orderId?: string;
  status: GoodsReturnStatus;
  note?: string;
  createdBy: string | null;
  items: GoodsReturnItem[];
  createdAt: string;
  updatedAt: string;
};

export type QueryGoodsReturnsInput = {
  status?: GoodsReturnStatus | "ALL";
  orderId?: string;
  page?: number;
  limit?: number;
};

export type CreateGoodsReturnItemInput = {
  itemId: string;
  quantity: number;
};

export type CreateGoodsReturnInput = {
  orderId?: string;
  note?: string;
  items: CreateGoodsReturnItemInput[];
};

export type InspectGoodsReturnItemInput = {
  itemId: string;
  condition: GoodsReturnItemCondition;
  shelfId: string;
  lotId?: string;
};

export type InspectGoodsReturnInput = {
  items: InspectGoodsReturnItemInput[];
  itemImages?: File[][];
};

function optionalText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function normalizeGoodsReturnListResponse(
  payload: ApiListLike<GoodsReturn>,
) {
  return normalizeApiList(payload);
}

export async function listGoodsReturns(input: QueryGoodsReturnsInput = {}) {
  const response = await apiClient.get<ApiListLike<GoodsReturn>>(
    "/goods-returns",
    {
      params: {
        limit: input.limit,
        orderId: optionalText(input.orderId),
        page: input.page,
        status:
          input.status && input.status !== "ALL" ? input.status : undefined,
      },
    },
  );

  return normalizeGoodsReturnListResponse(response.data);
}

export async function getGoodsReturn(goodsReturnId: string) {
  const response = await apiClient.get<ApiEnvelope<GoodsReturn> | GoodsReturn>(
    `/goods-returns/${encodeURIComponent(goodsReturnId)}`,
  );

  return unwrapApiData(response.data);
}

export async function createGoodsReturn(input: CreateGoodsReturnInput) {
  const response = await apiClient.post<ApiEnvelope<GoodsReturn> | GoodsReturn>(
    "/goods-returns",
    input,
  );

  return unwrapApiData(response.data);
}

export async function inspectGoodsReturn(
  goodsReturnId: string,
  input: InspectGoodsReturnInput,
) {
  const formData = new FormData();
  formData.append("items", JSON.stringify(input.items));
  appendIndexedEvidenceImages(formData, input.itemImages);

  const response = await apiClient.post<ApiEnvelope<GoodsReturn> | GoodsReturn>(
    `/goods-returns/${encodeURIComponent(goodsReturnId)}/inspect`,
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
    },
  );

  return unwrapApiData(response.data);
}

export async function confirmGoodsReturn(goodsReturnId: string) {
  const response = await apiClient.post<ApiEnvelope<GoodsReturn> | GoodsReturn>(
    `/goods-returns/${encodeURIComponent(goodsReturnId)}/confirm`,
  );

  return unwrapApiData(response.data);
}

export async function cancelGoodsReturn(goodsReturnId: string) {
  const response = await apiClient.post<ApiEnvelope<GoodsReturn> | GoodsReturn>(
    `/goods-returns/${encodeURIComponent(goodsReturnId)}/cancel`,
  );

  return unwrapApiData(response.data);
}
