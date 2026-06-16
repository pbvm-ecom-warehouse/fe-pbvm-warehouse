import { apiClient } from "@/lib/api-client";
import { type ApiEnvelope, unwrapApiData } from "@/lib/api-contract";
import type { PutawaySuggestion } from "@/types/api";

import {
  fallbackPutawaySuggestions,
  type PutawaySuggestionInput,
} from "../utils/putaway-navigation";

export async function listPutawaySuggestions(input: PutawaySuggestionInput) {
  try {
    const response = await apiClient.get<
      ApiEnvelope<PutawaySuggestion[]> | PutawaySuggestion[]
    >("/putaway/suggestions", {
      params: {
        sku: input.sku,
        qty: input.quantity,
        warehouseId: input.warehouseId,
      },
    });

    return unwrapApiData(response.data);
  } catch {
    return fallbackPutawaySuggestions(input);
  }
}
