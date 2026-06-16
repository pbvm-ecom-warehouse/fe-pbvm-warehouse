import { apiClient } from "@/lib/api-client";
import { type ApiEnvelope, unwrapApiData } from "@/lib/api-contract";
import {
  clearAuthTokens,
  getRefreshToken,
  setAuthTokens,
  setTenantId,
} from "@/lib/auth-token";

import type { LoginInput } from "../schemas/login.schema";

export async function login(input: LoginInput) {
  type LoginResponse = { accessToken: string; refreshToken: string };
  const response = await apiClient.post<ApiEnvelope<LoginResponse> | LoginResponse>(
    "/auth/login",
    input,
  );
  const data = unwrapApiData(response.data);

  setAuthTokens(data);
  setTenantId(input.tenantId);

  return data;
}

export async function logout() {
  const refreshToken = getRefreshToken();

  try {
    await apiClient.post("/auth/logout", refreshToken ? { refreshToken } : {});
  } finally {
    clearAuthTokens();
  }
}
