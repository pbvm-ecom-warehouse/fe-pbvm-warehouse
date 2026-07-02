import { AxiosError } from "axios";

const API_PREFIX = "/api/wms";
const MISSING_BACKEND_ENDPOINT_STATUSES = new Set([404, 501]);

export const MISSING_BACKEND_ENDPOINT_MESSAGE =
  "Chức năng này chưa sẵn sàng.";

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

export class MissingBackendEndpointError extends Error {
  endpoint?: string;
  status?: number;

  constructor({
    endpoint,
    status,
  }: {
    endpoint?: string;
    status?: number;
  } = {}) {
    super(MISSING_BACKEND_ENDPOINT_MESSAGE);
    this.name = "MissingBackendEndpointError";
    this.endpoint = endpoint;
    this.status = status;
  }
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function isAbsoluteUrl(value: string) {
  return /^https?:\/\//i.test(value);
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

  if (!isAbsoluteUrl(base)) {
    return `${base}${normalizedPath}`;
  }

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

export function getApiErrorMessage(error: unknown) {
  const payload =
    error instanceof AxiosError
      ? error.response?.data
      : (error as { response?: { data?: unknown } })?.response?.data;

  if (typeof payload !== "object" || payload === null) {
    return undefined;
  }

  const directMessage = (payload as { message?: unknown }).message;

  if (typeof directMessage === "string") {
    return directMessage;
  }

  const envelopeMessage = (payload as ApiErrorEnvelope).error?.message;
  return typeof envelopeMessage === "string" ? envelopeMessage : undefined;
}

export function getHttpStatus(error: unknown) {
  if (error instanceof AxiosError) {
    return error.response?.status;
  }

  return (error as { response?: { status?: number } })?.response?.status;
}

export function isMissingBackendEndpoint(error: unknown) {
  if (error instanceof MissingBackendEndpointError) {
    return true;
  }

  const status = getHttpStatus(error);
  return typeof status === "number" && MISSING_BACKEND_ENDPOINT_STATUSES.has(status);
}

export function toMissingBackendEndpointError(
  error: unknown,
  endpoint?: string,
) {
  if (error instanceof MissingBackendEndpointError) {
    return error;
  }

  return new MissingBackendEndpointError({
    endpoint,
    status: getHttpStatus(error),
  });
}

export function throwIfMissingBackendEndpoint(
  error: unknown,
  endpoint?: string,
) {
  if (isMissingBackendEndpoint(error)) {
    throw toMissingBackendEndpointError(error, endpoint);
  }
}
