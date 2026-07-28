import { appendEvidenceImages } from "@/components/evidence-images/evidence-image-utils";
import { apiClient } from "@/lib/api-client";
import { normalizeApiList, type ApiListLike } from "@/lib/api-list";
import { type ApiEnvelope, unwrapApiData } from "@/lib/api-contract";

export const GOODS_RECEIPT_NOTE_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
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
  /** Số thùng thực nhận — luôn là số nguyên, luôn theo đơn vị cơ sở (thùng). */
  actualQty: number;
  lotNumber?: string | null;
  manufacturedDate?: string | null;
  expiryDate?: string | null;
  note?: string | null;
  wholePackageOnly?: boolean;
  /** Kích thước 1 thùng — đọc live từ WarehouseItem. */
  itemDepth?: number;
  itemWidth?: number;
  itemHeight?: number;
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
  lotNumber?: string;
  manufacturedDate: string;
  expiryDate?: string;
  note?: string;
};

export type CreateGoodsReceiptNoteInput = {
  images: File[];
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
  const items = input.items?.map((item) => ({
    itemId: item.itemId,
    actualQty: item.actualQty,
    lotNumber: item.lotNumber,
    manufacturedDate: item.manufacturedDate,
    expiryDate: item.expiryDate,
    note: item.note,
  }));
  const formData = new FormData();
  formData.append("purchaseOrderId", input.purchaseOrderId);
  if (items) {
    formData.append("items", JSON.stringify(items));
  }
  appendEvidenceImages(formData, input.images, "images");

  const response = await apiClient.post<
    ApiEnvelope<GoodsReceiptNote> | GoodsReceiptNote
  >("/goods-receipt-notes", formData);

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
      lotNumber: item.lotNumber,
      manufacturedDate: item.manufacturedDate,
      expiryDate: item.expiryDate,
      note: item.note,
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
