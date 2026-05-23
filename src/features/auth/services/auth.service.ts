import { apiClient } from "@/lib/api-client";
import { clearAuthTokens, setAuthTokens, setTenantId } from "@/lib/auth-token";

import type { LoginInput } from "../schemas/login.schema";

export async function login(input: LoginInput) {
  const response = await apiClient.post<{
    accessToken: string;
    refreshToken: string;
  }>("/auth/login", input);

  setAuthTokens(response.data);
  setTenantId(input.tenantId);

  return response.data;
}

export async function logout() {
  try {
    await apiClient.post("/auth/logout");
  } finally {
    clearAuthTokens();
  }
}
