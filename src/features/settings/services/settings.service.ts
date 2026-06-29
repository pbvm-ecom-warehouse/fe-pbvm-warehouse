import { apiClient } from "@/lib/api-client";
import { type ApiEnvelope, unwrapApiData } from "@/lib/api-contract";
import type { WmsHealthResponse, WmsRootResponse } from "@/types/api";

export async function getWmsHealth() {
  const response = await apiClient.get<
    ApiEnvelope<WmsHealthResponse> | WmsHealthResponse
  >("/health");

  return unwrapApiData(response.data);
}

export async function getWmsRoot() {
  const response = await apiClient.get<ApiEnvelope<WmsRootResponse> | WmsRootResponse>(
    "/",
  );

  return unwrapApiData(response.data);
}
