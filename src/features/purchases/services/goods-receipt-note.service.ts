import { appendEvidenceImages } from "@/components/evidence-images/evidence-image-utils";
import { apiClient } from "@/lib/api-client";
import { normalizeApiList, type ApiListLike } from "@/lib/api-list";
import { type ApiEnvelope, unwrapApiData } from "@/lib/api-contract";

export const GOODS_RECEIPT_NOTE_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "CONFIRMED",
  "APPROVED",
  "REJECTED",
] as const;

export type GoodsReceiptNoteStatus =
  (typeof GOODS_RECEIPT_NOTE_STATUSES)[number];

export type GoodsReceiptNoteItem = {
  itemId: string;
  sku: string;
  itemName?: string;
  barcode?: string;
  category?: string;
  type?: string;
  images?: string[];
  isPerishable?: boolean;
  expectedQty?: number;
  unitPrice?: number;
  receivedQty?: number;
  remainingQty?: number;
  actualQty: number;
  unit: string;
  lotNumber?: string | null;
  expiryDate?: string | null;
  note?: string | null;
  packageCount?: number;
  wholePackageOnly?: boolean;
  packageSpec?: {
    unit: string;
    factor: number;
    depthCm: number;
    widthCm: number;
    heightCm: number;
    volumeCm3: number;
  };
};

export type GoodsReceiptNote = {
  id: string;
  grnNumber: string;
  purchaseOrderId: string;
  purchaseOrderNumber?: string;
  supplierName?: string;
  status: GoodsReceiptNoteStatus;
  items: GoodsReceiptNoteItem[];
  images?: string[];
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  totalPackageCount?: number;
  totalVolumeCm3?: number;
};

export type QueryGoodsReceiptNotesInput = {
  purchaseOrderId?: string;
  status?: GoodsReceiptNoteStatus | "ALL";
  page?: number;
  limit?: number;
};

export type CreateGoodsReceiptNoteItemInput = {
  itemId: string;
  actualQty: number;
  unit?: string;
  lotNumber?: string;
  expiryDate?: string;
  note?: string;
  packageCount?: number;
};

export type CreateGoodsReceiptNoteInput = {
  purchaseOrderId: string;
  purchaseOrderNumber?: string;
  supplierName?: string;
  items?: CreateGoodsReceiptNoteItemInput[];
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
  // BE dùng ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }) — chỉ gửi
  // đúng field CreateGoodsReceiptNoteDto chấp nhận. purchaseOrderNumber/supplierName chỉ
  // dùng hiển thị ở FE. sku KHÔNG được gửi trong từng item — BE tự denormalize từ PO
  // theo itemId, gửi thừa sẽ bị 400.
  const payload = {
    purchaseOrderId: input.purchaseOrderId,
    items: input.items?.map((item) => ({
      itemId: item.itemId,
      actualQty: item.actualQty,
      unit: item.unit,
      lotNumber: item.lotNumber,
      expiryDate: item.expiryDate,
      note: item.note,
      packageCount: item.packageCount,
    })),
  };
  const response = await apiClient.post<
    ApiEnvelope<GoodsReceiptNote> | GoodsReceiptNote
  >("/goods-receipt-notes", payload);

  return unwrapApiData(response.data);
}

export async function updateGoodsReceiptNoteItems(
  goodsReceiptNoteId: string,
  items: CreateGoodsReceiptNoteItemInput[],
) {
  const response = await apiClient.patch<
    ApiEnvelope<GoodsReceiptNote> | GoodsReceiptNote
  >(`/goods-receipt-notes/${encodeURIComponent(goodsReceiptNoteId)}/items`, {
    items: items.map((item) => ({
      itemId: item.itemId,
      actualQty: item.actualQty,
      unit: item.unit,
      lotNumber: item.lotNumber,
      expiryDate: item.expiryDate,
      note: item.note,
      packageCount: item.packageCount,
    })),
  });

  return unwrapApiData(response.data);
}

export async function uploadGoodsReceiptNoteImage(
  goodsReceiptNoteId: string,
  file: File,
) {
  const formData = new FormData();
  appendEvidenceImages(formData, [file], "file");
  const response = await apiClient.post<
    ApiEnvelope<GoodsReceiptNote> | GoodsReceiptNote
  >(
    `/goods-receipt-notes/${encodeURIComponent(goodsReceiptNoteId)}/images`,
    formData,
  );

  return unwrapApiData(response.data);
}
export async function submitGoodsReceiptNote(goodsReceiptNoteId: string) {
  const response = await apiClient.post<
    ApiEnvelope<GoodsReceiptNote> | GoodsReceiptNote
  >(`/goods-receipt-notes/${encodeURIComponent(goodsReceiptNoteId)}/submit`);

  return unwrapApiData(response.data);
}

export async function approveGoodsReceiptNote(goodsReceiptNoteId: string) {
  const response = await apiClient.post<
    ApiEnvelope<GoodsReceiptNote> | GoodsReceiptNote
  >(`/goods-receipt-notes/${encodeURIComponent(goodsReceiptNoteId)}/approve`);

  return unwrapApiData(response.data);
}

export const confirmGoodsReceiptNote = submitGoodsReceiptNote;

export async function rejectGoodsReceiptNote(
  goodsReceiptNoteId: string,
  reason: string,
) {
  const response = await apiClient.post<
    ApiEnvelope<GoodsReceiptNote> | GoodsReceiptNote
  >(`/goods-receipt-notes/${encodeURIComponent(goodsReceiptNoteId)}/reject`, {
    reason,
  });

  return unwrapApiData(response.data);
}
