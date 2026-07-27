import { apiClient } from "@/lib/api-client";
import {
  isApiEnvelope,
  type ApiEnvelope,
  type ApiMeta,
  unwrapApiData,
} from "@/lib/api-contract";

export const SUPPLIER_STATUSES = ["ACTIVE", "INACTIVE", "BLACKLIST"] as const;

export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number];

export type Supplier = {
  id: string;
  code: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxCode?: string;
  status: SupplierStatus;
  note?: string;
  createdAt: string;
  updatedAt: string;
};

const SUPPLIER_OPTIONAL_TEXT_FIELDS = [
  "contactName",
  "phone",
  "email",
  "address",
  "taxCode",
  "note",
] as const satisfies ReadonlyArray<keyof Supplier>;

type SupplierWire = Omit<
  Supplier,
  (typeof SUPPLIER_OPTIONAL_TEXT_FIELDS)[number]
> &
  Partial<
    Record<(typeof SUPPLIER_OPTIONAL_TEXT_FIELDS)[number], string | null>
  >;
export type SupplierItem = {
  id: string;
  itemId: string;
  sku?: string;
  itemName?: string;
  supplierId: string;
  supplierItemCode?: string;
  purchasePrice: number;
  leadTimeDays?: number;
  minOrderQty?: number;
  isActive: boolean;
  updatedAt: string;
};

export type QuerySupplierItemsInput = {
  supplierId?: string;
  itemId?: string;
  page?: number;
  limit?: number;
};

export type SupplierItemListResult = {
  data: SupplierItem[];
  total: number;
  page: number;
  limit: number;
};

export type QuerySuppliersInput = {
  status?: SupplierStatus | "ALL";
  search?: string;
  page?: number;
  limit?: number;
};

export type SupplierListResult = {
  data: Supplier[];
  total: number;
  page: number;
  limit: number;
};

export type CreateSupplierInput = {
  code: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxCode?: string;
  note?: string;
};

export type UpdateSupplierInput = Partial<CreateSupplierInput>;

export type CreateSupplierItemInput = {
  itemId: string;
  supplierId: string;
  supplierItemCode?: string;
  purchasePrice: number;
  leadTimeDays?: number;
  minOrderQty?: number;
};

export type UpdateSupplierItemInput = Partial<
  Omit<CreateSupplierItemInput, "itemId" | "supplierId">
> & {
  isActive?: boolean;
};

type SupplierListPayload = {
  data: Supplier[];
  total: number;
  page: number;
  limit: number;
};

type SupplierListEnvelope = ApiEnvelope<SupplierListPayload | Supplier[]>;

function toOptionalString(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeSupplier(supplier: SupplierWire): Supplier {
  const normalized = { ...supplier } as Supplier;

  for (const field of SUPPLIER_OPTIONAL_TEXT_FIELDS) {
    const value = supplier[field];
    normalized[field] =
      typeof value === "string" && value.trim() ? value.trim() : undefined;
  }

  return normalized;
}

function toSupplierListResult(
  payload: SupplierListEnvelope | SupplierListPayload | Supplier[],
): SupplierListResult {
  const data = unwrapApiData(payload);

  if (Array.isArray(data)) {
    return {
      data: data.map((supplier) => normalizeSupplier(supplier as SupplierWire)),
      limit: data.length,
      page: 1,
      total: data.length,
    };
  }

  return {
    data: data.data.map((supplier) =>
      normalizeSupplier(supplier as SupplierWire),
    ),
    limit: data.limit,
    page: data.page,
    total: data.total,
  };
}

export function normalizeSupplierListResponse(
  payload: SupplierListEnvelope | SupplierListPayload | Supplier[],
) {
  return toSupplierListResult(payload);
}

export function isSupplierStatus(value: unknown): value is SupplierStatus {
  return (
    typeof value === "string" &&
    SUPPLIER_STATUSES.includes(value as SupplierStatus)
  );
}

export async function listSuppliers(input: QuerySuppliersInput = {}) {
  const response = await apiClient.get<
    SupplierListEnvelope | SupplierListPayload | Supplier[]
  >("/supplier", {
    params: {
      limit: input.limit,
      page: input.page,
      search: toOptionalString(input.search),
      status: input.status && input.status !== "ALL" ? input.status : undefined,
    },
  });

  return toSupplierListResult(response.data);
}

export async function getSupplier(supplierId: string) {
  const response = await apiClient.get<
    ApiEnvelope<SupplierWire> | SupplierWire
  >(`/supplier/${encodeURIComponent(supplierId)}`);

  return normalizeSupplier(unwrapApiData(response.data));
}

export async function createSupplier(input: CreateSupplierInput) {
  const response = await apiClient.post<ApiEnvelope<Supplier> | Supplier>(
    "/supplier",
    input,
  );

  return normalizeSupplier(unwrapApiData(response.data) as SupplierWire);
}

export async function updateSupplier(
  supplierId: string,
  input: UpdateSupplierInput,
) {
  const response = await apiClient.patch<ApiEnvelope<Supplier> | Supplier>(
    `/supplier/${encodeURIComponent(supplierId)}`,
    input,
  );

  return normalizeSupplier(unwrapApiData(response.data) as SupplierWire);
}

export async function changeSupplierStatus(
  supplierId: string,
  status: SupplierStatus,
) {
  const response = await apiClient.patch<ApiEnvelope<Supplier> | Supplier>(
    `/supplier/${encodeURIComponent(supplierId)}/status`,
    { status },
  );

  return normalizeSupplier(unwrapApiData(response.data) as SupplierWire);
}

export async function deleteSupplier(supplierId: string) {
  await apiClient.delete(`/supplier/${encodeURIComponent(supplierId)}`);
}

export async function upsertSupplierItem(input: CreateSupplierItemInput) {
  const response = await apiClient.post<
    ApiEnvelope<SupplierItem> | SupplierItem
  >("/supplier/items", input);

  return unwrapApiData(response.data);
}

type SupplierItemListPayload = {
  data: SupplierItem[];
  total: number;
  page: number;
  limit: number;
};

type SupplierItemListEnvelope = ApiEnvelope<
  SupplierItemListPayload | SupplierItem[]
>;

function toSupplierItemListResult(
  payload: SupplierItemListEnvelope | SupplierItemListPayload | SupplierItem[],
): SupplierItemListResult {
  const data = unwrapApiData(payload);

  if (Array.isArray(data)) {
    return { data, limit: data.length, page: 1, total: data.length };
  }

  return { data: data.data, limit: data.limit, page: data.page, total: data.total };
}

export async function listSupplierItems(input: QuerySupplierItemsInput = {}) {
  const response = await apiClient.get<
    SupplierItemListEnvelope | SupplierItemListPayload | SupplierItem[]
  >("/supplier/items", {
    params: {
      itemId: input.itemId,
      limit: input.limit,
      page: input.page,
      supplierId: input.supplierId,
    },
  });

  return toSupplierItemListResult(response.data);
}

/** Toàn bộ báo giá của 1 NCC — dùng khi PO cần auto-fill giá theo supplier đã chọn. */
export async function listSupplierItemsBySupplier(supplierId: string) {
  const result = await listSupplierItems({ limit: 100, supplierId });
  return result.data;
}

export async function getSupplierItemByItem(itemId: string) {
  const result = await listSupplierItems({ itemId, limit: 1 });
  return result.data[0];
}

export async function getSupplierItem(supplierItemId: string) {
  const response = await apiClient.get<
    ApiEnvelope<SupplierItem> | SupplierItem
  >(`/supplier/items/${encodeURIComponent(supplierItemId)}`);

  return unwrapApiData(response.data);
}

export async function updateSupplierItem(
  supplierItemId: string,
  input: UpdateSupplierItemInput,
) {
  const mutableInput = {
    ...input,
  } as UpdateSupplierItemInput & { itemId?: string; supplierId?: string };
  delete mutableInput.itemId;
  delete mutableInput.supplierId;
  const response = await apiClient.patch<
    ApiEnvelope<SupplierItem> | SupplierItem
  >(`/supplier/items/${encodeURIComponent(supplierItemId)}`, mutableInput);

  return unwrapApiData(response.data);
}

export function extractPaginationMeta(payload: unknown): ApiMeta | undefined {
  return isApiEnvelope(payload) ? payload.meta : undefined;
}
