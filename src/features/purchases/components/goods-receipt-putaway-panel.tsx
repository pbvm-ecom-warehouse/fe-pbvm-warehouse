"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, MapPinned, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSessionUser } from "@/hooks/use-session-user";
import { getApiErrorMessage } from "@/lib/api-contract";
import { hasAnyRole } from "@/lib/rbac";
import type { GoodsReceiptNote } from "../services/goods-receipt-note.service";
import { listPutawaySuggestionResult } from "@/features/warehouse-navigation/services/putaway-navigation.service";
import {
  confirmPutawayLine,
  listPutawayTasks,
  type PutawayTaskItem,
} from "@/features/warehouse-navigation/services/putaway-task.service";

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
  const [itemBarcode, setItemBarcode] = useState("");
  const [shelfCode, setShelfCode] = useState("");
  const [quantity, setQuantity] = useState("");

  const tasksQuery = useQuery({
    enabled: grn.status !== "DRAFT",
    queryFn: () => listPutawayTasks({ grnId: grn.id, limit: 100, page: 1 }),
    queryKey: ["putaway-tasks", grn.id],
  });

  const lines = useMemo<PutawayLine[]>(
    () =>
      (tasksQuery.data?.data ?? []).flatMap((task) =>
        task.items
          .filter((line) => (line.remainingQty ?? line.quantity) > 0)
          .map((line) => {
            const grnItem = grn.items.find(
              (item) => item.itemId === line.itemId,
            );
            const sku = grnItem?.sku ?? line.sku ?? "Chưa có SKU";
            return {
              taskId: task.id,
              line,
              sku,
              label: `${sku} · còn ${line.remainingQty ?? line.quantity} ${grnItem?.unit ?? ""}`,
            };
          }),
      ),
    [grn.items, tasksQuery.data?.data],
  );

  const selected = lines.find(
    (line) =>
      `${line.taskId}:${line.line.itemId}:${line.line.lotId ?? "none"}` ===
      selectedKey,
  );
  const suggestionQuery = useQuery({
    enabled: Boolean(selected),
    queryFn: () =>
      listPutawaySuggestionResult({
        sku: selected!.sku,
        quantity: selected!.line.remainingQty ?? selected!.line.quantity,
      }),
    queryKey: [
      "putaway-suggestions",
      selected?.sku,
      selected?.line.remainingQty,
    ],
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Chọn dòng cần cất hàng.");
      const parsedQuantity = Number(quantity);
      if (
        !itemBarcode.trim() ||
        !shelfCode.trim() ||
        !Number.isFinite(parsedQuantity) ||
        parsedQuantity <= 0
      ) {
        throw new Error("Quét mã hàng, mã kệ và nhập số lượng hợp lệ.");
      }
      return confirmPutawayLine(selected.taskId, {
        itemBarcode: itemBarcode.trim(),
        shelfCode: shelfCode.trim(),
        quantity: parsedQuantity,
        ...(selected.line.lotId ? { lotId: selected.line.lotId } : {}),
      });
    },
    onError: (error) =>
      toast.error(
        getApiErrorMessage(error) ??
          (error instanceof Error ? error.message : "Không thể lưu cất hàng."),
      ),
    onSuccess: () => {
      toast.success("Đã lưu vị trí cất hàng.");
      setItemBarcode("");
      setShelfCode("");
      setQuantity("");
      void queryClient.invalidateQueries({
        queryKey: ["putaway-tasks", grn.id],
      });
    },
  });

  if (grn.status === "DRAFT") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cất hàng</CardTitle>
          <CardDescription>
            Xác nhận nhận hàng trước; hệ thống sẽ sinh task cất hàng ngay sau
            đó.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPinned className="size-4 text-primary" />
          Cất hàng theo phiếu nhập
        </CardTitle>
        <CardDescription>
          {canPutAway
            ? "Chọn dòng, quét mã hàng và mã kệ để lưu vị trí."
            : "Bạn chỉ có thể theo dõi gợi ý và tiến độ cất hàng."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {tasksQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            Đang tải task cất hàng...
          </div>
        ) : null}
        {!tasksQuery.isLoading && lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Không còn dòng nào chờ cất hàng.
          </p>
        ) : null}
        {lines.length > 0 ? (
          <div className="space-y-2">
            <Label>Dòng phiếu nhập</Label>
            <Select
              value={selectedKey}
              onValueChange={(value) => {
                setSelectedKey(value);
                setQuantity("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Chọn dòng cần cất" />
              </SelectTrigger>
              <SelectContent>
                {lines.map((line) => {
                  const key = `${line.taskId}:${line.line.itemId}:${line.line.lotId ?? "none"}`;
                  return (
                    <SelectItem key={key} value={key}>
                      {line.label}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        {selected ? (
          <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
            <div className="text-sm font-medium">Gợi ý kệ từ WMS</div>
            {suggestionQuery.isLoading ? (
              <div className="text-sm text-muted-foreground">
                Đang lấy gợi ý...
              </div>
            ) : null}
            {suggestionQuery.data?.warning ? (
              <div className="text-sm text-amber-700">
                Cảnh báo: {suggestionQuery.data.warning}
              </div>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2">
              {suggestionQuery.data?.suggestions.map((suggestion) => (
                <button
                  className="rounded-md border p-3 text-left text-sm hover:bg-muted"
                  key={suggestion.shelfCode}
                  onClick={() => setShelfCode(suggestion.shelfCode)}
                  type="button"
                >
                  <div className="font-medium">{suggestion.shelfCode}</div>
                  <div className="text-muted-foreground">
                    Sức chứa còn lại: {suggestion.capacity}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {selected && canPutAway ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Mã hàng quét</Label>
              <Input
                onChange={(event) => setItemBarcode(event.target.value)}
                placeholder="Quét barcode mặt hàng"
                value={itemBarcode}
              />
            </div>
            <div className="space-y-2">
              <Label>Mã kệ quét</Label>
              <Input
                onChange={(event) => setShelfCode(event.target.value)}
                placeholder="Quét barcode kệ"
                value={shelfCode}
              />
            </div>
            <div className="space-y-2">
              <Label>Số lượng</Label>
              <Input
                min="1"
                onChange={(event) => setQuantity(event.target.value)}
                type="number"
                value={quantity}
              />
            </div>
            <div className="sm:col-span-3">
              <Button
                disabled={confirmMutation.isPending}
                onClick={() => confirmMutation.mutate()}
                type="button"
              >
                {confirmMutation.isPending ? (
                  <LoaderCircle
                    className="animate-spin"
                    data-icon="inline-start"
                  />
                ) : (
                  <Save data-icon="inline-start" />
                )}
                Lưu vị trí cất
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
