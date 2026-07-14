import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { dashboardRoutes } from "@/constants/routes";

const forbiddenPrintJobCopy = [
  ["Lệnh", "in ly"].join(" "),
  ["Tạo", "lệnh in"].join(" "),
  ["Theo dõi", "lệnh in"].join(" "),
  ["mở", "lệnh in"].join(" "),
];

const forbiddenOperationalCopy = [
  "API",
  "Swagger",
  "Purchase Orders",
  "WarehouseItem id",
  "Item id",
  "Unit price",
  "Order ref",
  "Lot id",
  "CUSTOM_PRINT",
  "Dữ liệu chưa có",
];

function listSourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];

  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      return listSourceFiles(fullPath);
    }

    return /\.(ts|tsx)$/.test(entry) ? [fullPath] : [];
  });
}

function extractStringLiterals(sourceText: string) {
  const literals: string[] = [];
  const pattern = /(["'`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
  let match = pattern.exec(sourceText);

  while (match) {
    literals.push(match[2]);
    match = pattern.exec(sourceText);
  }

  return literals.join("\n");
}

describe("print job UI copy", () => {
  it("uses In ly as the visible sidebar label", () => {
    const printRoute = dashboardRoutes.find((route) => route.href === "/print-jobs");

    expect(printRoute?.label).toBe("In ly");
  });

  it("does not present print jobs as manually created from frontend", () => {
    const sourceText = listSourceFiles(join(process.cwd(), "src"))
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");

    forbiddenPrintJobCopy.forEach((copy) => {
      expect(sourceText).not.toContain(copy);
    });
  });

  it("does not expose developer-facing WMS wording in UI strings", () => {
    const uiSourceText = [
      join(process.cwd(), "src", "app"),
      join(process.cwd(), "src", "components"),
      join(process.cwd(), "src", "features"),
    ]
      .flatMap(listSourceFiles)
      .filter((file) => /[\\/](app|components)[\\/]/.test(file))
      .map((file) => readFileSync(file, "utf8"))
      .map(extractStringLiterals)
      .join("\n");

    forbiddenOperationalCopy.forEach((copy) => {
      expect(uiSourceText).not.toContain(copy);
    });
  });
});
