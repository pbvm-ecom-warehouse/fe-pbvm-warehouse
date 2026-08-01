import type {
  GoodsReceiptNote,
  GoodsReceiptNoteItem,
} from "@/features/purchases/services/goods-receipt-note.service";
import type {
  PutawayTask,
  PutawayTaskItem,
  PutawayTaskStatus,
} from "../services/putaway-task.service";

export type PutawayPackageSpec = {
  depthCm: number;
  widthCm: number;
  heightCm: number;
  volumeCm3: number;
};

export type PutawayWorkItem = {
  key: string;
  taskId: string;
  taskStatus: PutawayTaskStatus;
  sourceType: "GOODS_RECEIPT" | "GOODS_RETURN";
  grnId: string;
  grnNumber: string;
  itemId: string;
  sku: string;
  itemName: string;
  barcode?: string;
  itemType?: string;
  lotId?: string;
  lotNumber?: string;
  manufacturedDate?: string;
  expiryDate?: string;
  quantity: number;
  remainingQty: number;
  packageSpec?: PutawayPackageSpec;
};

function packageSpecFrom(
  line: PutawayTaskItem,
  item?: GoodsReceiptNoteItem,
): PutawayPackageSpec | undefined {
  if (line.packageSpec) {
    return {
      depthCm: line.packageSpec.depthCm,
      widthCm: line.packageSpec.widthCm,
      heightCm: line.packageSpec.heightCm,
      volumeCm3: line.packageSpec.volumeCm3,
    };
  }
  const depthCm = item?.itemDepth;
  const widthCm = item?.itemWidth;
  const heightCm = item?.itemHeight;
  if (!depthCm || !widthCm || !heightCm) return undefined;
  return {
    depthCm,
    widthCm,
    heightCm,
    volumeCm3: depthCm * widthCm * heightCm,
  };
}

export function buildPutawayWorkItems(
  tasks: PutawayTask[],
  receipts: GoodsReceiptNote[],
  options: { includeCompleted?: boolean } = {},
): PutawayWorkItem[] {
  const receiptById = new Map(receipts.map((receipt) => [receipt.id, receipt]));

  return tasks.flatMap((task) => {
    const sourceType = task.sourceType ?? "GOODS_RECEIPT";
    const receipt =
      sourceType === "GOODS_RECEIPT"
        ? receiptById.get(task.grnId)
        : undefined;
    return task.items.flatMap((line) => {
      const remainingQty = line.remainingQty ?? line.quantity ?? 0;
      if (!options.includeCompleted && remainingQty <= 0) return [];
      const item =
        receipt?.items.find(
          (candidate) =>
            candidate.itemId === line.itemId &&
            (!line.lotNumber || candidate.lotNumber === line.lotNumber),
        ) ??
        receipt?.items.find((candidate) => candidate.itemId === line.itemId);
      const lotId = line.lotId ?? undefined;
      const lotNumber = line.lotNumber ?? item?.lotNumber ?? undefined;
      return [
        {
          key: `${task.id}:${line.itemId}:${lotId ?? lotNumber ?? "none"}`,
          taskId: task.id,
          taskStatus: task.status,
          sourceType,
          grnId: task.grnId,
          grnNumber:
            receipt?.grnNumber ??
            task.sourceNumber ??
            task.grnNumber ??
            task.grnId,
          itemId: line.itemId,
          sku: item?.sku || line.sku || "Chưa có SKU",
          itemName: item?.itemName || item?.sku || line.sku || "Mặt hàng",
          barcode: item?.barcode,
          itemType: item?.type ?? item?.category,
          lotId,
          lotNumber,
          manufacturedDate: item?.manufacturedDate ?? undefined,
          expiryDate: item?.expiryDate ?? undefined,
          quantity: line.quantity,
          remainingQty,
          packageSpec: packageSpecFrom(line, item),
        },
      ];
    });
  });
}
