import { describe, expect, it } from "vitest";

import { suggestSupplierCode } from "@/features/suppliers/lib/supplier-code";

describe("supplier code suggestion", () => {
  it("builds an uppercase ASCII acronym from the supplier name", () => {
    expect(suggestSupplierCode("Công ty Minh Long")).toBe("CML");
    expect(suggestSupplierCode("Nhà cung cấp Ánh Dương")).toBe("NCCAD");
  });

  it("returns an empty code for names without letters or numbers", () => {
    expect(suggestSupplierCode("  ---  ")).toBe("");
  });
});
