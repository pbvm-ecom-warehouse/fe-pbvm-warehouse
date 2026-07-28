"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Boxes,
  LoaderCircle,
  MapPinned,
  Route,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchWarehouseLayout } from "@/features/warehouse-layout/services/warehouse-layout.service";
import { getApiErrorMessage } from "@/lib/api-contract";
import { cn } from "@/lib/utils";
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
  packageCount?: number;
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

export function WarehouseOperationWorkspace({
  operation,
  sku,
  remainingPackageCount,
  suggestions,
  suggestionsLoading,
  suggestionsError,
  pending,
  onConfirm,
}: {
  operation: "PUTAWAY" | "PICK";
  sku: string;
  remainingPackageCount: number;
  suggestions: WarehouseOperationSuggestion[];
  suggestionsLoading?: boolean;
  suggestionsError?: unknown;
  pending?: boolean;
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
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-slate-950 text-white">
          <CardTitle className="flex items-center justify-between gap-3 text-base">
            <span className="flex items-center gap-2">
              <MapPinned className="size-4 text-amber-400" />
              {operation === "PUTAWAY"
                ? "Hướng dẫn cất hàng"
                : "Hướng dẫn lấy hàng"}
            </span>
            <Badge className="border-slate-700 bg-slate-900 font-mono text-white">
              {sku} · còn {remainingPackageCount} thùng
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Route className="size-4 text-blue-700" />
            Vị trí đề xuất
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
              Chưa có khoang đủ điều kiện hoặc rack chưa nối với lối đi.
            </div>
          ) : null}
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {suggestions.map((suggestion, index) => (
              <button
                key={`${suggestion.cellId}-${suggestion.lotNumber ?? "none"}`}
                className={cn(
                  "rounded-lg border p-3 text-left transition hover:border-blue-400 hover:bg-blue-50",
                  selectedCellId === suggestion.cellId
                    ? "border-blue-600 bg-blue-50 ring-2 ring-blue-100"
                    : "bg-white",
                )}
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
                      ? `Có ${suggestion.packageCount ?? 0} thùng`
                      : `Chứa thêm ${suggestion.capacity ?? 0} thùng`}
                </div>
                {suggestion.lotNumber ? (
                  <div className="mt-1 text-xs text-muted-foreground">
                    Lô {suggestion.lotNumber}
                  </div>
                ) : null}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
      {layoutQuery.isLoading ? (
        <div className="grid h-64 place-items-center rounded-xl border">
          <LoaderCircle className="size-5 animate-spin text-blue-700" />
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
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          Không tải được sơ đồ kho.
        </div>
      )}
      {selectedRackId ? (
        cellsQuery.isLoading ? (
          <div className="grid h-72 place-items-center rounded-xl border">
            <LoaderCircle className="size-5 animate-spin text-blue-700" />
          </div>
        ) : (
          <RackCellViewer
            rackCode={selectedRack?.code}
            cells={cells}
            selectedCellId={selectedCell?.id}
            onSelectCell={(cell) => setChosenCellId(cell.id)}
            onActivateCell={activateCell}
          />
        )
      ) : (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          <Boxes className="mx-auto mb-2 size-5" />
          Chọn rack trên bản đồ để mở mặt kệ.
        </div>
      )}
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
    </div>
  );
}
