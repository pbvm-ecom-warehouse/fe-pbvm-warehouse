import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api-client";
import {
  createWarehouseItem,
  deleteWarehouseItem,
  listWarehouseItems,
  normalizeWarehouseItemListResponse,
  updateWarehouseItem,
} from "@/features/products/services/warehouse-items.service";
import {
  approveGoodsReceiptNote,
  confirmGoodsReceiptNote,
  createGoodsReceiptNote,
  listGoodsReceiptNotes,
  normalizeGoodsReceiptNoteListResponse,
} from "@/features/purchases/services/goods-receipt-note.service";
import {
  confirmPutawayLine,
  listPutawayTasks,
  normalizePutawayTaskListResponse,
} from "@/features/warehouse-navigation/services/putaway-task.service";
import {
  confirmGoodsIssueLine,
  listGoodsIssuePickSuggestions,
  listGoodsIssues,
  normalizeGoodsIssueListResponse,
} from "@/features/goods-issues/services/goods-issue.service";
import {
  cancelGoodsReturn,
  confirmGoodsReturn,
  createGoodsReturn,
  inspectGoodsReturn,
  listGoodsReturns,
  normalizeGoodsReturnListResponse,
} from "@/features/goods-returns/services/goods-return.service";
import {
  completePrintJobItem,
  consumePrintJobItem,
  listPrintJobs,
  normalizePrintJobListResponse,
} from "@/features/print-jobs/services/print-job.service";
import {
  approveStockCount,
  countStockCountItem,
  createStockCount,
  listStockCounts,
  normalizeStockCountListResponse,
} from "@/features/adjustments/services/stock-count.service";
import {
  approveScrapNote,
  createScrapNote,
  listScrapNotes,
  normalizeScrapNoteListResponse,
  rejectScrapNote,
} from "@/features/adjustments/services/scrap-note.service";

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    delete: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
  },
}));

const mockedDelete = vi.mocked(apiClient.delete);
const mockedGet = vi.mocked(apiClient.get);
const mockedPatch = vi.mocked(apiClient.patch);
const mockedPost = vi.mocked(apiClient.post);

const warehouseItem = {
  altBarcodes: [],
  altUnits: [],
  attributes: [],
  createdAt: "2026-07-01T00:00:00.000Z",
  id: "item-1",
  isActive: true,
  isPerishable: false,
  name: "Ly trắng 500ml",
  sku: "CUP-BLANK-500",
  type: "CUP_BLANK" as const,
  unit: "cái",
  updatedAt: "2026-07-01T00:00:00.000Z",
};

const grn = {
  createdAt: "2026-07-02T00:00:00.000Z",
  grnNumber: "GRN-0001",
  id: "grn-1",
  items: [
    {
      actualQty: 10,
      itemId: "item-1",
      sku: "CUP-BLANK-500",
      unit: "cái",
    },
  ],
  purchaseOrderId: "po-1",
  status: "DRAFT" as const,
  updatedAt: "2026-07-02T00:00:00.000Z",
  warehouseId: "wh-1",
};

const putawayTask = {
  grnId: "grn-1",
  id: "task-1",
  items: [
    {
      itemId: "item-1",
      quantity: 10,
      remainingQty: 10,
      sku: "CUP-BLANK-500",
    },
  ],
  status: "PENDING" as const,
  warehouseId: "wh-1",
};

const goodsIssue = {
  id: "gi-1",
  items: [
    {
      itemId: "item-1",
      quantity: 10,
      remainingQty: 10,
      sku: "CUP-BLANK-500",
    },
  ],
  orderId: "order-1",
  status: "PENDING" as const,
  warehouseId: "wh-1",
};

const goodsReturn = {
  createdAt: "2026-07-07T00:00:00.000Z",
  createdBy: "receiver-1",
  id: "return-1",
  items: [
    {
      condition: null,
      itemId: "item-1",
      lotId: null,
      quantity: 2,
      scrapNoteId: null,
      shelfId: null,
      sku: "CUP-BLANK-500",
    },
  ],
  orderId: "order-1",
  status: "DRAFT" as const,
  updatedAt: "2026-07-07T00:00:00.000Z",
  warehouseId: null,
};

const printJob = {
  createdAt: "2026-07-04T00:00:00.000Z",
  id: "pj-1",
  items: [
    {
      inputItemId: "blank-1",
      lineStatus: "PENDING" as const,
      outputItemId: "printed-1",
      quantity: 10,
      remainingQty: 10,
      reservedQty: 10,
      sku: "CUP-BLANK-500",
    },
  ],
  orderId: "order-1",
  status: "PENDING" as const,
  updatedAt: "2026-07-04T00:00:00.000Z",
  warehouseId: "wh-1",
};

const stockCount = {
  createdAt: "2026-07-05T00:00:00.000Z",
  createdBy: "counter-1",
  id: "sc-1",
  items: [
    {
      actualQty: null,
      itemId: "item-1",
      shelfId: "shelf-1",
      sku: "CUP-BLANK-500",
      systemQty: 12,
    },
  ],
  status: "DRAFT" as const,
  updatedAt: "2026-07-05T00:00:00.000Z",
  warehouseId: "wh-1",
  zoneId: null,
};

const scrapNote = {
  createdAt: "2026-07-06T00:00:00.000Z",
  createdBy: "counter-1",
  id: "scrap-1",
  items: [
    {
      itemId: "item-1",
      quantity: 2,
      reason: "Vỡ khi kiểm hàng",
      shelfId: "shelf-1",
      sku: "CUP-BLANK-500",
    },
  ],
  status: "DRAFT" as const,
  updatedAt: "2026-07-06T00:00:00.000Z",
  warehouseId: "wh-1",
};

describe("Swagger-backed WMS services", () => {
  beforeEach(() => {
    mockedDelete.mockReset();
    mockedGet.mockReset();
    mockedPatch.mockReset();
    mockedPost.mockReset();
  });

  it("normalizes list envelopes for connected WMS resources", () => {
    expect(
      normalizeWarehouseItemListResponse({
        data: [warehouseItem],
        meta: { pagination: { page: 2, pageSize: 20, total: 21 } },
      }),
    ).toEqual({
      data: [warehouseItem],
      limit: 20,
      page: 2,
      total: 21,
    });
    expect(
      normalizeGoodsReceiptNoteListResponse({
        data: { data: [grn], limit: 10, page: 1, total: 1 },
        meta: { requestId: "req-1" },
      }),
    ).toMatchObject({ data: [grn], total: 1 });
    expect(normalizePutawayTaskListResponse([putawayTask])).toMatchObject({
      data: [putawayTask],
      total: 1,
    });
    expect(normalizeGoodsIssueListResponse([goodsIssue])).toMatchObject({
      data: [goodsIssue],
      total: 1,
    });
    expect(normalizeGoodsReturnListResponse([goodsReturn])).toMatchObject({
      data: [goodsReturn],
      total: 1,
    });
    expect(normalizePrintJobListResponse([printJob])).toMatchObject({
      data: [printJob],
      total: 1,
    });
    expect(normalizeStockCountListResponse([stockCount])).toMatchObject({
      data: [stockCount],
      total: 1,
    });
    expect(normalizeScrapNoteListResponse([scrapNote])).toMatchObject({
      data: [scrapNote],
      total: 1,
    });
  });

  it("calls stock/items with list, create, update and delete shapes", async () => {
    mockedGet.mockResolvedValueOnce({ data: [warehouseItem] });
    mockedPost.mockResolvedValueOnce({ data: warehouseItem });
    mockedPatch.mockResolvedValueOnce({ data: warehouseItem });
    mockedDelete.mockResolvedValueOnce({ data: {} });

    await listWarehouseItems({
      isActive: true,
      limit: 20,
      page: 1,
      search: "CUP",
      type: "CUP_BLANK",
    });
    await createWarehouseItem({
      name: "Ly trắng 500ml",
      sku: "CUP-BLANK-500",
      type: "CUP_BLANK",
      unit: "cái",
    });
    await updateWarehouseItem("item-1", { isActive: false });
    await deleteWarehouseItem("item-1");

    expect(mockedGet).toHaveBeenCalledWith("/stock/items", {
      params: {
        isActive: true,
        limit: 20,
        page: 1,
        search: "CUP",
        type: "CUP_BLANK",
      },
    });
    expect(mockedPost).toHaveBeenCalledWith("/stock/items", {
      name: "Ly trắng 500ml",
      sku: "CUP-BLANK-500",
      type: "CUP_BLANK",
      unit: "cái",
    });
    expect(mockedPatch).toHaveBeenCalledWith("/stock/items/item-1", {
      isActive: false,
    });
    expect(mockedDelete).toHaveBeenCalledWith("/stock/items/item-1");
  });

  it("calls goods receipt note endpoints from Swagger", async () => {
    mockedGet.mockResolvedValueOnce({ data: [grn] });
    mockedPost.mockResolvedValue({ data: grn });

    await listGoodsReceiptNotes({
      limit: 20,
      page: 1,
      purchaseOrderId: "po-1",
      status: "DRAFT",
    });
    await createGoodsReceiptNote({
      items: grn.items,
      purchaseOrderId: "po-1",
    });
    await confirmGoodsReceiptNote("grn-1");
    await approveGoodsReceiptNote("grn-1");

    expect(mockedGet).toHaveBeenCalledWith("/goods-receipt-notes", {
      params: {
        limit: 20,
        page: 1,
        purchaseOrderId: "po-1",
        status: "DRAFT",
      },
    });
    expect(mockedPost).toHaveBeenCalledWith("/goods-receipt-notes", {
      items: grn.items,
      purchaseOrderId: "po-1",
    });
    expect(mockedPost).toHaveBeenCalledWith(
      "/goods-receipt-notes/grn-1/confirm",
    );
    expect(mockedPost).toHaveBeenCalledWith(
      "/goods-receipt-notes/grn-1/approve",
    );
  });

  it("calls put-away task endpoints from Swagger", async () => {
    mockedGet.mockResolvedValueOnce({ data: [putawayTask] });
    mockedPost.mockResolvedValueOnce({ data: putawayTask });

    await listPutawayTasks({
      limit: 20,
      page: 1,
      status: "PENDING",
      warehouseId: "wh-1",
    });
    await confirmPutawayLine("task-1", {
      itemBarcode: "CUP-BLANK-500",
      quantity: 10,
      shelfCode: "A1-S02",
    });

    expect(mockedGet).toHaveBeenCalledWith("/putaway-tasks", {
      params: {
        limit: 20,
        page: 1,
        status: "PENDING",
        warehouseId: "wh-1",
      },
    });
    expect(mockedPost).toHaveBeenCalledWith(
      "/putaway-tasks/task-1/confirm-line",
      {
        itemBarcode: "CUP-BLANK-500",
        quantity: 10,
        shelfCode: "A1-S02",
      },
    );
  });

  it("calls goods issue endpoints from Swagger", async () => {
    mockedGet.mockResolvedValueOnce({ data: [goodsIssue] });
    mockedGet.mockResolvedValueOnce({
      data: [{ quantity: 10, shelfCode: "A1-S02", shelfId: "shelf-1" }],
    });
    mockedPost.mockResolvedValueOnce({ data: goodsIssue });

    await listGoodsIssues({
      limit: 20,
      page: 1,
      status: "PENDING",
      warehouseId: "wh-1",
    });
    await listGoodsIssuePickSuggestions({
      goodsIssueId: "gi-1",
      itemId: "item-1",
    });
    await confirmGoodsIssueLine("gi-1", {
      itemBarcode: "CUP-BLANK-500",
      quantity: 10,
      shelfCode: "A1-S02",
    });

    expect(mockedGet).toHaveBeenCalledWith("/goods-issues", {
      params: {
        limit: 20,
        page: 1,
        status: "PENDING",
        warehouseId: "wh-1",
      },
    });
    expect(mockedGet).toHaveBeenCalledWith(
      "/goods-issues/gi-1/items/item-1/suggestions",
    );
    expect(mockedPost).toHaveBeenCalledWith("/goods-issues/gi-1/confirm-line", {
      itemBarcode: "CUP-BLANK-500",
      quantity: 10,
      shelfCode: "A1-S02",
    });
  });

  it("calls goods return endpoints from Swagger", async () => {
    mockedGet.mockResolvedValueOnce({ data: [goodsReturn] });
    mockedPost.mockResolvedValue({ data: goodsReturn });

    await listGoodsReturns({
      limit: 20,
      orderId: "order-1",
      page: 1,
      status: "DRAFT",
      warehouseId: "wh-1",
    });
    await createGoodsReturn({
      items: [{ itemId: "item-1", quantity: 2 }],
      note: "Khách trả tại kho",
      orderId: "order-1",
    });
    await inspectGoodsReturn("return-1", {
      items: [
        {
          condition: "GOOD",
          itemId: "item-1",
          shelfId: "shelf-1",
        },
      ],
      warehouseId: "wh-1",
    });
    await confirmGoodsReturn("return-1");
    await cancelGoodsReturn("return-1");

    expect(mockedGet).toHaveBeenCalledWith("/goods-returns", {
      params: {
        limit: 20,
        orderId: "order-1",
        page: 1,
        status: "DRAFT",
        warehouseId: "wh-1",
      },
    });
    expect(mockedPost).toHaveBeenCalledWith("/goods-returns", {
      items: [{ itemId: "item-1", quantity: 2 }],
      note: "Khách trả tại kho",
      orderId: "order-1",
    });
    expect(mockedPost).toHaveBeenCalledWith("/goods-returns/return-1/inspect", {
      items: [
        {
          condition: "GOOD",
          itemId: "item-1",
          shelfId: "shelf-1",
        },
      ],
      warehouseId: "wh-1",
    });
    expect(mockedPost).toHaveBeenCalledWith("/goods-returns/return-1/confirm");
    expect(mockedPost).toHaveBeenCalledWith("/goods-returns/return-1/cancel");
  });

  it("calls print job endpoints from Swagger", async () => {
    mockedGet.mockResolvedValueOnce({ data: [printJob] });
    mockedPost.mockResolvedValue({ data: printJob });

    await listPrintJobs({
      limit: 20,
      page: 1,
      status: "PENDING",
    });
    await consumePrintJobItem({
      input: {
        itemBarcode: "CUP-BLANK-500",
        quantity: 10,
        shelfCode: "A1-S02",
      },
      itemId: "blank-1",
      printJobId: "pj-1",
    });
    await completePrintJobItem({
      input: {
        quantity: 10,
        shelfCode: "A1-S03",
      },
      itemId: "blank-1",
      printJobId: "pj-1",
    });

    expect(mockedGet).toHaveBeenCalledWith("/print-jobs", {
      params: {
        limit: 20,
        page: 1,
        status: "PENDING",
      },
    });
    expect(mockedPost).toHaveBeenCalledWith(
      "/print-jobs/pj-1/items/blank-1/consume",
      {
        itemBarcode: "CUP-BLANK-500",
        quantity: 10,
        shelfCode: "A1-S02",
      },
    );
    expect(mockedPost).toHaveBeenCalledWith(
      "/print-jobs/pj-1/items/blank-1/complete",
      {
        quantity: 10,
        shelfCode: "A1-S03",
      },
    );
  });

  it("calls stock-count endpoints from Swagger", async () => {
    mockedGet.mockResolvedValueOnce({ data: [stockCount] });
    mockedPost.mockResolvedValue({ data: stockCount });

    await listStockCounts({
      limit: 20,
      page: 1,
      status: "DRAFT",
      warehouseId: "wh-1",
    });
    await createStockCount({
      note: "Kiểm định kỳ",
      warehouseId: "wh-1",
      zoneId: "zone-1",
    });
    await countStockCountItem({
      input: {
        actualQty: 10,
        reason: "Lệch do vỡ",
        shelfId: "shelf-1",
      },
      itemId: "item-1",
      stockCountId: "sc-1",
    });
    await approveStockCount("sc-1", { reason: "Duyệt kiểm kê" });

    expect(mockedGet).toHaveBeenCalledWith("/stock-counts", {
      params: {
        limit: 20,
        page: 1,
        status: "DRAFT",
        warehouseId: "wh-1",
      },
    });
    expect(mockedPost).toHaveBeenCalledWith("/stock-counts", {
      note: "Kiểm định kỳ",
      warehouseId: "wh-1",
      zoneId: "zone-1",
    });
    expect(mockedPost).toHaveBeenCalledWith(
      "/stock-counts/sc-1/items/item-1/count",
      {
        actualQty: 10,
        reason: "Lệch do vỡ",
        shelfId: "shelf-1",
      },
    );
    expect(mockedPost).toHaveBeenCalledWith("/stock-counts/sc-1/approve", {
      reason: "Duyệt kiểm kê",
    });
  });

  it("calls scrap-note endpoints from Swagger", async () => {
    mockedGet.mockResolvedValueOnce({ data: [scrapNote] });
    mockedPost.mockResolvedValue({ data: scrapNote });

    await listScrapNotes({
      limit: 20,
      page: 1,
      status: "DRAFT",
      warehouseId: "wh-1",
    });
    await createScrapNote({
      items: [
        {
          itemId: "item-1",
          quantity: 2,
          reason: "Vỡ khi kiểm hàng",
          shelfId: "shelf-1",
        },
      ],
      note: "Hàng vỡ",
      warehouseId: "wh-1",
    });
    await approveScrapNote("scrap-1");
    await rejectScrapNote("scrap-1", {
      rejectReason: "Cần kiểm lại số lượng",
    });

    expect(mockedGet).toHaveBeenCalledWith("/scrap-notes", {
      params: {
        limit: 20,
        page: 1,
        status: "DRAFT",
        warehouseId: "wh-1",
      },
    });
    expect(mockedPost).toHaveBeenCalledWith("/scrap-notes", {
      items: [
        {
          itemId: "item-1",
          quantity: 2,
          reason: "Vỡ khi kiểm hàng",
          shelfId: "shelf-1",
        },
      ],
      note: "Hàng vỡ",
      warehouseId: "wh-1",
    });
    expect(mockedPost).toHaveBeenCalledWith("/scrap-notes/scrap-1/approve");
    expect(mockedPost).toHaveBeenCalledWith("/scrap-notes/scrap-1/reject", {
      rejectReason: "Cần kiểm lại số lượng",
    });
  });
});
