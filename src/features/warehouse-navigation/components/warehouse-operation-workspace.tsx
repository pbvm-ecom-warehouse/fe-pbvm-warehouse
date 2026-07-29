"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  LoaderCircle,
  Map,
  MapPinned,
  Route,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetchWarehouseLayout } from "@/features/warehouse-layout/services/warehouse-layout.service";
import { getApiErrorMessage } from "@/lib/api-contract";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/utils/format-date";
import type { NavigationPath } from "../services/putaway-navigation.service";
import {
  getNavigationPath,
  listRackCells,
  type StorageCellView,
} from "../services/warehouse-operations.service";
import {
  BarcodeScanDialog,
  type BarcodeConfirmation,
} from "./barcode-scan-dialog";
import { RackCellViewer } from "./rack-cell-viewer";
import { WarehouseRouteMap } from "./warehouse-route-map";

export type WarehouseOperationSuggestion = {
  cellId: string;
  cellCode: string;
  rackId: string;
  level: number;
  bay: number;
  path: NavigationPath;
  capacity?: number;
  quantity?: number;
  fillPercent?: number;
  reason?: string;
  lotNumber?: string | null;
  expiryDate?: string | null;
};

const reasonLabels: Record<string, string> = {
  SAME_SKU_LOT_CELL: "Đã có cùng SKU và lô",
  SAME_SKU_CELL: "Đã có cùng SKU",
  BEST_FIT_VOLUME: "Vừa thể tích nhất",
};

function formatDateOnly(value?: string | null) {
  if (!value) return "";
  return formatDateTime(value).split(" ")[0];
}

export function WarehouseOperationWorkspace({
  operation,
  sku,
  remainingPackageCount,
  packageSpec,
  suggestions,
  suggestionsLoading,
  suggestionsError,
  pending,
  readOnly = false,
  readOnlyMessage,
  onConfirm,
}: {
  operation: "PUTAWAY" | "PICK";
  sku: string;
  remainingPackageCount: number;
  packageSpec?: {
    depthCm: number;
    widthCm: number;
    heightCm: number;
    volumeCm3: number;
  };
  suggestions: WarehouseOperationSuggestion[];
  suggestionsLoading?: boolean;
  suggestionsError?: unknown;
  pending?: boolean;
  readOnly?: boolean;
  readOnlyMessage?: string;
  onConfirm: (
    value: BarcodeConfirmation & {
      suggestedCellId?: string;
      actualCellId?: string;
    },
  ) => Promise<void>;
}) {
  const queryClient = useQueryClient();
  const firstSuggestion = suggestions[0];
  const [chosenRackId, setChosenRackId] = useState("");
  const [chosenCellId, setChosenCellId] = useState("");
  const [mapOpen, setMapOpen] = useState(false);
  const [rackOpen, setRackOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanCell, setScanCell] = useState<StorageCellView>();
  const selectedRackId = chosenRackId || firstSuggestion?.rackId || "";
  const suggestedCellForRack = suggestions.find(
    (suggestion) => suggestion.rackId === selectedRackId,
  )?.cellId;
  const selectedCellId =
    chosenRackId === selectedRackId && chosenCellId
      ? chosenCellId
      : (suggestedCellForRack ?? "");

  const layoutQuery = useQuery({
    queryKey: ["warehouse-operation", "layout"],
    queryFn: fetchWarehouseLayout,
  });
  const cellsQuery = useQuery({
    enabled: Boolean(selectedRackId),
    queryKey: ["warehouse-operation", "rack-cells", selectedRackId],
    queryFn: () => listRackCells(selectedRackId),
  });
  const selectedSuggestion = suggestions.find(
    (item) => item.rackId === selectedRackId && item.cellId === selectedCellId,
  );
  const pathQuery = useQuery({
    enabled: Boolean(selectedRackId) && !selectedSuggestion,
    queryKey: ["warehouse-operation", "path", selectedRackId],
    queryFn: () => getNavigationPath(selectedRackId),
  });
  const path =
    selectedSuggestion?.path ??
    pathQuery.data ??
    suggestions.find((item) => item.rackId === selectedRackId)?.path;
  const selectedRack = layoutQuery.data?.racks.find(
    (rack) => rack.id === selectedRackId,
  );
  const cells = useMemo(() => cellsQuery.data ?? [], [cellsQuery.data]);
  const selectedCell = useMemo(
    () => cells.find((cell) => cell.id === selectedCellId),
    [cells, selectedCellId],
  );

  function chooseSuggestion(suggestion: WarehouseOperationSuggestion) {
    setChosenRackId(suggestion.rackId);
    setChosenCellId(suggestion.cellId);
  }
  function activateCell(cell: StorageCellView) {
    setChosenCellId(cell.id);
    setScanCell(cell);
    setScanOpen(true);
  }
  async function confirm(value: BarcodeConfirmation) {
    await onConfirm({
      ...value,
      suggestedCellId: firstSuggestion?.cellId,
      actualCellId: scanCell?.id,
    });
    setScanOpen(false);
    await queryClient.invalidateQueries({
      queryKey: ["warehouse-operation", "rack-cells"],
    });
  }

  return (
    <div className="space-y-4">
      {readOnly ? (
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-muted/20">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPinned className="size-4 text-primary" />
                Vị trí đã cất
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="font-mono" variant="secondary">
                  {sku}
                </Badge>
                <Button
                  disabled={!selectedRackId || !selectedRack}
                  onClick={() => setRackOpen(true)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Map data-icon="inline-start" />
                  {selectedRack
                    ? `Xem mặt kệ ${selectedRack.code}`
                    : "Xem mặt kệ"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {suggestionsLoading ? (
              <div className="text-sm text-muted-foreground">
                <LoaderCircle className="mr-2 inline size-4 animate-spin" />
                Đang tải vị trí thực tế...
              </div>
            ) : null}
            {suggestionsError ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                {getApiErrorMessage(suggestionsError) ??
                  "Không tải được vị trí đã cất."}
              </div>
            ) : null}
            {!suggestionsLoading &&
            !suggestionsError &&
            suggestions.length === 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <AlertTriangle className="mr-2 inline size-4" />
                Chưa tìm thấy vị trí thực tế trên sơ đồ cho dòng đã hoàn tất.
              </div>
            ) : null}
            {layoutQuery.isLoading ? (
              <div className="grid h-[55dvh] place-items-center rounded-xl border bg-[#f4f7f6]">
                <LoaderCircle className="size-5 animate-spin text-primary" />
              </div>
            ) : layoutQuery.data && path ? (
              <WarehouseRouteMap
                layout={layoutQuery.data}
                path={path}
                selectedRackId={selectedRackId}
                onSelectRack={(rackId) => {
                  setChosenRackId(rackId);
                  setChosenCellId("");
                }}
              />
            ) : null}
            {suggestions.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {suggestions.map((suggestion) => (
                  <div
                    key={`${suggestion.cellId}-${suggestion.lotNumber ?? "none"}`}
                    className={cn(
                      "rounded-xl border p-4 text-left transition hover:border-blue-400 hover:bg-blue-50/70",
                      selectedCellId === suggestion.cellId
                        ? "border-primary bg-primary/5 shadow-[0_16px_36px_-30px_rgba(29,78,216,0.4)]"
                        : "bg-white",
                    )}
                  >
                    <button
                      className="block w-full text-left"
                      onClick={() => chooseSuggestion(suggestion)}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-mono text-sm font-bold">
                            {suggestion.cellCode}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Tầng {suggestion.level} · Khoang {suggestion.bay}
                          </div>
                        </div>
                        <Badge
                          className="shrink-0 rounded-md px-2 py-0.5 text-[11px]"
                          variant={
                            selectedCellId === suggestion.cellId
                              ? "default"
                              : "secondary"
                          }
                        >
                          {suggestion.path.distanceM.toLocaleString("vi-VN")} m
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                        {typeof suggestion.quantity === "number" ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-1 font-medium text-emerald-700">
                            {suggestion.quantity} thùng
                          </span>
                        ) : null}
                        {suggestion.lotNumber ? (
                          <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">
                            Lô {suggestion.lotNumber}
                          </span>
                        ) : null}
                        {suggestion.expiryDate ? (
                          <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">
                            HSD {formatDateOnly(suggestion.expiryDate)}
                          </span>
                        ) : null}
                      </div>
                    </button>
                    <Button
                      className="mt-3 w-full"
                      disabled={
                        !layoutQuery.data?.racks.some(
                          (rack) => rack.id === suggestion.rackId,
                        )
                      }
                      onClick={() => {
                        setChosenRackId(suggestion.rackId);
                        setChosenCellId(suggestion.cellId);
                        setMapOpen(true);
                      }}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <Map data-icon="inline-start" />
                      Xem bản đồ{" "}
                      {layoutQuery.data?.racks.find(
                        (rack) => rack.id === suggestion.rackId,
                      )?.code ?? suggestion.rackId}
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
      {!readOnly ? (
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-muted/20">
            <CardTitle className="flex items-center justify-between gap-3 text-base">
              <span className="flex items-center gap-2">
                <MapPinned className="size-4 text-primary" />
                {operation === "PUTAWAY"
                  ? "Hướng dẫn cất hàng"
                  : "Hướng dẫn lấy hàng"}
              </span>
              <Badge className="font-mono" variant="secondary">
                {sku} · còn {remainingPackageCount} thùng
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Route className="size-4 text-primary" />
                Vị trí đề xuất
              </div>
              <Button
                disabled={!layoutQuery.data}
                onClick={() => setMapOpen(true)}
                size="sm"
                type="button"
                variant="outline"
              >
                <Map data-icon="inline-start" />
                Mở bản đồ kho
              </Button>
            </div>
            {suggestionsLoading ? (
              <div className="text-sm text-muted-foreground">
                <LoaderCircle className="mr-2 inline size-4 animate-spin" />
                Đang tính vị trí và đường đi...
              </div>
            ) : null}
            {suggestionsError ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                {getApiErrorMessage(suggestionsError) ??
                  "Không lấy được gợi ý vị trí."}
              </div>
            ) : null}
            {!suggestionsLoading &&
            !suggestionsError &&
            suggestions.length === 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <AlertTriangle className="mr-2 inline size-4" />
                {readOnly
                  ? "Chưa tìm thấy vị trí thực tế trên sơ đồ cho dòng đã hoàn tất."
                  : "Chưa có khoang đủ điều kiện hoặc rack chưa nối với lối đi."}
              </div>
            ) : null}
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {suggestions.map((suggestion, index) => (
                <div
                  key={`${suggestion.cellId}-${suggestion.lotNumber ?? "none"}`}
                  className={cn(
                    "rounded-lg border p-3 text-left transition hover:border-blue-400 hover:bg-blue-50",
                    selectedCellId === suggestion.cellId
                      ? "border-primary bg-primary/5"
                      : "bg-white",
                  )}
                >
                  <button
                    className="block w-full text-left"
                    onClick={() => chooseSuggestion(suggestion)}
                    type="button"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-bold">
                        {suggestion.cellCode}
                      </span>
                      {index === 0 ? (
                        <Badge className="bg-blue-700">Ưu tiên</Badge>
                      ) : null}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Tầng {suggestion.level} · Khoang {suggestion.bay} ·{" "}
                      {suggestion.path.distanceM} m
                    </div>
                    <div className="mt-1 text-xs font-medium">
                      {suggestion.reason
                        ? (reasonLabels[suggestion.reason] ?? suggestion.reason)
                        : operation === "PICK"
                          ? `Có ${suggestion.quantity ?? 0} thùng`
                          : `Chứa thêm ${suggestion.capacity ?? 0} thùng`}
                    </div>
                    {suggestion.expiryDate ? (
                      <div className="mt-1 text-xs text-muted-foreground">
                        HSD {formatDateOnly(suggestion.expiryDate)}
                      </div>
                    ) : null}
                    {suggestion.lotNumber ? (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Lô {suggestion.lotNumber}
                      </div>
                    ) : null}
                  </button>
                  <Button
                    className="mt-3 w-full"
                    disabled={
                      !layoutQuery.data?.racks.some(
                        (rack) => rack.id === suggestion.rackId,
                      )
                    }
                    onClick={() => {
                      setChosenRackId(suggestion.rackId);
                      setChosenCellId(suggestion.cellId);
                      setRackOpen(true);
                    }}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Map data-icon="inline-start" />
                    Xem mặt kệ{" "}
                    {layoutQuery.data?.racks.find(
                      (rack) => rack.id === suggestion.rackId,
                    )?.code ?? suggestion.rackId}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
      <Dialog open={mapOpen} onOpenChange={setMapOpen}>
        <DialogContent
          className="flex h-[92dvh] max-h-[92dvh] flex-col gap-0 overflow-hidden p-0"
          size="5xl"
        >
          <DialogHeader className="shrink-0 border-b px-5 py-4 pr-14">
            <DialogTitle>
              {readOnly ? "Bản đồ vị trí đã cất" : "Bản đồ đường đi trong kho"}
            </DialogTitle>
            <DialogDescription>
              Chọn rack để xem đường đi, sau đó bấm Xem mặt kệ.
            </DialogDescription>
          </DialogHeader>
          {layoutQuery.isLoading ? (
            <div className="grid h-[60dvh] place-items-center">
              <LoaderCircle className="size-5 animate-spin text-primary" />
            </div>
          ) : layoutQuery.data ? (
            <WarehouseRouteMap
              layout={layoutQuery.data}
              path={path}
              selectedRackId={selectedRackId}
              onSelectRack={(rackId) => {
                setChosenRackId(rackId);
                setChosenCellId("");
              }}
            />
          ) : (
            <div className="m-5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              Không tải được sơ đồ kho.
            </div>
          )}
          <div className="flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-3 border-t bg-muted/20 px-5 py-3">
            <div className="text-sm">
              {chosenRackId && selectedRack ? (
                <>
                  Đã chọn{" "}
                  <span className="font-mono font-semibold">
                    {selectedRack.code}
                  </span>
                  . Kiểm tra đường đi rồi mở mặt kệ khi đã sẵn sàng.
                </>
              ) : (
                <span className="text-muted-foreground">
                  Nhấn vào rack để xem đường đi đến đúng vị trí.
                </span>
              )}
            </div>
            <Button
              disabled={!chosenRackId || !selectedRack}
              onClick={() => {
                setMapOpen(false);
                setRackOpen(true);
              }}
              type="button"
            >
              <Map data-icon="inline-start" />
              {selectedRack ? `Xem mặt kệ ${selectedRack.code}` : "Xem mặt kệ"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={rackOpen} onOpenChange={setRackOpen}>
        <DialogContent
          className="max-h-[92dvh] gap-0 overflow-hidden p-0"
          size="5xl"
        >
          <DialogHeader className="border-b px-5 py-4 pr-14">
            <DialogTitle>Mặt kệ {selectedRack?.code ?? "đã chọn"}</DialogTitle>
            <DialogDescription>
              {readOnly
                ? "Xem vị trí thực tế của hàng trên rack."
                : "Xem sức chứa rồi nhấn vào khoang hợp lệ để quét mã."}
            </DialogDescription>
            <Button
              className="mt-1 w-fit"
              onClick={() => {
                setRackOpen(false);
                setMapOpen(true);
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              <ArrowLeft data-icon="inline-start" />
              Quay lại bản đồ
            </Button>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto p-4">
            {cellsQuery.isLoading ? (
              <div className="grid h-[55dvh] place-items-center">
                <LoaderCircle className="size-5 animate-spin text-primary" />
              </div>
            ) : (
              <RackCellViewer
                rackCode={selectedRack?.code}
                cells={cells}
                selectedCellId={selectedCell?.id}
                onSelectCell={(cell) => {
                  setChosenRackId(selectedRackId);
                  setChosenCellId(cell.id);
                }}
                onActivateCell={readOnly ? () => {} : activateCell}
                operation={operation}
                packageSpec={packageSpec}
                suggestedCellIds={suggestions.map(
                  (suggestion) => suggestion.cellId,
                )}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
      {readOnlyMessage && !readOnly ? (
        <Card>
          <CardContent className="py-4 text-sm text-muted-foreground">
            {readOnlyMessage}
          </CardContent>
        </Card>
      ) : null}
      {!readOnly ? (
        <BarcodeScanDialog
          open={scanOpen}
          onOpenChange={setScanOpen}
          initialCellBarcode={scanCell?.barcode}
          maxPackageCount={Math.max(1, remainingPackageCount)}
          pending={pending}
          actionLabel={
            operation === "PUTAWAY" ? "Xác nhận cất hàng" : "Xác nhận lấy hàng"
          }
          onConfirm={(value) => void confirm(value)}
        />
      ) : null}
    </div>
  );
}
