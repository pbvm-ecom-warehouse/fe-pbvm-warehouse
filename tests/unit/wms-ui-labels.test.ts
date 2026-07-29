import { describe, expect, it } from "vitest";

import {
  businessCodeLabel,
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

  it("never falls back from a missing business code to an internal id", () => {
    expect(businessCodeLabel("GI-20260730-0001")).toBe("GI-20260730-0001");
    expect(businessCodeLabel("  ")).toBe("Chưa có mã");
    expect(businessCodeLabel(null)).toBe("Chưa có mã");
    expect(businessCodeLabel(undefined)).toBe("Chưa có mã");
  });
});
