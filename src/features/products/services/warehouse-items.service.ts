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
export const CREATABLE_WAREHOUSE_ITEM_TYPES = [
  "CUP_BLANK",
  "MATERIAL",
  "PACKAGING",
] as const;
export type CreatableWarehouseItemType =
  (typeof CREATABLE_WAREHOUSE_ITEM_TYPES)[number];

export type AttributeKey =
  | "CUP_STYLE"
  | "MATERIAL"
  | "CAPACITY"
  | "COLOR"
  | "MATERIAL_CATEGORY"
  | "MATERIAL_TYPE"
  | "FLAVOR"
  | "SPEC"
  | "PACKAGING_CATEGORY"
  | "PACKAGING_STYLE"
  | "COMPATIBILITY"
  | "DIAMETER"
  | "LENGTH"
  | "SIZE";

export type AttributeOption = {
  id: string;
  key: AttributeKey;
  name: string;
  code: string;
  isActive: boolean;
  sortOrder: number;
};

export type SkuTemplate =
  | {
      kind: "category-options";
      categoryKey: AttributeKey;
      options: AttributeOption[];
    }
  | {
      kind: "template";
      templateId: string;
      itemType: CreatableWarehouseItemType;
      category?: string | null;
      prefix: string;
      fields: Array<{ key: AttributeKey }>;
    };

export type SkuPreview = { sku: string };

export type WarehouseItemAltUnit = {
  unit: string;
  factor?: number;
  quantity?: number;
  [key: string]: unknown;
};

export type WarehouseItemAttribute = {
  key?: AttributeKey;
  optionId?: string;
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
  category?: string | null;
  unit: string;
  altUnits?: WarehouseItemAltUnit[];
  attributes?: WarehouseItemAttribute[];
  isPerishable: boolean;
  nearExpiryDays?: number | null;
  minQuantity?: number | null;
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
  type: CreatableWarehouseItemType;
  templateId: string;
  attributeOptionIds: string[];
  name: string;
  unit: string;
  altUnits?: WarehouseItemAltUnit[];
  isPerishable?: boolean;
  nearExpiryDays?: number;
  minQuantity?: number;
  depth?: number;
  width?: number;
  height?: number;
};

export type UpdateWarehouseItemInput = Partial<{
  name: string;
  unit: string;
  altBarcodes: string[];
  altUnits: WarehouseItemAltUnit[];
  isPerishable: boolean;
  nearExpiryDays: number;
  minQuantity: number;
  depth: number;
  width: number;
  height: number;
  isActive: boolean;
}>;

export type CreateAttributeOptionInput = Pick<
  AttributeOption,
  "key" | "name" | "code"
>;

export type UpdateAttributeOptionInput = Partial<
  Pick<AttributeOption, "name" | "isActive" | "sortOrder">
>;

function optionalText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function normalizeWarehouseItemListResponse(
  payload: ApiListLike<WarehouseItem>,
) {
  return normalizeApiList(payload);
}

export async function listWarehouseItems(input: QueryWarehouseItemsInput = {}) {
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
  const response = await apiClient.post<
    ApiEnvelope<WarehouseItem> | WarehouseItem
  >("/stock/items", input);

  return unwrapApiData(response.data);
}

export async function getSkuTemplate(
  type: CreatableWarehouseItemType,
  categoryOptionId?: string,
) {
  const response = await apiClient.get<ApiEnvelope<SkuTemplate> | SkuTemplate>(
    `/stock/item-types/${encodeURIComponent(type)}/sku-template`,
    { params: { categoryOptionId: optionalText(categoryOptionId) } },
  );

  return unwrapApiData(response.data);
}

export async function previewWarehouseItemSku(
  input: Pick<
    CreateWarehouseItemInput,
    "type" | "templateId" | "attributeOptionIds"
  >,
) {
  const response = await apiClient.post<ApiEnvelope<SkuPreview> | SkuPreview>(
    "/stock/items/sku-preview",
    input,
  );

  return unwrapApiData(response.data);
}

export async function listAttributeOptions(
  key: AttributeKey,
  includeInactive = false,
) {
  const response = await apiClient.get<
    ApiEnvelope<AttributeOption[]> | AttributeOption[]
  >("/stock/attribute-options", { params: { includeInactive, key } });

  return unwrapApiData(response.data);
}

export async function suggestAttributeOptionCode(
  input: Pick<CreateAttributeOptionInput, "key" | "name">,
) {
  const response = await apiClient.post<
    ApiEnvelope<{ code: string }> | { code: string }
  >("/stock/attribute-options/code-suggestion", input);

  return unwrapApiData(response.data);
}

export async function createAttributeOption(input: CreateAttributeOptionInput) {
  const response = await apiClient.post<
    ApiEnvelope<AttributeOption> | AttributeOption
  >("/stock/attribute-options", input);

  return unwrapApiData(response.data);
}

export async function updateAttributeOption(
  optionId: string,
  input: UpdateAttributeOptionInput,
) {
  const response = await apiClient.patch<
    ApiEnvelope<AttributeOption> | AttributeOption
  >(`/stock/attribute-options/${encodeURIComponent(optionId)}`, input);

  return unwrapApiData(response.data);
}

export async function getWarehouseItem(itemId: string) {
  const response = await apiClient.get<
    ApiEnvelope<WarehouseItem> | WarehouseItem
  >(`/stock/items/${encodeURIComponent(itemId)}`);

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
