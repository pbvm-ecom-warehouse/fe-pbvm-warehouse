import type { TransferStatus } from "@/types/api";

export function getNextTransferStatus(status: TransferStatus) {
  if (status === "PENDING") {
    return "IN_TRANSIT" as const;
  }

  if (status === "IN_TRANSIT") {
    return "COMPLETED" as const;
  }

  return null;
}
