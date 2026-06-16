import { AxiosError } from "axios";

const API_PREFIX = "/api/wms";

export type ApiPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages?: number;
};

export type ApiMeta = {
  requestId?: string;
  timestamp?: string;
  pagination?: ApiPagination;
  [key: string]: unknown;
};

export type ApiEnvelope<T> = {
  data: T;
  meta: ApiMeta;
};

export type ApiErrorEnvelope = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: ApiMeta;
};

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function getApiBaseUrl(baseUrl: string) {
  const normalized = trimTrailingSlash(baseUrl);

  if (normalized.endsWith(API_PREFIX)) {
    return normalized;
  }

  return `${normalized}${API_PREFIX}`;
}

export function buildApiUrl(baseUrl: string, path: string) {
  const base = `${getApiBaseUrl(baseUrl)}/`;
  const normalizedPath = path.replace(/^\/+/, "");
  return new URL(normalizedPath, base).toString();
}

export function isApiEnvelope<T>(payload: unknown): payload is ApiEnvelope<T> {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "data" in payload &&
    "meta" in payload
  );
}

export function unwrapApiData<T>(payload: ApiEnvelope<T> | T): T {
  return isApiEnvelope<T>(payload) ? payload.data : payload;
}

export function getApiErrorCode(error: unknown) {
  if (error instanceof AxiosError) {
    const payload = error.response?.data as ApiErrorEnvelope | undefined;
    return payload?.error?.code;
  }

  const payload = (error as { response?: { data?: ApiErrorEnvelope } })
    ?.response?.data;
  return payload?.error?.code;
}
