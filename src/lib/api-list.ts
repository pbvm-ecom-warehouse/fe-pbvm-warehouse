import {
  isApiEnvelope,
  type ApiEnvelope,
  type ApiPagination,
} from "@/lib/api-contract";

export type ApiListPayload<T> = {
  data: T[];
  total?: number;
  page?: number;
  limit?: number;
  pageSize?: number;
};

export type ApiListResult<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
};

export type ApiListLike<T> =
  | ApiEnvelope<ApiListPayload<T> | T[]>
  | ApiListPayload<T>
  | T[];

function fromPagination(
  pagination: ApiPagination | undefined,
  length: number,
) {
  return {
    limit: pagination?.pageSize ?? length,
    page: pagination?.page ?? 1,
    total: pagination?.total ?? length,
  };
}

export function normalizeApiList<T>(
  payload: ApiListLike<T>,
): ApiListResult<T> {
  const pagination = isApiEnvelope<ApiListPayload<T> | T[]>(payload)
    ? payload.meta.pagination
    : undefined;
  const data = isApiEnvelope<ApiListPayload<T> | T[]>(payload)
    ? payload.data
    : payload;

  if (Array.isArray(data)) {
    return {
      data,
      ...fromPagination(pagination, data.length),
    };
  }

  const rows = data.data;

  return {
    data: rows,
    limit: data.limit ?? data.pageSize ?? pagination?.pageSize ?? rows.length,
    page: data.page ?? pagination?.page ?? 1,
    total: data.total ?? pagination?.total ?? rows.length,
  };
}
