"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, MapPinned } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSessionUser } from "@/hooks/use-session-user";
import { getApiErrorCode, getApiErrorMessage } from "@/lib/api-contract";
import { hasAnyRole } from "@/lib/rbac";
import type { GoodsReceiptNote } from "../services/goods-receipt-note.service";
import { listPutawaySuggestionResult } from "@/features/warehouse-navigation/services/putaway-navigation.service";
import {
  confirmPutawayLine,
  listPutawayTasks,
  type PutawayTaskItem,
} from "@/features/warehouse-navigation/services/putaway-task.service";
import { WarehouseOperationWorkspace } from "@/features/warehouse-navigation/components/warehouse-operation-workspace";

type PutawayLine = {
  taskId: string;
  line: PutawayTaskItem;
  sku: string;
  label: string;
};

export function GoodsReceiptPutawayPanel({ grn }: { grn: GoodsReceiptNote }) {
  const user = useSessionUser();
  const queryClient = useQueryClient();
  const canPutAway = hasAnyRole(user?.roles, ["ADMIN", "RECEIVER"]);
  const [selectedKey, setSelectedKey] = useState("");
  const tasksQuery = useQuery({
    enabled: grn.status === "APPROVED",
    queryFn: () => listPutawayTasks({ grnId: grn.id, limit: 100, page: 1 }),
    queryKey: ["putaway-tasks", grn.id],
  });
  const lines = useMemo<PutawayLine[]>(
    () =>
      (tasksQuery.data?.data ?? []).flatMap((task) =>
        task.items
          .filter((line) => (line.remainingQty ?? line.quantity ?? 0) > 0)
          .map((line) => {
            const grnItem = grn.items.find(
              (item) => item.itemId === line.itemId,
            );
            const sku = grnItem?.sku ?? line.sku ?? "Chưa có SKU";
            const remaining = line.remainingQty ?? line.quantity ?? 0;
            return {
              taskId: task.id,
              line,
              sku,
              label: `${sku} · còn ${remaining} thùng`,
            };
          }),
      ),
    [grn.items, tasksQuery.data?.data],
  );
  const selected = lines.find(
    (entry) =>
      `${entry.taskId}:${entry.line.itemId}:${entry.line.lotId ?? "none"}` ===
      selectedKey,
  );
  const remainingPackageCount =
    selected?.line.remainingQty ?? selected?.line.quantity ?? 0;
  const suggestionQuery = useQuery({
    enabled: Boolean(selected),
    queryFn: () =>
      listPutawaySuggestionResult({
        sku: selected!.sku,
        packageCount: remainingPackageCount || 1,
        lotId: selected!.line.lotId ?? undefined,
        packageSpec: selected!.line.packageSpec
          ? {
              depthCm: selected!.line.packageSpec.depthCm,
              widthCm: selected!.line.packageSpec.widthCm,
              heightCm: selected!.line.packageSpec.heightCm,
              volumeCm3: selected!.line.packageSpec.volumeCm3,
            }
          : undefined,
      }),
    queryKey: [
      "putaway-suggestions",
      selected?.sku,
      selected?.line.lotId,
      remainingPackageCount,
      selected?.line.packageSpec?.volumeCm3,
    ],
  });
  const confirmMutation = useMutation({
    mutationFn: async (input: {
      itemBarcode: string;
      cellBarcode: string;
      quantity: number;
      suggestedCellId?: string;
    }) => {
      if (!selected) throw new Error("Chọn dòng cần cất hàng.");
      return confirmPutawayLine(selected.taskId, {
        ...input,
        ...(selected.line.lotId ? { lotId: selected.line.lotId } : {}),
      });
    },
    onError: (error) => {
      const code = getApiErrorCode(error);
      const messages: Partial<Record<string, string>> = {
        GRN_PACKAGE_SPEC_REQUIRED:
          "Mặt hàng chưa khai đủ kích thước thùng — không thể xếp kệ.",
      };
      toast.error(
        (code && messages[code]) ||
          getApiErrorMessage(error) ||
          (error instanceof Error ? error.message : "Không thể lưu cất hàng."),
      );
    },
    onSuccess: async () => {
      toast.success("Đã lưu đúng khoang cất hàng.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["putaway-tasks", grn.id] }),
        queryClient.invalidateQueries({ queryKey: ["goods-receipt-notes"] }),
        queryClient.invalidateQueries({
          queryKey: ["warehouse-operation", "rack-cells"],
        }),
      ]);
    },
  });

  if (grn.status !== "APPROVED")
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cất hàng</CardTitle>
          <CardDescription>
            Chỉ khi Admin hoặc Manager duyệt phiếu, hệ thống mới ghi hàng vào
            khu nhận tạm và sinh phiếu cất hàng.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPinned className="size-4 text-primary" />
            Bắt đầu cất hàng
          </CardTitle>
          <CardDescription>
            {canPutAway
              ? "Chọn dòng hàng để xem đường đi, mở rack và quét xác nhận khoang."
              : "Bạn có thể xem tiến độ nhưng không có quyền xác nhận cất hàng."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tasksQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">
              <LoaderCircle className="mr-2 inline size-4 animate-spin" />
              Đang tải phiếu cất hàng...
            </div>
          ) : lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Tất cả dòng đã được cất xong.
            </p>
          ) : (
            <div className="space-y-2">
              <Label>Dòng hàng cần cất</Label>
              <Select value={selectedKey} onValueChange={setSelectedKey}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn SKU/lô cần cất" />
                </SelectTrigger>
                <SelectContent>
                  {lines.map((entry) => {
                    const key = `${entry.taskId}:${entry.line.itemId}:${entry.line.lotId ?? "none"}`;
                    return (
                      <SelectItem key={key} value={key}>
                        {entry.label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>
      {selected ? (
        <>
          <WarehouseOperationWorkspace
            key={selectedKey}
            operation="PUTAWAY"
            sku={selected.sku}
            remainingPackageCount={remainingPackageCount}
            suggestions={(suggestionQuery.data?.suggestions ?? []).map(
              (item) => ({ ...item }),
            )}
            suggestionsLoading={suggestionQuery.isLoading}
            suggestionsError={suggestionQuery.error}
            pending={confirmMutation.isPending}
            onConfirm={async (value) => {
              if (!canPutAway)
                throw new Error("Bạn không có quyền xác nhận cất hàng.");
              await confirmMutation.mutateAsync({
                itemBarcode: value.itemBarcode,
                cellBarcode: value.cellBarcode,
                quantity: value.quantity,
                suggestedCellId: value.suggestedCellId,
              });
            }}
          />
          {suggestionQuery.data?.warning ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Cảnh báo gợi ý: {suggestionQuery.data.warning}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
