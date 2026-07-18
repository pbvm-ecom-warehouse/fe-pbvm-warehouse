import type {
  LotExpiryFlag,
  PerformanceMovementType,
} from "@/features/reports/services/report.service";

export const movementTypeLabel: Record<PerformanceMovementType, string> = {
  ADJUST: "Điều chỉnh",
  ISSUE: "Xuất kho",
  PRINT_CONSUME: "In ly - tiêu hao",
  PRINT_OUTPUT: "In ly - thành phẩm",
  PUTAWAY: "Cất hàng",
  RECEIVE: "Nhập kho",
  RETURN_IN: "Nhập hoàn",
  SCRAP: "Hủy hàng",
};

export const expiryFlagLabel: Record<LotExpiryFlag, string> = {
  expired: "Đã hết hạn",
  expiringSoon: "Sắp hết hạn",
  ok: "Còn hạn",
};

const quantityFormatter = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 3,
});

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function formatQuantity(value: number) {
  return quantityFormatter.format(value);
}

export function formatReportDate(value: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
}
