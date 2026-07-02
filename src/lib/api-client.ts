import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

import {
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  getTenantId,
  setAuthTokens,
  type AuthTokens,
} from "@/lib/auth-token";
import { getApiBaseUrl, type ApiEnvelope, unwrapApiData } from "@/lib/api-contract";
import { env } from "@/lib/env";

type RetryRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

type RefreshResponse = {
  accessToken: string;
  refreshToken?: string;
};

export const apiClient = axios.create({
  baseURL: getApiBaseUrl(env.NEXT_PUBLIC_WMS_API_URL),
  timeout: 15_000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    "X-Tenant-ID": env.NEXT_PUBLIC_DEFAULT_TENANT_ID,
  },
});

const refreshClient = axios.create({
  baseURL: getApiBaseUrl(env.NEXT_PUBLIC_WMS_API_URL),
  timeout: 15_000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    "X-Tenant-ID": env.NEXT_PUBLIC_DEFAULT_TENANT_ID,
  },
});

let refreshPromise: Promise<AuthTokens> | null = null;

async function refreshAccessToken() {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    throw new Error("Missing refresh token");
  }

  refreshPromise ??= refreshClient
    .post<ApiEnvelope<RefreshResponse> | RefreshResponse>("/auth/refresh", {
      refreshToken,
    })
    .then((response) => {
      const data = unwrapApiData(response.data);
      const tokens = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken ?? refreshToken,
      };

      setAuthTokens(tokens);
      return tokens;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  const tenantId = getTenantId(env.NEXT_PUBLIC_DEFAULT_TENANT_ID);

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  config.headers["X-Tenant-ID"] = tenantId;

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryRequestConfig | undefined;

    if (originalRequest?.url?.includes("/auth/login")) {
      return Promise.reject(error);
    }

    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      !getRefreshToken()
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const tokens = await refreshAccessToken();
      originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      clearAuthTokens();
      return Promise.reject(refreshError);
    }
  },
);
