import { apiClient } from "@/lib/api-client";
import { normalizeApiList, type ApiListLike } from "@/lib/api-list";
import { type ApiEnvelope, unwrapApiData } from "@/lib/api-contract";

export const PRINT_JOB_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "PUTAWAY_PENDING",
  "COMPLETED",
  "CANCELLED",
] as const;

export const PRINT_JOB_STAGES = ["SAMPLE", "PRODUCTION"] as const;

export const PRINT_JOB_LINE_STATUSES = [
  "PENDING",
  "CONSUMED",
  "COMPLETED",
] as const;

export type PrintJobStatus = (typeof PRINT_JOB_STATUSES)[number];
export type PrintJobLineStatus = (typeof PRINT_JOB_LINE_STATUSES)[number];
export type PrintJobStage = (typeof PRINT_JOB_STAGES)[number];

export type PrintJobItem = {
  orderItemId: string;
  inputItemId: string;
  outputItemId: string;
  outputBarcode?: string | null;
  sku: string;
  designFile?: string | null;
  quantity: number;
  reservedQty: number;
  remainingQty: number;
  putawayRemainingQty: number;
  lineStatus: PrintJobLineStatus;
};

export type PrintJob = {
  id: string;
  orderId: string;
  printJobNumber?: string | null;
  orderCode?: string | null;
  stage: PrintJobStage;
  status: PrintJobStatus;
  confirmedBy?: string | null;
  items: PrintJobItem[];
  orderDetail?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type QueryPrintJobsInput = {
  status?: PrintJobStatus | "ALL";
  page?: number;
  limit?: number;
};

export type ConsumePrintJobItemInput = {
  itemBarcode: string;
  shelfCode: string;
  quantity: number;
};

export type CompletePrintJobItemInput = {
  shelfCode?: string;
  quantity: number;
  proofImage?: string;
};

export type PutawayPrintJobItemInput = {
  itemBarcode: string;
  cellBarcode: string;
  quantity: number;
  suggestedCellId?: string;
};

export function normalizePrintJobListResponse(payload: ApiListLike<PrintJob>) {
  return normalizeApiList(payload);
}

export async function listPrintJobs(input: QueryPrintJobsInput = {}) {
  const response = await apiClient.get<ApiListLike<PrintJob>>("/print-jobs", {
    params: {
      limit: input.limit,
      page: input.page,
      status: input.status && input.status !== "ALL" ? input.status : undefined,
    },
  });

  return normalizePrintJobListResponse(response.data);
}

export async function getPrintJob(printJobId: string) {
  const response = await apiClient.get<ApiEnvelope<PrintJob> | PrintJob>(
    `/print-jobs/${encodeURIComponent(printJobId)}`,
  );

  return unwrapApiData(response.data);
}

export async function consumePrintJobItem({
  input,
  itemId,
  printJobId,
}: {
  input: ConsumePrintJobItemInput;
  itemId: string;
  printJobId: string;
}) {
  const response = await apiClient.post<ApiEnvelope<PrintJob> | PrintJob>(
    `/print-jobs/${encodeURIComponent(printJobId)}/items/${encodeURIComponent(
      itemId,
    )}/consume`,
    input,
  );

  return unwrapApiData(response.data);
}

export async function completePrintJobItem({
  input,
  itemId,
  printJobId,
}: {
  input: CompletePrintJobItemInput;
  itemId: string;
  printJobId: string;
}) {
  const response = await apiClient.post<ApiEnvelope<PrintJob> | PrintJob>(
    `/print-jobs/${encodeURIComponent(printJobId)}/items/${encodeURIComponent(
      itemId,
    )}/complete`,
    input,
  );

  return unwrapApiData(response.data);
}

export async function putawayPrintJobItem({
  input,
  itemId,
  printJobId,
}: {
  input: PutawayPrintJobItemInput;
  itemId: string;
  printJobId: string;
}) {
  const response = await apiClient.post<ApiEnvelope<PrintJob> | PrintJob>(
    `/print-jobs/${encodeURIComponent(printJobId)}/items/${encodeURIComponent(
      itemId,
    )}/putaway`,
    input,
  );

  return unwrapApiData(response.data);
}
