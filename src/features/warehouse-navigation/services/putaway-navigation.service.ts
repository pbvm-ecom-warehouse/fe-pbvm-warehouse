import { apiClient } from "@/lib/api-client";
import {
  throwIfMissingBackendEndpoint,
  type ApiEnvelope,
  unwrapApiData,
} from "@/lib/api-contract";
import type { PutawaySuggestion, ShelfContentItem } from "@/types/api";

import {
  GATE_ROUTE_POINT,
  buildRouteToShelf,
  type PutawaySuggestionInput,
} from "../utils/putaway-navigation";

export type PutawaySuggestionResult = {
  source: "api";
  suggestions: PutawaySuggestion[];
};

function normalizeSuggestionRoutes(suggestions: PutawaySuggestion[]) {
  return suggestions.map((suggestion) => ({
    ...suggestion,
    route: suggestion.route ?? buildRouteToShelf(suggestion.shelf),
  }));
}

export async function listPutawaySuggestionResult(
  input: PutawaySuggestionInput,
): Promise<PutawaySuggestionResult> {
  try {
    const response = await apiClient.get<
      ApiEnvelope<PutawaySuggestion[]> | PutawaySuggestion[]
    >("/putaway/suggestions", {
      params: {
        from: GATE_ROUTE_POINT.code,
        sku: input.sku,
        qty: input.quantity,
        warehouseId: input.warehouseId,
      },
    });

    return {
      source: "api",
      suggestions: normalizeSuggestionRoutes(unwrapApiData(response.data)),
    };
  } catch (error) {
    throwIfMissingBackendEndpoint(error, "GET /api/wms/putaway/suggestions");
    throw error;
  }
}

export async function listPutawaySuggestions(input: PutawaySuggestionInput) {
  return (await listPutawaySuggestionResult(input)).suggestions;
}

export async function listShelfContents({
  shelfCode,
  warehouseId,
}: {
  shelfCode: string;
  warehouseId: string;
}) {
  try {
    const response = await apiClient.get<
      ApiEnvelope<ShelfContentItem[]> | ShelfContentItem[]
    >(`/warehouse/shelves/${encodeURIComponent(shelfCode)}/contents`, {
      params: {
        warehouseId,
      },
    });

    return unwrapApiData(response.data);
  } catch (error) {
    throwIfMissingBackendEndpoint(
      error,
      `GET /api/wms/warehouse/shelves/${shelfCode}/contents`,
    );
    throw error;
  }
}
