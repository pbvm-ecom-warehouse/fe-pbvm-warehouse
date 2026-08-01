const statusLabels: Record<string, string> = {
  ACTIVE: "Đang dùng",
  APPROVED: "Đã duyệt",
  BLACKLIST: "Chặn mua",
  CANCELLED: "Đã hủy",
  COMPLETED: "Hoàn tất",
  CONFIRMED: "Đã xác nhận",
  DISPOSED: "Đã tiêu hủy",
  PENDING_APPROVAL: "Chờ duyệt",
  CONSUMED: "Đã lấy ly",
  DRAFT: "Nháp",
  DAMAGED: "Hàng lỗi",
  GOOD: "Hàng tốt",
  IN_PROGRESS: "Đang xử lý",
  INACTIVE: "Ngưng dùng",
  INSPECTED: "Đã phân loại",
  PARTIALLY_RECEIVED: "Nhận một phần",
  PENDING: "Chờ xử lý",
  PICKING: "Đang lấy hàng",
  QUARANTINED: "Đã chuyển khu hủy",
  REJECTED: "Từ chối",
  RESTOCKED: "Đã nhập lại",
  SENT: "Đã gửi",
};

const printJobStatusLabels: Record<string, string> = {
  CANCELLED: "Đã hủy",
  COMPLETED: "Hoàn tất",
  IN_PROGRESS: "Đang in",
  PENDING: "Chờ in",
  PUTAWAY_PENDING: "Chờ cất thành phẩm",
};

const printJobStageLabels: Record<string, string> = {
  PRODUCTION: "In chính thức",
  SAMPLE: "In mẫu",
};

const printJobLineStatusLabels: Record<string, string> = {
  COMPLETED: "Hoàn tất",
  CONSUMED: "Đã lấy ly",
  PENDING: "Chờ lấy ly",
};

export function businessCodeLabel(value: string | null | undefined) {
  return value?.trim() || "Chưa có mã";
}

export function statusLabel(status: string) {
  return statusLabels[status] ?? status;
}

export function stockCountStatusLabel(status: string) {
  return status === "CANCELLED" ? "Đã đóng" : statusLabel(status);
}

export function printJobStatusLabel(status: string) {
  return printJobStatusLabels[status] ?? statusLabel(status);
}

export function printJobLineStatusLabel(status: string) {
  return printJobLineStatusLabels[status] ?? statusLabel(status);
}

export function printJobStageLabel(stage: string | null | undefined) {
  return stage ? (printJobStageLabels[stage] ?? stage) : "Chưa xác định";
}

export function statusTone(status: string) {
  if (
    [
      "ACTIVE",
      "APPROVED",
      "COMPLETED",
      "CONFIRMED",
      "RESTOCKED",
      "GOOD",
    ].includes(status)
  ) {
    return "success" as const;
  }

  if (
    ["CANCELLED", "BLACKLIST", "REJECTED", "DAMAGED", "DISPOSED"].includes(
      status,
    )
  ) {
    return "danger" as const;
  }

  if (
    [
      "DRAFT",
      "PENDING",
      "PICKING",
      "QUARANTINED",
      "PUTAWAY_PENDING",
      "IN_PROGRESS",
      "INSPECTED",
      "PARTIALLY_RECEIVED",
      "SENT",
    ].includes(status)
  ) {
    return "info" as const;
  }

  return "neutral" as const;
}

export function stockCountStatusTone(status: string) {
  return status === "CANCELLED" ? ("neutral" as const) : statusTone(status);
}
