import { apiClient } from "@/lib/api-client";

export type StockReportRow = {
  sku: string;
  itemName: string;
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

export type StockReportQuery = {
  sku?: string;
};

export type LotReportQuery = StockReportQuery & {
  status?: LotStatus;
};

export type PerformanceReportQuery = {
  dateFrom: string;
  dateTo: string;
  sku?: string;
};

type ReportEnvelope<T> = {
  data: T;
  meta: Record<string, unknown>;
};

function isReportEnvelope<T>(
  payload: ReportEnvelope<T> | T,
): payload is ReportEnvelope<T> {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "data" in payload &&
    "meta" in payload
  );
}

function unwrapReportData<T>(payload: ReportEnvelope<T> | T) {
  return isReportEnvelope(payload) ? payload.data : payload;
}

function optionalText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export async function getStockReport(input: StockReportQuery) {
  const response = await apiClient.get<
    ReportEnvelope<StockReportRow[]> | StockReportRow[]
  >("/reports/stock", {
    params: {
      sku: optionalText(input.sku),
    },
  });

  return unwrapReportData(response.data);
}

export async function getLotReport(input: LotReportQuery) {
  const response = await apiClient.get<
    ReportEnvelope<LotReportRow[]> | LotReportRow[]
  >("/reports/stock/lots", {
    params: {
      sku: optionalText(input.sku),
      status: input.status,
    },
  });

  return unwrapReportData(response.data);
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
    },
  });

  return unwrapReportData(response.data);
}
