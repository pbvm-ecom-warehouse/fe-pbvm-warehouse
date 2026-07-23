import { describe, expect, it } from "vitest";

import { filterAttributeOptions } from "@/features/products/lib/attribute-option-filter";

const options = [
  {
    code: "PET",
    id: "material-pet",
    isActive: true,
    key: "MATERIAL" as const,
    name: "Nhựa PET",
    sortOrder: 1,
  },
  {
    code: "500",
    id: "volume-500",
    isActive: false,
    key: "CAPACITY" as const,
    name: "500 ml",
    sortOrder: 2,
  },
];

describe("filterAttributeOptions", () => {
  it("searches across name, SKU code and group label", () => {
    expect(filterAttributeOptions(options, "nhựa", "ALL")).toHaveLength(1);
    expect(filterAttributeOptions(options, "500", "ALL")).toHaveLength(1);
    expect(filterAttributeOptions(options, "dung tích", "ALL")).toHaveLength(1);
  });

  it("filters status without depending on the creation group", () => {
    expect(filterAttributeOptions(options, "", "ACTIVE")).toEqual([options[0]]);
    expect(filterAttributeOptions(options, "", "INACTIVE")).toEqual([
      options[1],
    ]);
  });
});
