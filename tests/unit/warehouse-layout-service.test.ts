import { describe, expect, it } from "vitest";

import {
  getWarehouseLayout,
  publishWarehouseLayout,
  saveWarehouseLayoutDraft,
} from "@/features/warehouse-layout/services/warehouse-layout.service";
import { fallbackWarehouseLayout } from "@/features/warehouse-layout/utils/warehouse-layout";
import { MissingBackendEndpointError } from "@/lib/api-contract";

describe("warehouse layout service", () => {
  it("blocks unsupported published layout requests", async () => {
    await expect(getWarehouseLayout("central", "published")).rejects.toMatchObject({
      endpoint: "GET /api/wms/warehouses/central/layout?status=published",
    });
    await expect(getWarehouseLayout("central", "published")).rejects.toBeInstanceOf(
      MissingBackendEndpointError,
    );
  });

  it("blocks unsupported draft saves", async () => {
    await expect(saveWarehouseLayoutDraft(fallbackWarehouseLayout)).rejects.toMatchObject(
      {
        endpoint: "PUT /api/wms/warehouses/central/layout/draft",
      },
    );
  });

  it("blocks unsupported layout publish", async () => {
    await expect(publishWarehouseLayout("central", 4)).rejects.toMatchObject({
      endpoint: "POST /api/wms/warehouses/central/layout/publish revision 4",
    });
  });
});
