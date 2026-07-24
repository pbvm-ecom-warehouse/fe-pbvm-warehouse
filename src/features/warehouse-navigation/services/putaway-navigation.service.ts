import { apiClient } from "@/lib/api-client";
import {
  throwIfMissingBackendEndpoint,
  type ApiEnvelope,
  unwrapApiData,
} from "@/lib/api-contract";

export type PutawaySuggestionInput = {
  quantity: number;
  sku: string;
};

export type PutawaySuggestionWarning =
  | "ITEM_NO_DIMENSIONS"
  | "NO_SHELF_FITS"
  | "INSUFFICIENT_CAPACITY";

export type PutawayShelfSuggestion = {
  shelfCode: string;
  capacity: number;
};

export type PutawaySuggestionResponse = {
  suggestions: PutawayShelfSuggestion[];
  warning?: PutawaySuggestionWarning | null;
};

export type PutawaySuggestionResult = {
  source: "api";
  suggestions: PutawayShelfSuggestion[];
  warning?: PutawaySuggestionWarning | null;
};

export async function listPutawaySuggestionResult(
  input: PutawaySuggestionInput,
): Promise<PutawaySuggestionResult> {
  try {
    const response = await apiClient.get<
      ApiEnvelope<PutawaySuggestionResponse> | PutawaySuggestionResponse
    >("/putaway/suggestions", {
      params: {
        qty: input.quantity,
        sku: input.sku,
      },
    });
    const payload = unwrapApiData(response.data);

    return {
      source: "api",
      suggestions: payload.suggestions,
      warning: payload.warning,
    };
  } catch (error) {
    throwIfMissingBackendEndpoint(error, "GET /api/wms/putaway/suggestions");
    throw error;
  }
}

export async function listPutawaySuggestions(input: PutawaySuggestionInput) {
  return (await listPutawaySuggestionResult(input)).suggestions;
}
