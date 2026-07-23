import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  EVIDENCE_IMAGE_MAX_BYTES,
  validateEvidenceImageFiles,
} from "@/components/evidence-images/evidence-image-utils";
import { createScrapNote } from "@/features/adjustments/services/scrap-note.service";
import { countStockCountItem } from "@/features/adjustments/services/stock-count.service";
import { inspectGoodsReturn } from "@/features/goods-returns/services/goods-return.service";
import { uploadGoodsReceiptNoteImage } from "@/features/purchases/services/goods-receipt-note.service";
import { apiClient } from "@/lib/api-client";

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

const mockedPost = vi.mocked(apiClient.post);

function image(name: string, type = "image/jpeg", size = 4) {
  return new File([new Uint8Array(size)], name, { type });
}

function formDataFromLastPost() {
  const body = mockedPost.mock.calls.at(-1)?.[1];
  expect(body).toBeInstanceOf(FormData);
  return body as FormData;
}

describe("evidence image contracts", () => {
  beforeEach(() => {
    mockedPost.mockReset();
    mockedPost.mockResolvedValue({ data: {} });
  });

  it("accepts JPEG, PNG and WebP up to 5 MB and rejects other files", () => {
    const valid = [
      image("proof.jpg", "image/jpeg"),
      image("proof.png", "image/png"),
      image("proof.webp", "image/webp", EVIDENCE_IMAGE_MAX_BYTES),
    ];
    const invalidType = image("proof.gif", "image/gif");
    const tooLarge = image(
      "proof-large.jpg",
      "image/jpeg",
      EVIDENCE_IMAGE_MAX_BYTES + 1,
    );

    expect(validateEvidenceImageFiles(valid)).toEqual({
      accepted: valid,
      rejected: [],
    });
    expect(validateEvidenceImageFiles([invalidType, tooLarge])).toMatchObject({
      accepted: [],
      rejected: [
        { file: invalidType, reason: "type" },
        { file: tooLarge, reason: "size" },
      ],
    });
  });

  it("maps goods return images to images_<line index>", async () => {
    const good = image("good.jpg");
    const damagedA = image("damaged-a.png", "image/png");
    const damagedB = image("damaged-b.webp", "image/webp");

    await inspectGoodsReturn("return-1", {
      itemImages: [[good], [damagedA, damagedB]],
      items: [
        {
          condition: "GOOD",
          itemId: "item-1",
          shelfId: "shelf-1",
        },
        {
          condition: "DAMAGED",
          itemId: "item-2",
          shelfId: "shelf-2",
        },
      ],
      warehouseId: "warehouse-1",
    });

    const body = formDataFromLastPost();
    expect(body.get("warehouseId")).toBe("warehouse-1");
    expect(JSON.parse(String(body.get("items")))).toEqual([
      { condition: "GOOD", itemId: "item-1", shelfId: "shelf-1" },
      { condition: "DAMAGED", itemId: "item-2", shelfId: "shelf-2" },
    ]);
    expect(body.getAll("images_0")).toEqual([good]);
    expect(body.getAll("images_1")).toEqual([damagedA, damagedB]);
  });

  it("serializes scrap note fields and line images", async () => {
    const first = image("scrap-a.jpg");
    const second = image("scrap-b.png", "image/png");

    await createScrapNote({
      itemImages: [[first, second]],
      items: [
        {
          itemId: "item-1",
          quantity: 2,
          reason: "Vỡ",
          shelfId: "shelf-1",
        },
      ],
      note: "Hàng vỡ",
      warehouseId: "warehouse-1",
    });

    const body = formDataFromLastPost();
    expect(body.get("warehouseId")).toBe("warehouse-1");
    expect(body.get("note")).toBe("Hàng vỡ");
    expect(JSON.parse(String(body.get("items")))).toEqual([
      {
        itemId: "item-1",
        quantity: 2,
        reason: "Vỡ",
        shelfId: "shelf-1",
      },
    ]);
    expect(body.getAll("images_0")).toEqual([first, second]);
  });

  it("sends stock count fields and repeated images field", async () => {
    const first = image("count-a.jpg");
    const second = image("count-b.webp", "image/webp");

    await countStockCountItem({
      input: {
        actualQty: 8,
        images: [first, second],
        lotId: "lot-1",
        reason: "Thiếu hàng",
        shelfId: "shelf-1",
      },
      itemId: "item-1",
      stockCountId: "count-1",
    });

    const body = formDataFromLastPost();
    expect(body.get("shelfId")).toBe("shelf-1");
    expect(body.get("lotId")).toBe("lot-1");
    expect(body.get("reason")).toBe("Thiếu hàng");
    expect(body.get("actualQty")).toBe("8");
    expect(body.getAll("images")).toEqual([first, second]);
  });
  it("uploads a GRN image with the file field", async () => {
    const proof = image("grn-proof.webp", "image/webp");

    await uploadGoodsReceiptNoteImage("grn-1", proof);

    const body = formDataFromLastPost();
    expect(mockedPost).toHaveBeenCalledWith(
      "/goods-receipt-notes/grn-1/images",
      body,
    );
    expect(body.getAll("file")).toEqual([proof]);
  });
});
