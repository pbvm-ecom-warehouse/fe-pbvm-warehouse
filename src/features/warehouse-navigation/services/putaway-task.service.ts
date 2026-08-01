import { apiClient } from "@/lib/api-client";
import { normalizeApiList, type ApiListLike } from "@/lib/api-list";
import { type ApiEnvelope, unwrapApiData } from "@/lib/api-contract";

export const PUTAWAY_TASK_STATUSES = ["PENDING", "COMPLETED"] as const;

export type PutawayTaskStatus = (typeof PUTAWAY_TASK_STATUSES)[number];
export type PutawayTaskSourceType = "GOODS_RECEIPT" | "GOODS_RETURN";

export type PutawayTaskItem = {
  itemId: string;
  sku: string;
  quantity: number;
  remainingQty?: number;
  unit?: string;
  lotId?: string | null;
  lotNumber?: string | null;
  packageSpec?: {
    unit: string;
    factor: number;
    depthCm: number;
    widthCm: number;
    heightCm: number;
    volumeCm3: number;
  };
};

export type PutawayTask = {
  id: string;
  /** ID chứng từ nguồn; tên grnId được BE giữ để tương thích dữ liệu cũ. */
  grnId: string;
  grnNumber?: string;
  sourceType?: PutawayTaskSourceType;
  sourceNumber?: string;
  status: PutawayTaskStatus;
  items: PutawayTaskItem[];
  createdAt?: string;
  updatedAt?: string;
};

export type QueryPutawayTasksInput = {
  status?: PutawayTaskStatus | "ALL";
  page?: number;
  limit?: number;
};

export type ConfirmPutawayLineInput = {
  itemBarcode: string;
  shelfCode?: string;
  cellBarcode?: string;
  quantity?: number;
  suggestedCellId?: string;
  lotId?: string;
};

export function normalizePutawayTaskListResponse(
  payload: ApiListLike<PutawayTask>,
) {
  return normalizeApiList(payload);
}

export async function listPutawayTasks(input: QueryPutawayTasksInput = {}) {
  const response = await apiClient.get<ApiListLike<PutawayTask>>(
    "/putaway-tasks",
    {
      params: {
        limit: input.limit,
        page: input.page,
        status:
          input.status && input.status !== "ALL" ? input.status : undefined,
      },
    },
  );

  return normalizePutawayTaskListResponse(response.data);
}

export async function confirmPutawayLine(
  taskId: string,
  input: ConfirmPutawayLineInput,
) {
  const response = await apiClient.post<ApiEnvelope<PutawayTask> | PutawayTask>(
    `/putaway-tasks/${encodeURIComponent(taskId)}/confirm-line`,
    input,
  );

  return unwrapApiData(response.data);
}
