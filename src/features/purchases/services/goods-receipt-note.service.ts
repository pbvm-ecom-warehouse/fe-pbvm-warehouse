import { apiClient } from "@/lib/api-client";
import { normalizeApiList, type ApiListLike } from "@/lib/api-list";
import { type ApiEnvelope, unwrapApiData } from "@/lib/api-contract";

export const GOODS_RECEIPT_NOTE_STATUSES = [
  "DRAFT",
  "CONFIRMED",
  "APPROVED",
] as const;

export type GoodsReceiptNoteStatus =
  (typeof GOODS_RECEIPT_NOTE_STATUSES)[number];

export type GoodsReceiptNoteItem = {
  itemId: string;
  sku: string;
  actualQty: number;
  unit: string;
  lotNumber?: string | null;
  expiryDate?: string | null;
  note?: string | null;
};

export type GoodsReceiptNote = {
  id: string;
  grnNumber: string;
  purchaseOrderId: string;
  warehouseId: string;
  status: GoodsReceiptNoteStatus;
  items: GoodsReceiptNoteItem[];
  createdAt: string;
  updatedAt: string;
};

export type QueryGoodsReceiptNotesInput = {
  purchaseOrderId?: string;
  status?: GoodsReceiptNoteStatus | "ALL";
  page?: number;
  limit?: number;
};

export type CreateGoodsReceiptNoteInput = {
  purchaseOrderId: string;
  items: GoodsReceiptNoteItem[];
};

function optionalText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function normalizeGoodsReceiptNoteListResponse(
  payload: ApiListLike<GoodsReceiptNote>,
) {
  return normalizeApiList(payload);
}

export async function listGoodsReceiptNotes(
  input: QueryGoodsReceiptNotesInput = {},
) {
  const response = await apiClient.get<ApiListLike<GoodsReceiptNote>>(
    "/goods-receipt-notes",
    {
      params: {
        limit: input.limit,
        page: input.page,
        purchaseOrderId: optionalText(input.purchaseOrderId),
        status:
          input.status && input.status !== "ALL" ? input.status : undefined,
      },
    },
  );

  return normalizeGoodsReceiptNoteListResponse(response.data);
}

export async function getGoodsReceiptNote(goodsReceiptNoteId: string) {
  const response = await apiClient.get<
    ApiEnvelope<GoodsReceiptNote> | GoodsReceiptNote
  >(`/goods-receipt-notes/${encodeURIComponent(goodsReceiptNoteId)}`);

  return unwrapApiData(response.data);
}

export async function createGoodsReceiptNote(
  input: CreateGoodsReceiptNoteInput,
) {
  const response = await apiClient.post<
    ApiEnvelope<GoodsReceiptNote> | GoodsReceiptNote
  >("/goods-receipt-notes", input);

  return unwrapApiData(response.data);
}

export async function confirmGoodsReceiptNote(goodsReceiptNoteId: string) {
  const response = await apiClient.post<
    ApiEnvelope<GoodsReceiptNote> | GoodsReceiptNote
  >(`/goods-receipt-notes/${encodeURIComponent(goodsReceiptNoteId)}/confirm`);

  return unwrapApiData(response.data);
}

export async function approveGoodsReceiptNote(goodsReceiptNoteId: string) {
  const response = await apiClient.post<
    ApiEnvelope<GoodsReceiptNote> | GoodsReceiptNote
  >(`/goods-receipt-notes/${encodeURIComponent(goodsReceiptNoteId)}/approve`);

  return unwrapApiData(response.data);
}
