import { apiClient } from "@/lib/api-client";
import {
  isApiEnvelope,
  type ApiEnvelope,
  type ApiMeta,
  unwrapApiData,
} from "@/lib/api-contract";

export const SUPPLIER_STATUSES = [
  "ACTIVE",
  "INACTIVE",
  "BLACKLIST",
] as const;

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

export type SupplierItem = {
  id: string;
  itemId: string;
  supplierId: string;
  supplierItemCode?: string;
  purchasePrice: number;
  leadTimeDays?: number;
  minOrderQty?: number;
  isActive: boolean;
  updatedAt: string;
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

export type UpdateSupplierItemInput = Partial<CreateSupplierItemInput> & {
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

function toSupplierListResult(
  payload: SupplierListEnvelope | SupplierListPayload | Supplier[],
): SupplierListResult {
  const data = unwrapApiData(payload);

  if (Array.isArray(data)) {
    return {
      data,
      limit: data.length,
      page: 1,
      total: data.length,
    };
  }

  return {
    data: data.data,
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
      status:
        input.status && input.status !== "ALL" ? input.status : undefined,
    },
  });

  return toSupplierListResult(response.data);
}

export async function createSupplier(input: CreateSupplierInput) {
  const response = await apiClient.post<ApiEnvelope<Supplier> | Supplier>(
    "/supplier",
    input,
  );

  return unwrapApiData(response.data);
}

export async function updateSupplier(
  supplierId: string,
  input: UpdateSupplierInput,
) {
  const response = await apiClient.patch<ApiEnvelope<Supplier> | Supplier>(
    `/supplier/${encodeURIComponent(supplierId)}`,
    input,
  );

  return unwrapApiData(response.data);
}

export async function changeSupplierStatus(
  supplierId: string,
  status: SupplierStatus,
) {
  const response = await apiClient.patch<ApiEnvelope<Supplier> | Supplier>(
    `/supplier/${encodeURIComponent(supplierId)}/status`,
    { status },
  );

  return unwrapApiData(response.data);
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

export async function listSupplierItemsBySupplier(supplierId: string) {
  const response = await apiClient.get<
    ApiEnvelope<SupplierItem[]> | SupplierItem[]
  >(`/supplier/items/by-supplier/${encodeURIComponent(supplierId)}`);

  return unwrapApiData(response.data);
}

export async function getSupplierItemByItem(itemId: string) {
  const response = await apiClient.get<ApiEnvelope<SupplierItem> | SupplierItem>(
    `/supplier/items/by-item/${encodeURIComponent(itemId)}`,
  );

  return unwrapApiData(response.data);
}

export async function getSupplierItem(supplierItemId: string) {
  const response = await apiClient.get<ApiEnvelope<SupplierItem> | SupplierItem>(
    `/supplier/items/${encodeURIComponent(supplierItemId)}`,
  );

  return unwrapApiData(response.data);
}

export async function updateSupplierItem(
  supplierItemId: string,
  input: UpdateSupplierItemInput,
) {
  const response = await apiClient.patch<
    ApiEnvelope<SupplierItem> | SupplierItem
  >(`/supplier/items/${encodeURIComponent(supplierItemId)}`, input);

  return unwrapApiData(response.data);
}

export function extractPaginationMeta(payload: unknown): ApiMeta | undefined {
  return isApiEnvelope(payload) ? payload.meta : undefined;
}
