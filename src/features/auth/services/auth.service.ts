import { apiClient } from "@/lib/api-client";
import { type ApiEnvelope, unwrapApiData } from "@/lib/api-contract";
import { env } from "@/lib/env";
import { sessionUserFromAccessToken } from "@/lib/auth";
import {
  clearAuthTokens,
  getRefreshToken,
  setAuthTokens,
  setTenantId,
} from "@/lib/auth-token";
import { useAuthStore } from "@/stores/auth-store";

import type { LoginInput } from "../schemas/login.schema";

export async function login(input: LoginInput) {
  type LoginResponse = {
    accessToken: string;
    refreshToken: string;
    mustChangePassword?: boolean;
  };
  const response = await apiClient.post<ApiEnvelope<LoginResponse> | LoginResponse>(
    "/auth/login",
    input,
  );
  const data = unwrapApiData(response.data);

  setAuthTokens(data);
  const sessionUser = sessionUserFromAccessToken(
    data.accessToken,
    env.NEXT_PUBLIC_DEFAULT_TENANT_ID,
  );

  if (!sessionUser) {
    clearAuthTokens();
    throw new Error("Access token WMS không chứa claims session hợp lệ.");
  }

  setTenantId(sessionUser.tenantId ?? env.NEXT_PUBLIC_DEFAULT_TENANT_ID);
  useAuthStore.getState().setUser(sessionUser);

  return data;
}

export async function logout() {
  const refreshToken = getRefreshToken();

  try {
    await apiClient.post("/auth/logout", refreshToken ? { refreshToken } : {});
  } finally {
    clearAuthTokens();
    useAuthStore.getState().clearUser();
  }
}
