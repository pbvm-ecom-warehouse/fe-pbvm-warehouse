import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createStockCountScrap,
  disposeScrapNote,
  moveScrapItemToScrap,
} from "@/features/adjustments/services/scrap-note.service";
import { countStockCountItem } from "@/features/adjustments/services/stock-count.service";
import { inspectGoodsReturn } from "@/features/goods-returns/services/goods-return.service";
import { apiClient } from "@/lib/api-client";

vi.mock("@/lib/api-client", () => ({
  apiClient: { post: vi.fn() },
}));

const mockedPost = vi.mocked(apiClient.post);

function latestFormData() {
  const body = mockedPost.mock.calls.at(-1)?.[1];
  expect(body).toBeInstanceOf(FormData);
  return body as FormData;
}

describe("adjustments and goods return service contracts", () => {
  beforeEach(() => {
    mockedPost.mockReset();
    mockedPost.mockResolvedValue({ data: {} });
  });

  it("sends the counted cell identity with a stock-count line", async () => {
    await countStockCountItem({
      input: {
        actualQty: 12,
        cellId: "cell-1",
        shelfId: "shelf-1",
      },
      itemId: "item-1",
      stockCountId: "count-1",
    });

    expect(mockedPost).toHaveBeenCalledWith(
      "/stock-counts/count-1/items/item-1/count",
      expect.any(FormData),
    );
    const body = latestFormData();
    expect(body.get("cellId")).toBe("cell-1");
    expect(body.get("shelfId")).toBe("shelf-1");
  });

  it("keeps the stock-count cell when creating its scrap proposal", async () => {
    await createStockCountScrap({
      input: {
        cellId: "cell-1",
        itemBarcode: "8938500000123",
        quantity: 2,
        reason: "Vỡ",
        shelfId: "shelf-1",
      },
      itemId: "item-1",
      stockCountId: "count-1",
    });

    expect(latestFormData().get("cellId")).toBe("cell-1");
  });

  it("moves an approved scrap line by scanned item, source and SCRAP cells", async () => {
    await moveScrapItemToScrap("scrap-1", "item-1", {
      itemBarcode: "8938500000123",
      sourceCellBarcode: "CELL-A-01",
      targetCellBarcode: "SCRAP-01",
    });

    expect(mockedPost).toHaveBeenCalledWith(
      "/scrap-notes/scrap-1/items/item-1/move-to-scrap",
      {
        itemBarcode: "8938500000123",
        sourceCellBarcode: "CELL-A-01",
        targetCellBarcode: "SCRAP-01",
      },
    );
  });

  it("disposes a quarantined scrap note through its lifecycle endpoint", async () => {
    await disposeScrapNote("scrap-1");

    expect(mockedPost).toHaveBeenCalledWith("/scrap-notes/scrap-1/dispose");
  });

  it("inspects returned items without a user-selected shelf", async () => {
    await inspectGoodsReturn("return-1", {
      items: [{ condition: "GOOD", itemId: "item-1", lotId: "lot-1" }],
    });

    const items = JSON.parse(String(latestFormData().get("items")));
    expect(items).toEqual([
      { condition: "GOOD", itemId: "item-1", lotId: "lot-1" },
    ]);
  });
});
