import { appendEvidenceImages } from "@/components/evidence-images/evidence-image-utils";
import { apiClient } from "@/lib/api-client";
import { normalizeApiList, type ApiListLike } from "@/lib/api-list";
import { type ApiEnvelope, unwrapApiData } from "@/lib/api-contract";

export const SCRAP_NOTE_STATUSES = [
  "DRAFT",
  "APPROVED",
  "QUARANTINED",
  "DISPOSED",
  "REJECTED",
] as const;

export type ScrapNoteStatus = (typeof SCRAP_NOTE_STATUSES)[number];

export type ScrapNoteItem = {
  itemId: string;
  sku: string;
  shelfId: string;
  sourceCellId: string | null;
  lockedQuantity: number;
  scrapCellId: string | null;
  lotId?: string | null;
  quantity: number;
  reason: string;
  images: string[];
};

export type ScrapNote = {
  id: string;
  scrapNoteNumber?: string | null;
  sourceStockCountId?: string | null;
  status: ScrapNoteStatus;
  note?: string;
  createdBy: string;
  approvedBy?: string | null;
  rejectReason?: string;
  items: ScrapNoteItem[];
  createdAt: string;
  updatedAt: string;
};

export type QueryScrapNotesInput = {
  status?: ScrapNoteStatus | "ALL";
  page?: number;
  limit?: number;
};

export type RejectScrapNoteInput = {
  rejectReason: string;
};

export type CreateStockCountScrapInput = {
  itemBarcode: string;
  shelfId: string;
  cellId: string;
  lotId?: string;
  quantity: number;
  reason: string;
  images?: File[];
};

export type MoveScrapItemInput = {
  itemBarcode: string;
  sourceCellBarcode: string;
  targetCellBarcode: string;
};

export function normalizeScrapNoteListResponse(
  payload: ApiListLike<ScrapNote>,
) {
  return normalizeApiList(payload);
}

export async function listScrapNotes(input: QueryScrapNotesInput = {}) {
  const response = await apiClient.get<ApiListLike<ScrapNote>>("/scrap-notes", {
    params: {
      limit: input.limit,
      page: input.page,
      status: input.status && input.status !== "ALL" ? input.status : undefined,
    },
  });

  return normalizeScrapNoteListResponse(response.data);
}

export async function getScrapNote(scrapNoteId: string) {
  const response = await apiClient.get<ApiEnvelope<ScrapNote> | ScrapNote>(
    `/scrap-notes/${encodeURIComponent(scrapNoteId)}`,
  );

  return unwrapApiData(response.data);
}

export async function createStockCountScrap({
  input,
  itemId,
  stockCountId,
}: {
  input: CreateStockCountScrapInput;
  itemId: string;
  stockCountId: string;
}) {
  const formData = new FormData();
  formData.append("itemBarcode", input.itemBarcode);
  formData.append("shelfId", input.shelfId);
  formData.append("cellId", input.cellId);
  if (input.lotId) formData.append("lotId", input.lotId);
  formData.append("quantity", String(input.quantity));
  formData.append("reason", input.reason);
  appendEvidenceImages(formData, input.images);

  const response = await apiClient.post<ApiEnvelope<ScrapNote> | ScrapNote>(
    `/stock-counts/${encodeURIComponent(stockCountId)}/items/${encodeURIComponent(itemId)}/scrap`,
    formData,
  );

  return unwrapApiData(response.data);
}

export async function approveScrapNote(scrapNoteId: string) {
  const response = await apiClient.post<ApiEnvelope<ScrapNote> | ScrapNote>(
    `/scrap-notes/${encodeURIComponent(scrapNoteId)}/approve`,
  );

  return unwrapApiData(response.data);
}

export async function rejectScrapNote(
  scrapNoteId: string,
  input: RejectScrapNoteInput,
) {
  const response = await apiClient.post<ApiEnvelope<ScrapNote> | ScrapNote>(
    `/scrap-notes/${encodeURIComponent(scrapNoteId)}/reject`,
    input,
  );

  return unwrapApiData(response.data);
}

export async function moveScrapItemToScrap(
  scrapNoteId: string,
  itemId: string,
  input: MoveScrapItemInput,
) {
  const response = await apiClient.post<ApiEnvelope<ScrapNote> | ScrapNote>(
    `/scrap-notes/${encodeURIComponent(scrapNoteId)}/items/${encodeURIComponent(itemId)}/move-to-scrap`,
    input,
  );

  return unwrapApiData(response.data);
}

export async function disposeScrapNote(scrapNoteId: string) {
  const response = await apiClient.post<ApiEnvelope<ScrapNote> | ScrapNote>(
    `/scrap-notes/${encodeURIComponent(scrapNoteId)}/dispose`,
  );

  return unwrapApiData(response.data);
}
