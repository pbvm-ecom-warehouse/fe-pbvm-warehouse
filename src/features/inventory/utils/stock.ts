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
  RECEIVE: "Nhập kho",
  PUTAWAY: "Xếp hàng lên kệ",
  ISSUE: "Xuất kho",
  ADJUST: "Điều chỉnh kiểm kê",
  SCRAP: "Hủy hàng",
  PRINT_CONSUME: "Tiêu thụ ly trắng để in",
  PRINT_OUTPUT: "Nhập ly in cho đơn",
};

export function getMoveTypeLabel(moveType: MoveType) {
  return moveTypeLabels[moveType];
}
