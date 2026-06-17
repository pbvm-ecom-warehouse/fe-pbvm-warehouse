import type { MoveType } from "@/types/api";

export function calculateAvailableQty(quantity: number, reservedQty: number) {
  return Math.max(quantity - reservedQty, 0);
}

export function getStockStatus(
  quantity: number,
  reservedQty: number,
  reorderPoint: number,
) {
  const availableQty = calculateAvailableQty(quantity, reservedQty);

  if (availableQty === 0) {
    return "out" as const;
  }

  if (availableQty <= reorderPoint) {
    return "low" as const;
  }

  return "healthy" as const;
}

const moveTypeLabels: Record<MoveType, string> = {
  INBOUND: "Nhập kho",
  OUTBOUND: "Xuất bán",
  TRANSFER_OUT: "Chuyển đi",
  TRANSFER_IN: "Nhận chuyển",
  ADJUST_PLUS: "Kiểm kê thừa",
  ADJUST_MINUS: "Kiểm kê thiếu",
  PRINT_CONSUME: "Tiêu thụ ly trắng để in",
  PRINT_OUTPUT: "Nhập ly in cho đơn",
  CONVERT_OUT: "Xuất đi in",
  CONVERT_IN: "Nhập ly in",
};

export function getMoveTypeLabel(moveType: MoveType) {
  return moveTypeLabels[moveType];
}
