import { describe, expect, it } from "vitest";

import {
  businessCodeLabel,
  printJobLineStatusLabel,
  printJobStageLabel,
  printJobStatusLabel,
  stockCountStatusLabel,
  stockCountStatusTone,
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
    expect(printJobStatusLabel("PUTAWAY_PENDING")).toBe("Chờ cất thành phẩm");
    expect(printJobLineStatusLabel("CONSUMED")).toBe("Đã lấy ly");
    expect(printJobStageLabel("SAMPLE")).toBe("In mẫu");
    expect(printJobStageLabel("PRODUCTION")).toBe("In chính thức");
  });

  it("maps status tones consistently", () => {
    expect(statusTone("COMPLETED")).toBe("success");
    expect(statusTone("CANCELLED")).toBe("danger");
    expect(statusTone("PENDING")).toBe("info");
    expect(statusTone("PUTAWAY_PENDING")).toBe("info");
  });

  it("renders migrated legacy stock counts as closed", () => {
    expect(stockCountStatusLabel("CANCELLED")).toBe("Đã đóng");
    expect(stockCountStatusTone("CANCELLED")).toBe("neutral");
  });

  it("never falls back from a missing business code to an internal id", () => {
    expect(businessCodeLabel("GI-20260730-0001")).toBe("GI-20260730-0001");
    expect(businessCodeLabel("  ")).toBe("Chưa có mã");
    expect(businessCodeLabel(null)).toBe("Chưa có mã");
    expect(businessCodeLabel(undefined)).toBe("Chưa có mã");
  });
});
