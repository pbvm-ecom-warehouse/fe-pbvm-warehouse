import { apiClient } from "@/lib/api-client";
import { normalizeApiList, type ApiListLike } from "@/lib/api-list";
import { type ApiEnvelope, unwrapApiData } from "@/lib/api-contract";

export const WAREHOUSE_ITEM_TYPES = [
  "MATERIAL",
  "CUP_BLANK",
  "CUP_PRINTED",
  "PACKAGING",
] as const;

export type WarehouseItemType = (typeof WAREHOUSE_ITEM_TYPES)[number];

export type WarehouseItemAltUnit = {
  unit: string;
  factor?: number;
  quantity?: number;
  [key: string]: unknown;
};

export type WarehouseItemAttribute = {
  name?: string;
  value?: string;
  code?: string;
  [key: string]: unknown;
};

export type WarehouseItem = {
  id: string;
  sku: string;
  barcode?: string | null;
  altBarcodes?: string[];
  name: string;
  type: WarehouseItemType;
  unit: string;
  altUnits?: WarehouseItemAltUnit[];
  attributes?: WarehouseItemAttribute[];
  isPerishable: boolean;
  nearExpiryDays?: number | null;
  depth?: number | null;
  width?: number | null;
  height?: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type QueryWarehouseItemsInput = {
  search?: string;
  type?: WarehouseItemType | "ALL";
  isActive?: boolean | "ALL";
  page?: number;
  limit?: number;
};

export type CreateWarehouseItemInput = {
  sku: string;
  name: string;
  type: WarehouseItemType;
  unit: string;
  barcode?: string;
  altBarcodes?: string[];
  altUnits?: WarehouseItemAltUnit[];
  attributes?: WarehouseItemAttribute[];
  isPerishable?: boolean;
  nearExpiryDays?: number;
  depth?: number;
  width?: number;
  height?: number;
};

export type UpdateWarehouseItemInput = Partial<
  Omit<CreateWarehouseItemInput, "sku">
> & {
  isActive?: boolean;
};

function optionalText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function normalizeWarehouseItemListResponse(
  payload: ApiListLike<WarehouseItem>,
) {
  return normalizeApiList(payload);
}

export async function listWarehouseItems(
  input: QueryWarehouseItemsInput = {},
) {
  const response = await apiClient.get<ApiListLike<WarehouseItem>>(
    "/stock/items",
    {
      params: {
        isActive: input.isActive === "ALL" ? undefined : input.isActive,
        limit: input.limit,
        page: input.page,
        search: optionalText(input.search),
        type: input.type && input.type !== "ALL" ? input.type : undefined,
      },
    },
  );

  return normalizeWarehouseItemListResponse(response.data);
}

export async function createWarehouseItem(input: CreateWarehouseItemInput) {
  const response = await apiClient.post<ApiEnvelope<WarehouseItem> | WarehouseItem>(
    "/stock/items",
    input,
  );

  return unwrapApiData(response.data);
}

export async function getWarehouseItem(itemId: string) {
  const response = await apiClient.get<ApiEnvelope<WarehouseItem> | WarehouseItem>(
    `/stock/items/${encodeURIComponent(itemId)}`,
  );

  return unwrapApiData(response.data);
}

export async function updateWarehouseItem(
  itemId: string,
  input: UpdateWarehouseItemInput,
) {
  const response = await apiClient.patch<
    ApiEnvelope<WarehouseItem> | WarehouseItem
  >(`/stock/items/${encodeURIComponent(itemId)}`, input);

  return unwrapApiData(response.data);
}

export async function deleteWarehouseItem(itemId: string) {
  await apiClient.delete(`/stock/items/${encodeURIComponent(itemId)}`);
}
