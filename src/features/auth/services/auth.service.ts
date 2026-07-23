import { apiClient } from "@/lib/api-client";
import { type ApiEnvelope, unwrapApiData } from "@/lib/api-contract";
import { env } from "@/lib/env";
import {
  sessionUserFromAccessToken,
  sessionUserFromWmsUserResponse,
} from "@/lib/auth";
import {
  clearAuthTokens,
  getRefreshToken,
  setAuthTokens,
  setTenantId,
} from "@/lib/auth-token";
import { useAuthStore } from "@/stores/auth-store";
import type {
  AuthTokenResponse,
  ChangePasswordInput,
  ChangePasswordResponse,
  CreateUserInput,
  CreateUserResponse,
  WmsUserResponse,
} from "@/types/api";

import type { LoginInput } from "../schemas/login.schema";

async function establishSession(data: AuthTokenResponse) {
  setAuthTokens(data);
  const tokenUser = sessionUserFromAccessToken(
    data.accessToken,
    env.NEXT_PUBLIC_DEFAULT_TENANT_ID,
  );
  const currentUser = await getCurrentUser();
  const sessionUser = sessionUserFromWmsUserResponse(
    currentUser,
    tokenUser,
    env.NEXT_PUBLIC_DEFAULT_TENANT_ID,
  );

  if (!sessionUser) {
    clearAuthTokens();
    throw new Error("WMS không trả session user hợp lệ.");
  }

  setTenantId(sessionUser.tenantId ?? env.NEXT_PUBLIC_DEFAULT_TENANT_ID);
  useAuthStore.getState().setUser(sessionUser);
}

export async function getCurrentUser() {
  const response = await apiClient.get<
    ApiEnvelope<WmsUserResponse> | WmsUserResponse
  >("/auth/me");

  return unwrapApiData(response.data);
}

export async function uploadCurrentUserAvatar(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await apiClient.post<
    ApiEnvelope<WmsUserResponse> | WmsUserResponse
  >("/auth/me/avatar", formData);
  const currentUser = unwrapApiData(response.data);
  const sessionUser = sessionUserFromWmsUserResponse(
    currentUser,
    useAuthStore.getState().user,
    env.NEXT_PUBLIC_DEFAULT_TENANT_ID,
  );

  if (sessionUser) {
    useAuthStore.getState().setUser(sessionUser);
  }

  return currentUser;
}
export async function login(input: LoginInput) {
  const response = await apiClient.post<
    ApiEnvelope<AuthTokenResponse> | AuthTokenResponse
  >("/auth/login", input);
  const data = unwrapApiData(response.data);

  await establishSession(data);

  return data;
}

export async function changePassword(input: ChangePasswordInput) {
  const response = await apiClient.post<
    ApiEnvelope<ChangePasswordResponse> | ChangePasswordResponse
  >("/auth/change-password", input);

  return unwrapApiData(response.data);
}

export async function bootstrapAdmin(input: CreateUserInput) {
  const response = await apiClient.post<
    ApiEnvelope<CreateUserResponse> | CreateUserResponse
  >("/auth/bootstrap-admin", input);

  return unwrapApiData(response.data);
}

export async function logout() {
  const refreshToken = getRefreshToken();

  try {
    await apiClient.post("/auth/logout", refreshToken ? { refreshToken } : {});
  } catch {
    // Local logout must still complete even if the remote session revoke fails.
  } finally {
    clearAuthTokens();
    useAuthStore.getState().clearUser();
  }
}
