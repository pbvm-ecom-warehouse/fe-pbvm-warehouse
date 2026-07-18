import { apiClient } from "@/lib/api-client";
import { isApiEnvelope, unwrapApiData } from "@/lib/api-contract";

export type StockReportRow = {
  sku: string;
  itemName: string;
  warehouseId: string;
  warehouseName: string;
  onHand: number;
  reserved: number;
  expired: number;
  available: number;
};

export type LotExpiryFlag = "ok" | "expiringSoon" | "expired";
export type LotStatus = "ACTIVE" | "EXPIRED";

export type LotReportRow = {
  sku: string;
  itemName: string;
  lotNumber: string;
  expiryDate: string | null;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  status: LotStatus;
  expiryFlag: LotExpiryFlag;
};

export const PERFORMANCE_MOVEMENT_TYPES = [
  "RECEIVE",
  "PUTAWAY",
  "ISSUE",
  "ADJUST",
  "SCRAP",
  "PRINT_CONSUME",
  "PRINT_OUTPUT",
  "RETURN_IN",
] as const;

export type PerformanceMovementType =
  (typeof PERFORMANCE_MOVEMENT_TYPES)[number];

export type PerformanceReportRow = {
  type: PerformanceMovementType;
  totalQuantity: number;
  movementCount: number;
};

export type ReportPagination = {
  type?: "offset";
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

export type ReportPage<T> = {
  data: T[];
  pagination: ReportPagination;
};

export type StockReportQuery = {
  page: number;
  limit: number;
  warehouseId?: string;
  sku?: string;
};

export type LotReportQuery = StockReportQuery & {
  status?: LotStatus;
};

export type PerformanceReportQuery = {
  dateFrom: string;
  dateTo: string;
  warehouseId?: string;
  sku?: string;
};

type ReportEnvelope<T> = {
  data: T;
  meta: {
    pagination?: ReportPagination;
  };
};

function optionalText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function toReportPage<T>(
  payload: ReportEnvelope<T[]> | T[],
  fallback: Pick<ReportPagination, "page" | "limit">,
): ReportPage<T> {
  const data = unwrapApiData(payload);
  const pagination = isApiEnvelope<T[]>(payload)
    ? (payload.meta.pagination as ReportPagination | undefined)
    : undefined;

  return {
    data,
    pagination: {
      type: pagination?.type,
      hasNext: pagination?.hasNext ?? false,
      hasPrev: pagination?.hasPrev ?? false,
      limit: pagination?.limit ?? fallback.limit,
      page: pagination?.page ?? fallback.page,
      totalItems: pagination?.totalItems ?? data.length,
      totalPages: pagination?.totalPages ?? 1,
    },
  };
}

export async function getStockReport(input: StockReportQuery) {
  const response = await apiClient.get<ReportEnvelope<StockReportRow[]> | StockReportRow[]>(
    "/reports/stock",
    {
      params: {
        limit: input.limit,
        page: input.page,
        sku: optionalText(input.sku),
        warehouseId: input.warehouseId,
      },
    },
  );

  return toReportPage(response.data, input);
}

export async function getLotReport(input: LotReportQuery) {
  const response = await apiClient.get<ReportEnvelope<LotReportRow[]> | LotReportRow[]>(
    "/reports/stock/lots",
    {
      params: {
        limit: input.limit,
        page: input.page,
        sku: optionalText(input.sku),
        status: input.status,
        warehouseId: input.warehouseId,
      },
    },
  );

  return toReportPage(response.data, input);
}

export function toPerformanceApiRange(dateFrom: string, dateTo: string) {
  const start = new Date(`${dateFrom}T00:00:00`);
  const end = new Date(`${dateTo}T23:59:59.999`);

  return {
    dateFrom: start.toISOString(),
    dateTo: end.toISOString(),
  };
}

export async function getPerformanceReport(input: PerformanceReportQuery) {
  const response = await apiClient.get<
    ReportEnvelope<PerformanceReportRow[]> | PerformanceReportRow[]
  >("/reports/performance", {
    params: {
      ...toPerformanceApiRange(input.dateFrom, input.dateTo),
      sku: optionalText(input.sku),
      warehouseId: input.warehouseId,
    },
  });

  return unwrapApiData(response.data);
}
