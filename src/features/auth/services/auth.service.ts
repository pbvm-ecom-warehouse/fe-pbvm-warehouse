import { apiClient } from "@/lib/api-client";
import { type ApiEnvelope, unwrapApiData } from "@/lib/api-contract";
import { normalizeApiList, type ApiListLike } from "@/lib/api-list";
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
  ListWmsUsersQuery,
  ResetUserPasswordInput,
  ResetUserPasswordResponse,
  UpdateUserRolesInput,
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

export async function listWmsUsers(query: ListWmsUsersQuery = {}) {
  const response = await apiClient.get<ApiListLike<WmsUserResponse>>(
    "/auth/users",
    { params: query },
  );

  return normalizeApiList(response.data);
}

export async function createWmsUser(input: CreateUserInput) {
  const response = await apiClient.post<
    ApiEnvelope<CreateUserResponse> | CreateUserResponse
  >("/auth/users", input);

  return unwrapApiData(response.data);
}

export async function updateWmsUserRoles(
  userId: string,
  input: UpdateUserRolesInput,
) {
  const response = await apiClient.patch<
    ApiEnvelope<WmsUserResponse> | WmsUserResponse
  >(`/auth/users/${encodeURIComponent(userId)}/roles`, input);

  return unwrapApiData(response.data);
}

export async function lockWmsUser(userId: string) {
  const response = await apiClient.post<
    ApiEnvelope<WmsUserResponse> | WmsUserResponse
  >(`/auth/users/${encodeURIComponent(userId)}/lock`);

  return unwrapApiData(response.data);
}

export async function unlockWmsUser(userId: string) {
  const response = await apiClient.post<
    ApiEnvelope<WmsUserResponse> | WmsUserResponse
  >(`/auth/users/${encodeURIComponent(userId)}/unlock`);

  return unwrapApiData(response.data);
}

export async function resetWmsUserPassword(
  userId: string,
  input: ResetUserPasswordInput,
) {
  const response = await apiClient.post<
    ApiEnvelope<ResetUserPasswordResponse> | ResetUserPasswordResponse
  >(`/auth/users/${encodeURIComponent(userId)}/reset-password`, input);

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
