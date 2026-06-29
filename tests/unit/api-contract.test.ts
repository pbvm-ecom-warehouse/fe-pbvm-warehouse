import { describe, expect, it } from "vitest";

import { buildApiUrl, unwrapApiData } from "@/lib/api-contract";
import { env } from "@/lib/env";

describe("WMS API contract helpers", () => {
  it("unwraps backend success envelopes", () => {
    expect(
      unwrapApiData({
        data: [{ id: "stock-1" }],
        meta: {
          requestId: "req-1",
          pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
        },
      }),
    ).toEqual([{ id: "stock-1" }]);
  });

  it("preserves the /api/wms prefix when building WMS URLs", () => {
    expect(buildApiUrl("http://localhost:3001", "/inventory/ledger")).toBe(
      "http://localhost:3001/api/wms/inventory/ledger",
    );
    expect(
      buildApiUrl(
        "https://api-ecom-wms.hoaiphuong.io.vn",
        "/auth/login",
      ),
    ).toBe("https://api-ecom-wms.hoaiphuong.io.vn/api/wms/auth/login");
    expect(
      buildApiUrl(
        "https://api-ecom-wms.hoaiphuong.io.vn/api/wms",
        "/auth/login",
      ),
    ).toBe("https://api-ecom-wms.hoaiphuong.io.vn/api/wms/auth/login");
  });

  it("defaults the WMS API URL to the remote deployed backend", () => {
    expect(env.NEXT_PUBLIC_WMS_API_URL).toBe(
      "https://api-ecom-wms.hoaiphuong.io.vn/api/wms",
    );
  });
});
