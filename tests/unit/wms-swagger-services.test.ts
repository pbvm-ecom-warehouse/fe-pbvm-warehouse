import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api-client";
import {
  createAttributeOption,
  createWarehouseItem,
  deleteWarehouseItem,
  getSkuTemplate,
  listAttributeOptions,
  listWarehouseItems,
  normalizeWarehouseItemListResponse,
  previewWarehouseItemSku,
  suggestAttributeOptionCode,
  updateAttributeOption,
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
import {
  assignShipmentCarrier,
  createCarrier,
  getCarrier,
  getShipment,
  listCarriers,
  listShipments,
  normalizeCarrierListResponse,
  normalizeShipmentListResponse,
  updateCarrier,
  updateShipmentStatus,
} from "@/features/shipping/services/shipping.service";

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
};

const goodsReturn = {
  createdAt: "2026-07-07T00:00:00.000Z",
  createdBy: "receiver-1",
  id: "return-1",
  items: [
    {
      condition: null,
      images: [],
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
};

const stockCount = {
  createdAt: "2026-07-05T00:00:00.000Z",
  createdBy: "counter-1",
  id: "sc-1",
  items: [
    {
      actualQty: null,
      images: [],
      itemId: "item-1",
      shelfId: "shelf-1",
      sku: "CUP-BLANK-500",
      systemQty: 12,
    },
  ],
  status: "DRAFT" as const,
  updatedAt: "2026-07-05T00:00:00.000Z",
  zoneId: null,
};

const scrapNote = {
  createdAt: "2026-07-06T00:00:00.000Z",
  createdBy: "counter-1",
  id: "scrap-1",
  items: [
    {
      images: [],
      itemId: "item-1",
      quantity: 2,
      reason: "Vỡ khi kiểm hàng",
      shelfId: "shelf-1",
      sku: "CUP-BLANK-500",
    },
  ],
  status: "DRAFT" as const,
  updatedAt: "2026-07-06T00:00:00.000Z",
};

const carrier = {
  code: "GHN",
  contactInfo: { phone: "1900636677" },
  createdAt: "2026-07-21T00:00:00.000Z",
  id: "carrier-1",
  name: "Giao Hàng Nhanh",
  note: "Ưu tiên nội thành",
  status: "ACTIVE" as const,
  updatedAt: "2026-07-21T00:00:00.000Z",
};

const shipment = {
  attempts: 0,
  carrierId: "carrier-1",
  codAmount: 320000,
  createdAt: "2026-07-21T00:00:00.000Z",
  goodsIssueId: "issue-1",
  id: "shipment-1",
  orderId: "order-1",
  paymentMethod: "COD" as const,
  recipient: {
    address: { line: "12 Nguyễn Văn Linh", province: "Hồ Chí Minh" },
    name: "Nguyễn An",
    phone: "0901000000",
  },
  shipmentStatus: "PENDING" as const,
  statusHistory: [],
  trackingNumber: "GHN-0001",
  updatedAt: "2026-07-21T00:00:00.000Z",
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
      attributeOptionIds: ["66a100000000000000000001"],
      images: [new File(["image"], "item.png", { type: "image/png" })],
      name: "Ly trắng 500ml",
      templateId: "CUP_BLANK",
      type: "CUP_BLANK",
      unit: "cái",
    });
    await updateWarehouseItem("item-1", { name: "Ly trắng 500ml mới" });
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
    const createBody = mockedPost.mock.calls.find(
      ([url]) => url === "/stock/items",
    )?.[1] as FormData;
    expect(createBody).toBeInstanceOf(FormData);
    expect(createBody.get("type")).toBe("CUP_BLANK");
    expect(createBody.get("templateId")).toBe("CUP_BLANK");
    expect(JSON.parse(String(createBody.get("attributeOptionIds")))).toEqual([
      "66a100000000000000000001",
    ]);
    expect(createBody.get("name")).toBe("Ly trắng 500ml");
    expect(createBody.get("unit")).toBe("cái");
    expect(createBody.getAll("images")).toHaveLength(1);
    expect(mockedPost).toHaveBeenCalledWith(
      "/stock/items",
      expect.any(FormData),
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    expect(mockedPatch).toHaveBeenCalledWith("/stock/items/item-1", {
      name: "Ly trắng 500ml mới",
    });
    expect(mockedDelete).toHaveBeenCalledWith("/stock/items/item-1");
  });

  it("calls template, preview and attribute-option endpoints", async () => {
    const option = {
      code: "HRT",
      id: "66a100000000000000000001",
      isActive: true,
      key: "CUP_STYLE" as const,
      name: "Ly nắp tim",
      sortOrder: 1,
    };
    const template = {
      fields: [{ key: "CUP_STYLE" as const, required: true }],
      itemType: "CUP_BLANK" as const,
      kind: "template" as const,
      prefix: "CUP",
      templateId: "CUP_BLANK",
    };

    mockedGet
      .mockResolvedValueOnce({ data: { data: template, meta: {} } })
      .mockResolvedValueOnce({ data: { data: [option], meta: {} } });
    mockedPost
      .mockResolvedValueOnce({
        data: { data: { sku: "CUP-HRT" }, meta: {} },
      })
      .mockResolvedValueOnce({ data: { data: { code: "HRT" }, meta: {} } })
      .mockResolvedValueOnce({ data: { data: option, meta: {} } });
    mockedPatch.mockResolvedValueOnce({
      data: { data: { ...option, isActive: false }, meta: {} },
    });

    await expect(getSkuTemplate("CUP_BLANK")).resolves.toEqual(template);
    await expect(listAttributeOptions("CUP_STYLE", true)).resolves.toEqual([
      option,
    ]);
    await expect(
      previewWarehouseItemSku({
        attributeOptionIds: [option.id],
        templateId: "CUP_BLANK",
        type: "CUP_BLANK",
      }),
    ).resolves.toEqual({ sku: "CUP-HRT" });
    await suggestAttributeOptionCode({ key: "CUP_STYLE", name: option.name });
    await createAttributeOption({
      code: option.code,
      key: option.key,
      name: option.name,
    });
    await updateAttributeOption(option.id, { isActive: false });

    expect(mockedGet).toHaveBeenNthCalledWith(
      1,
      "/stock/item-types/CUP_BLANK/sku-template",
    );
    expect(mockedGet).toHaveBeenNthCalledWith(2, "/stock/attribute-options", {
      params: { includeInactive: true, key: "CUP_STYLE" },
    });
    expect(mockedPost).toHaveBeenNthCalledWith(1, "/stock/items/sku-preview", {
      attributeOptionIds: [option.id],
      templateId: "CUP_BLANK",
      type: "CUP_BLANK",
    });
    expect(mockedPost).toHaveBeenNthCalledWith(
      2,
      "/stock/attribute-options/code-suggestion",
      { key: "CUP_STYLE", name: option.name },
    );
    expect(mockedPost).toHaveBeenNthCalledWith(3, "/stock/attribute-options", {
      code: option.code,
      key: option.key,
      name: option.name,
    });
    expect(mockedPatch).toHaveBeenCalledWith(
      `/stock/attribute-options/${option.id}`,
      { isActive: false },
    );
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
    });
    await confirmGoodsReturn("return-1");
    await cancelGoodsReturn("return-1");

    expect(mockedGet).toHaveBeenCalledWith("/goods-returns", {
      params: {
        limit: 20,
        orderId: "order-1",
        page: 1,
        status: "DRAFT",
      },
    });
    expect(mockedPost).toHaveBeenCalledWith("/goods-returns", {
      items: [{ itemId: "item-1", quantity: 2 }],
      note: "Khách trả tại kho",
      orderId: "order-1",
    });
    const inspectBody = mockedPost.mock.calls.find(
      ([url]) => url === "/goods-returns/return-1/inspect",
    )?.[1] as FormData;
    expect(inspectBody.get("warehouseId")).toBeNull();
    expect(JSON.parse(String(inspectBody.get("items")))).toEqual([
      {
        condition: "GOOD",
        itemId: "item-1",
        shelfId: "shelf-1",
      },
    ]);
    expect(mockedPost).toHaveBeenCalledWith(
      "/goods-returns/return-1/inspect",
      expect.any(FormData),
      { headers: { "Content-Type": "multipart/form-data" } },
    );
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
    });
    await createStockCount({
      note: "Kiểm định kỳ",
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
      },
    });
    expect(mockedPost).toHaveBeenCalledWith("/stock-counts", {
      note: "Kiểm định kỳ",
      zoneId: "zone-1",
    });
    const countBody = mockedPost.mock.calls.find(
      ([url]) => url === "/stock-counts/sc-1/items/item-1/count",
    )?.[1] as FormData;
    expect(Object.fromEntries(countBody.entries())).toEqual({
      actualQty: "10",
      reason: "Lệch do vỡ",
      shelfId: "shelf-1",
    });
    expect(mockedPost).toHaveBeenCalledWith(
      "/stock-counts/sc-1/items/item-1/count",
      expect.any(FormData),
      { headers: { "Content-Type": "multipart/form-data" } },
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
      },
    });
    const scrapBody = mockedPost.mock.calls.find(
      ([url]) => url === "/scrap-notes",
    )?.[1] as FormData;
    expect(scrapBody.get("warehouseId")).toBeNull();
    expect(scrapBody.get("note")).toBe("Hàng vỡ");
    expect(JSON.parse(String(scrapBody.get("items")))).toEqual([
      {
        itemId: "item-1",
        quantity: 2,
        reason: "Vỡ khi kiểm hàng",
        shelfId: "shelf-1",
      },
    ]);
    expect(mockedPost).toHaveBeenCalledWith(
      "/scrap-notes",
      expect.any(FormData),
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    expect(mockedPost).toHaveBeenCalledWith("/scrap-notes/scrap-1/approve");
    expect(mockedPost).toHaveBeenCalledWith("/scrap-notes/scrap-1/reject", {
      rejectReason: "Cần kiểm lại số lượng",
    });
  });

  it("calls live carrier and shipment endpoints from Swagger", async () => {
    mockedGet.mockResolvedValueOnce({ data: [shipment] });
    mockedGet.mockResolvedValueOnce({ data: shipment });
    mockedGet.mockResolvedValueOnce({ data: [carrier] });
    mockedGet.mockResolvedValueOnce({ data: carrier });
    mockedPost.mockResolvedValueOnce({ data: carrier });
    mockedPatch.mockResolvedValue({ data: shipment });

    expect(normalizeShipmentListResponse([shipment])).toMatchObject({
      data: [shipment],
      total: 1,
    });
    expect(normalizeCarrierListResponse([carrier])).toMatchObject({
      data: [carrier],
      total: 1,
    });

    await listShipments({
      carrierId: "carrier-1",
      limit: 20,
      orderId: "order-1",
      page: 1,
      shipmentStatus: "PENDING",
    });
    await getShipment("shipment-1");
    await listCarriers({ limit: 20, page: 1, status: "ACTIVE" });
    await getCarrier("carrier-1");
    await createCarrier({
      code: "GHN",
      contactInfo: { phone: "1900636677" },
      name: "Giao Hàng Nhanh",
      note: "Ưu tiên nội thành",
    });
    await updateCarrier("carrier-1", { status: "INACTIVE" });
    await assignShipmentCarrier("shipment-1", {
      carrierId: "carrier-1",
      trackingNumber: "GHN-0002",
    });
    await updateShipmentStatus("shipment-1", {
      images: [new File(["pod"], "pod.png", { type: "image/png" })],
      note: "Đã bàn giao cho hãng vận chuyển",
      status: "PICKED_UP",
    });

    expect(mockedGet).toHaveBeenCalledWith("/shipments", {
      params: {
        carrierId: "carrier-1",
        limit: 20,
        orderId: "order-1",
        page: 1,
        shipmentStatus: "PENDING",
      },
    });
    expect(mockedGet).toHaveBeenCalledWith("/shipments/shipment-1");
    expect(mockedGet).toHaveBeenCalledWith("/carriers", {
      params: { limit: 20, page: 1, status: "ACTIVE" },
    });
    expect(mockedGet).toHaveBeenCalledWith("/carriers/carrier-1");
    expect(mockedPost).toHaveBeenCalledWith("/carriers", {
      code: "GHN",
      contactInfo: { phone: "1900636677" },
      name: "Giao Hàng Nhanh",
      note: "Ưu tiên nội thành",
    });
    expect(mockedPatch).toHaveBeenCalledWith("/carriers/carrier-1", {
      status: "INACTIVE",
    });
    expect(mockedPatch).toHaveBeenCalledWith("/shipments/shipment-1/assign", {
      carrierId: "carrier-1",
      trackingNumber: "GHN-0002",
    });
    const statusBody = mockedPatch.mock.calls.find(
      ([url]) => url === "/shipments/shipment-1/status",
    )?.[1] as FormData;
    expect(statusBody.get("status")).toBe("PICKED_UP");
    expect(statusBody.get("note")).toBe("Đã bàn giao cho hãng vận chuyển");
    expect(statusBody.getAll("images")).toHaveLength(1);
    expect(mockedPatch).toHaveBeenCalledWith(
      "/shipments/shipment-1/status",
      expect.any(FormData),
      { headers: { "Content-Type": "multipart/form-data" } },
    );
  });
});
