import { describe, expect, it } from "vitest";

import {
  printJobLineStatusLabel,
  printJobStatusLabel,
  statusLabel,
  statusTone,
} from "@/lib/wms-ui-labels";

describe("WMS UI labels", () => {
  it("renders operational statuses in Vietnamese", () => {
    expect(statusLabel("PENDING")).toBe("Chờ xử lý");
    expect(statusLabel("CONFIRMED")).toBe("Đã xác nhận");
    expect(statusLabel("APPROVED")).toBe("Đã duyệt");
    expect(statusLabel("ACTIVE")).toBe("Đang dùng");
  });

  it("uses print-specific labels", () => {
    expect(printJobStatusLabel("IN_PROGRESS")).toBe("Đang in");
    expect(printJobLineStatusLabel("CONSUMED")).toBe("Đã lấy ly");
  });

  it("maps status tones consistently", () => {
    expect(statusTone("COMPLETED")).toBe("success");
    expect(statusTone("CANCELLED")).toBe("danger");
    expect(statusTone("PENDING")).toBe("info");
  });
});