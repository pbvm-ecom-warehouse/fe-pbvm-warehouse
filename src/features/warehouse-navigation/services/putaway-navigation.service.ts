import { apiClient } from "@/lib/api-client";
import {
  throwIfMissingBackendEndpoint,
  type ApiEnvelope,
  unwrapApiData,
} from "@/lib/api-contract";

export type NavigationPath = {
  startGateCode: string;
  targetRackId: string;
  points: { xM: number; yM: number }[];
  distanceM: number;
};

export type PutawaySuggestionInput = {
  packageCount: number;
  sku: string;
  lotId?: string;
  packageSpec?: {
    depthCm: number;
    widthCm: number;
    heightCm: number;
    volumeCm3: number;
  };
};

export type PutawaySuggestionWarning =
  | "ITEM_NO_DIMENSIONS"
  | "NO_SHELF_FITS"
  | "INSUFFICIENT_CAPACITY"
  | "NO_NAVIGATION_PATH";

export type PutawayShelfSuggestion = {
  shelfCode: string;
  capacity: number;
  cellId: string;
  cellCode: string;
  rackId: string;
  level: number;
  bay: number;
  fillPercent: number;
  reason: "SAME_SKU_LOT_CELL" | "SAME_SKU_CELL" | "BEST_FIT_VOLUME";
  path: NavigationPath;
};

export type PutawaySuggestionResponse = {
  suggestions: PutawayShelfSuggestion[];
  warning?: PutawaySuggestionWarning | null;
};

export type PutawaySuggestionResult = PutawaySuggestionResponse & {
  source: "api";
};

export async function listPutawaySuggestionResult(
  input: PutawaySuggestionInput,
): Promise<PutawaySuggestionResult> {
  try {
    const response = await apiClient.get<
      ApiEnvelope<PutawaySuggestionResponse> | PutawaySuggestionResponse
    >("/putaway/suggestions", {
      params: {
        qty: input.packageCount,
        sku: input.sku,
        lotId: input.lotId,
        packageVolumeCm3: input.packageSpec?.volumeCm3,
        packageDepthCm: input.packageSpec?.depthCm,
        packageWidthCm: input.packageSpec?.widthCm,
        packageHeightCm: input.packageSpec?.heightCm,
      },
    });
    const payload = unwrapApiData(response.data);
    return { source: "api", ...payload };
  } catch (error) {
    throwIfMissingBackendEndpoint(error, "GET /api/wms/putaway/suggestions");
    throw error;
  }
}
