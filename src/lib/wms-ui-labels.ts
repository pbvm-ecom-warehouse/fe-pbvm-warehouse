const statusLabels: Record<string, string> = {
  ACTIVE: "Đang dùng",
  APPROVED: "Đã duyệt",
  BLACKLIST: "Chặn mua",
  CANCELLED: "Đã hủy",
  COMPLETED: "Hoàn tất",
  CONFIRMED: "Đã xác nhận",
  CONSUMED: "Đã lấy ly",
  DRAFT: "Nháp",
  IN_PROGRESS: "Đang xử lý",
  INACTIVE: "Ngưng dùng",
  PARTIALLY_RECEIVED: "Nhận một phần",
  PENDING: "Chờ xử lý",
  REJECTED: "Từ chối",
  SENT: "Đã gửi",
};

const printJobStatusLabels: Record<string, string> = {
  CANCELLED: "Đã hủy",
  COMPLETED: "Hoàn tất",
  IN_PROGRESS: "Đang in",
  PENDING: "Chờ in",
};

const printJobLineStatusLabels: Record<string, string> = {
  COMPLETED: "Hoàn tất",
  CONSUMED: "Đã lấy ly",
  PENDING: "Chờ lấy ly",
};

export function statusLabel(status: string) {
  return statusLabels[status] ?? status;
}

export function printJobStatusLabel(status: string) {
  return printJobStatusLabels[status] ?? statusLabel(status);
}

export function printJobLineStatusLabel(status: string) {
  return printJobLineStatusLabels[status] ?? statusLabel(status);
}

export function statusTone(status: string) {
  if (["ACTIVE", "APPROVED", "COMPLETED", "CONFIRMED"].includes(status)) {
    return "success" as const;
  }

  if (["CANCELLED", "BLACKLIST", "REJECTED"].includes(status)) {
    return "danger" as const;
  }

  if (["DRAFT", "PENDING", "IN_PROGRESS", "PARTIALLY_RECEIVED", "SENT"].includes(status)) {
    return "info" as const;
  }

  return "neutral" as const;
}
