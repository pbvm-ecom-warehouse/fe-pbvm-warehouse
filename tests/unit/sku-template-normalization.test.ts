import { beforeEach, describe, expect, it, vi } from "vitest";

import { getSkuTemplate } from "@/features/products/services/warehouse-items.service";
import { apiClient } from "@/lib/api-client";

vi.mock("@/lib/api-client", () => ({
  apiClient: { get: vi.fn() },
}));

const mockedGet = vi.mocked(apiClient.get);

describe("SKU template normalization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deduplicates category options by id", async () => {
    const duplicateId = "66a100000000000000000099";
    mockedGet.mockResolvedValueOnce({
      data: {
        data: {
          categoryKey: "MATERIAL_CATEGORY",
          kind: "category-options",
          options: [
            {
              code: "RAW",
              id: duplicateId,
              isActive: true,
              key: "MATERIAL_CATEGORY",
              name: "Nguyên liệu thô",
              sortOrder: 1,
            },
            {
              code: "RAW-DUPLICATE",
              id: duplicateId,
              isActive: true,
              key: "MATERIAL_CATEGORY",
              name: "Bản ghi trùng",
              sortOrder: 2,
            },
          ],
        },
        meta: {},
      },
    });

    await expect(getSkuTemplate("MATERIAL")).resolves.toMatchObject({
      options: [{ code: "RAW", id: duplicateId }],
    });
  });
  it("normalizes the direct template returned for MATERIAL without a category request", async () => {
    mockedGet.mockResolvedValueOnce({
      data: {
        data: {
          category: null,
          fields: [
            { categoryKey: "MATERIAL_CATEGORY", required: true },
            { categoryKey: "FLAVOR", required: false },
          ],
          itemType: "MATERIAL",
          kind: "template",
          templateId: "MATERIAL",
        },
        meta: {},
      },
    });

    await expect(getSkuTemplate("MATERIAL")).resolves.toMatchObject({
      fields: [
        { key: "MATERIAL_CATEGORY", required: true },
        { key: "FLAVOR", required: false },
      ],
      templateId: "MATERIAL",
    });
    expect(mockedGet).toHaveBeenCalledWith(
      "/stock/item-types/MATERIAL/sku-template",
    );
  });
});
