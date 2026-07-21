import { apiClient } from "@/lib/api-client";
import { type ApiEnvelope, unwrapApiData } from "@/lib/api-contract";
import { normalizeApiList, type ApiListLike } from "@/lib/api-list";
import type {
  CreateUserInput,
  CreateUserResponse,
  ListWmsUsersQuery,
  ResetUserPasswordInput,
  ResetUserPasswordResponse,
  UpdateUserInput,
  UpdateUserRolesInput,
  WmsUserResponse,
} from "@/types/api";

function userPath(userId: string) {
  return `/users/${encodeURIComponent(userId)}`;
}

export async function listWmsUsers(query: ListWmsUsersQuery = {}) {
  const response = await apiClient.get<ApiListLike<WmsUserResponse>>("/users", {
    params: query,
  });

  return normalizeApiList(response.data);
}

export async function getWmsUser(userId: string) {
  const response = await apiClient.get<
    ApiEnvelope<WmsUserResponse> | WmsUserResponse
  >(userPath(userId));

  return unwrapApiData(response.data);
}

export async function createWmsUser(input: CreateUserInput) {
  const response = await apiClient.post<
    ApiEnvelope<CreateUserResponse> | CreateUserResponse
  >("/users", input);

  return unwrapApiData(response.data);
}

export async function updateWmsUser(userId: string, input: UpdateUserInput) {
  const response = await apiClient.patch<
    ApiEnvelope<WmsUserResponse> | WmsUserResponse
  >(userPath(userId), input);

  return unwrapApiData(response.data);
}

export async function updateWmsUserRoles(
  userId: string,
  input: UpdateUserRolesInput,
) {
  const response = await apiClient.patch<
    ApiEnvelope<WmsUserResponse> | WmsUserResponse
  >(`${userPath(userId)}/roles`, input);

  return unwrapApiData(response.data);
}

export async function lockWmsUser(userId: string) {
  const response = await apiClient.post<
    ApiEnvelope<WmsUserResponse> | WmsUserResponse
  >(`${userPath(userId)}/lock`);

  return unwrapApiData(response.data);
}

export async function unlockWmsUser(userId: string) {
  const response = await apiClient.post<
    ApiEnvelope<WmsUserResponse> | WmsUserResponse
  >(`${userPath(userId)}/unlock`);

  return unwrapApiData(response.data);
}

export async function resetWmsUserPassword(
  userId: string,
  input: ResetUserPasswordInput,
) {
  const response = await apiClient.post<
    ApiEnvelope<ResetUserPasswordResponse> | ResetUserPasswordResponse
  >(`${userPath(userId)}/reset-password`, input);

  return unwrapApiData(response.data);
}

export async function deleteWmsUser(userId: string) {
  await apiClient.delete(userPath(userId));
}
