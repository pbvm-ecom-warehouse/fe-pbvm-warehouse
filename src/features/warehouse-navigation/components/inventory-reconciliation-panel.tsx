"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArchiveRestore, LoaderCircle, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getApiErrorMessage } from "@/lib/api-contract";
import { cn } from "@/lib/utils";
import {
  assignInventoryCell,
  getInventoryCellProgress,
  listUnassignedInventory,
  type UnassignedInventoryRow,
} from "../services/inventory-reconciliation.service";

export function InventoryReconciliationPanel() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<UnassignedInventoryRow>();
  const [cellBarcode, setCellBarcode] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [depth, setDepth] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const rowsQuery = useQuery({
    queryKey: ["inventory-reconciliation", "unassigned"],
    queryFn: listUnassignedInventory,
  });
  const progressQuery = useQuery({
    queryKey: ["inventory-reconciliation", "progress"],
    queryFn: getInventoryCellProgress,
  });
  const mutation = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error("Chọn dòng tồn cần phân khoang.");
      const volume = Number(depth) * Number(width) * Number(height);
      return assignInventoryCell({
        inventoryId: selected.id,
        cellBarcode: cellBarcode.trim(),
        quantity: Number(quantity),
        packageDepthCm: Number(depth),
        packageWidthCm: Number(width),
        packageHeightCm: Number(height),
        packageVolumeCm3: volume,
      });
    },
    onError: (error) =>
      toast.error(
        getApiErrorMessage(error) ??
          (error instanceof Error ? error.message : "Không thể phân khoang."),
      ),
    onSuccess: async () => {
      toast.success("Đã phân tồn vào khoang, tổng tồn không thay đổi.");
      setCellBarcode("");
      setSelected(undefined);
      await queryClient.invalidateQueries({
        queryKey: ["inventory-reconciliation"],
      });
    },
  });
  const progress = progressQuery.data;
  function choose(row: UnassignedInventoryRow) {
    setSelected(row);
    setQuantity(String(row.quantity > 0 ? row.quantity : 1));
    const volume = row.packageVolumeCm3Snapshot;
    if (volume) {
      setDepth(String(volume));
      setWidth("1");
      setHeight("1");
    } else {
      setDepth("");
      setWidth("");
      setHeight("");
    }
  }
  const volume = Number(depth) * Number(width) * Number(height);
  const valid =
    selected &&
    cellBarcode.trim() &&
    Number.isInteger(Number(quantity)) &&
    Number(quantity) > 0 &&
    volume > 0 &&
    Number(quantity) <= selected.quantity;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ArchiveRestore className="size-4 text-blue-700" />
            Tiến độ phân khoang tồn cũ
          </CardTitle>
          <CardDescription>
            Tồn chưa có khoang vẫn nằm trong tổng tồn, nhưng chưa thể dùng để
            dẫn đường lấy hàng.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {progressQuery.isLoading ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : progress ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-2xl font-bold">
                  {progress.assignedPercent}%
                </span>
                <Badge
                  variant={progress.requiresCellScan ? "default" : "outline"}
                >
                  {progress.unassignedRows} dòng chưa phân
                </Badge>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full bg-blue-700"
                  style={{ width: `${progress.assignedPercent}%` }}
                />
              </div>
              <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                <span>
                  Đã có khoang:{" "}
                  {progress.assignedBaseQty.toLocaleString("vi-VN")}
                </span>
                <span>
                  Chưa phân khoang:{" "}
                  {progress.unassignedBaseQty.toLocaleString("vi-VN")}
                </span>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader className="border-b bg-muted/20">
            <CardTitle className="text-base">Tồn chưa phân khoang</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {rowsQuery.isLoading ? (
              <div className="p-6 text-center">
                <LoaderCircle className="mx-auto size-5 animate-spin" />
              </div>
            ) : (
              <Table scrollable>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU / mặt hàng</TableHead>
                    <TableHead>Vị trí cũ</TableHead>
                    <TableHead>Lô</TableHead>
                    <TableHead>Số lượng</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(rowsQuery.data ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="h-24 text-center text-muted-foreground"
                      >
                        Không còn tồn dương chưa phân khoang.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rowsQuery.data!.map((row) => (
                      <TableRow
                        key={row.id}
                        className={cn(
                          "cursor-pointer",
                          selected?.id === row.id && "bg-blue-50",
                        )}
                        onClick={() => choose(row)}
                      >
                        <TableCell>
                          <div className="font-mono font-semibold">
                            {row.sku}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {row.itemName}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono">
                          {row.shelfCode}
                        </TableCell>
                        <TableCell>{row.lotNumber ?? "—"}</TableCell>
                        <TableCell>
                          {row.quantity.toLocaleString("vi-VN")}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quét khoang đích</CardTitle>
            <CardDescription>
              {selected
                ? `${selected.sku} · tối đa ${selected.quantity} đơn vị`
                : "Chọn một dòng tồn ở bảng bên trái."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Mã khoang</Label>
              <Input
                value={cellBarcode}
                onChange={(event) => setCellBarcode(event.target.value)}
                placeholder="Quét tem khoang"
              />
            </div>
            <div className="space-y-2">
              <Label>Số thùng</Label>
              <Input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-2">
                <Label>Dài (cm)</Label>
                <Input
                  type="number"
                  min="0.1"
                  value={depth}
                  onChange={(event) => setDepth(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Rộng</Label>
                <Input
                  type="number"
                  min="0.1"
                  value={width}
                  onChange={(event) => setWidth(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Cao</Label>
                <Input
                  type="number"
                  min="0.1"
                  value={height}
                  onChange={(event) => setHeight(event.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Thể tích/thùng:{" "}
              {Number.isFinite(volume) ? volume.toLocaleString("vi-VN") : 0} cm³
            </p>
            <Button
              className="w-full"
              disabled={!valid || mutation.isPending}
              onClick={() => mutation.mutate()}
              type="button"
            >
              {mutation.isPending ? (
                <LoaderCircle
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : (
                <ScanLine data-icon="inline-start" />
              )}
              Xác nhận phân khoang
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
