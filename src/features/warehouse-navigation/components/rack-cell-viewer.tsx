"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import {
  Box,
  CircleCheck,
  Grid3X3,
  LoaderCircle,
  LockKeyhole,
  PackageOpen,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StorageCellView } from "../services/warehouse-operations.service";
import { getRackMeasurements } from "../utils/rack-3d-layout";
import { evaluateCellCapacity } from "../utils/cell-capacity";
import type { PutawayPackageSpec } from "../utils/putaway-work-items";

const RackScene = dynamic(() => import("./rack-scene"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[420px] place-items-center text-sm text-muted-foreground">
      <LoaderCircle className="mr-2 inline size-4 animate-spin" />
      Đang mở mô hình kệ...
    </div>
  ),
});

type ViewerCellState = {
  selectable: boolean;
  suggested: boolean;
  statusLabel: string;
  remainingPackages?: number;
  tone: "available" | "blocked" | "full" | "occupied" | "suggested";
};

function supportsWebGl() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function CellGrid({
  cells,
  selectedCellId,
  onSelectCell,
  getState,
}: {
  cells: StorageCellView[];
  selectedCellId?: string;
  onSelectCell: (cell: StorageCellView) => void;
  getState: (cell: StorageCellView) => ViewerCellState;
}) {
  const levels = Math.max(1, ...cells.map((cell) => cell.level));
  const bays = Math.max(1, ...cells.map((cell) => cell.bay));
  const byCoordinate = new Map(
    cells.map((cell) => [`${cell.level}:${cell.bay}`, cell]),
  );
  return (
    <div className="space-y-2 overflow-auto p-3">
      {Array.from({ length: levels }, (_, row) => levels - row).map((level) => (
        <div
          key={level}
          className="grid min-w-[520px] gap-2"
          style={{
            gridTemplateColumns: `72px repeat(${bays}, minmax(120px, 1fr))`,
          }}
        >
          <div className="flex items-center text-xs font-semibold text-slate-500">
            Tầng {level}
          </div>
          {Array.from({ length: bays }, (_, index) => index + 1).map((bay) => {
            const cell = byCoordinate.get(`${level}:${bay}`);
            if (!cell)
              return (
                <div key={bay} className="h-28 rounded border border-dashed" />
              );
            const count = cell.contents.reduce(
              (sum, item) => sum + item.quantity,
              0,
            );
            const state = getState(cell);
            return (
              <button
                key={cell.id}
                className={cn(
                  "relative h-28 rounded-lg border p-2 text-left transition hover:border-blue-400",
                  selectedCellId === cell.id &&
                    "border-amber-500 ring-2 ring-amber-200",
                  state.tone === "suggested" && "border-blue-600 bg-blue-50",
                  state.tone === "available" &&
                    "border-emerald-300 bg-emerald-50/60",
                  state.tone === "occupied" && "bg-white",
                  (state.tone === "blocked" || state.tone === "full") &&
                    "border-slate-200 bg-slate-100 text-slate-500",
                )}
                onClick={() => onSelectCell(cell)}
                type="button"
              >
                <span className="block font-mono text-xs font-bold">
                  {cell.code}
                </span>
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  {cell.fillPercent}% đầy · {count} thùng
                </span>
                <span className="mt-2 block text-xs font-semibold">
                  {state.statusLabel}
                </span>
                {state.remainingPackages !== undefined ? (
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    Còn vừa {state.remainingPackages} thùng
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function RackCellViewer({
  rackCode,
  cells,
  selectedCellId,
  onSelectCell,
  onActivateCell,
  operation = "PUTAWAY",
  packageSpec,
  suggestedCellIds = [],
}: {
  rackCode?: string;
  cells: StorageCellView[];
  selectedCellId?: string;
  onSelectCell: (cell: StorageCellView) => void;
  onActivateCell: (cell: StorageCellView) => void;
  operation?: "PUTAWAY" | "PICK";
  packageSpec?: PutawayPackageSpec;
  suggestedCellIds?: string[];
}) {
  const [webGlAvailable, setWebGlAvailable] = useState<boolean>();
  const [mode, setMode] = useState<"3D" | "GRID">("GRID");
  const suggestedSet = useMemo(
    () => new Set(suggestedCellIds),
    [suggestedCellIds],
  );
  const selected = useMemo(
    () => cells.find((cell) => cell.id === selectedCellId),
    [cells, selectedCellId],
  );
  const rackMeasurements = useMemo(() => getRackMeasurements(cells), [cells]);

  function getState(cell: StorageCellView): ViewerCellState {
    const suggested = suggestedSet.has(cell.id);
    if (operation === "PICK") {
      return {
        selectable: suggested,
        suggested,
        statusLabel: suggested ? "Vị trí cần lấy" : "Chỉ xem",
        tone: suggested
          ? "suggested"
          : cell.contents.length
            ? "occupied"
            : "available",
      };
    }
    const evaluation = evaluateCellCapacity(cell, packageSpec, { suggested });
    const labels = {
      AVAILABLE: suggested ? "Đề xuất" : "Trống · có thể cất",
      BLOCKED: "Khoang bị khóa",
      FULL: "Khoang đã đầy",
      DIMENSION_MISMATCH: "Thùng không vừa",
      OCCUPIED_OVERRIDE: "Đang chứa hàng · chỉ xem",
    } as const;
    return {
      selectable: evaluation.selectable,
      suggested,
      statusLabel: labels[evaluation.reason],
      remainingPackages: evaluation.remainingPackages,
      tone: evaluation.locked
        ? "blocked"
        : evaluation.full || !evaluation.dimensionFits
          ? "full"
          : suggested
            ? "suggested"
            : evaluation.override
              ? "available"
              : "occupied",
    };
  }

  const selectedState = selected ? getState(selected) : undefined;

  return (
    <div className="overflow-hidden rounded-xl border bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-50 px-3 py-2">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Box className="size-4 text-blue-700" />
            Mặt kệ {rackCode ?? "đã chọn"}
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Kệ {rackMeasurements.widthM.toLocaleString("vi-VN")} ×{" "}
            {rackMeasurements.depthM.toLocaleString("vi-VN")} ×{" "}
            {rackMeasurements.heightM.toLocaleString("vi-VN")} m ·{" "}
            {rackMeasurements.levels} tầng · {rackMeasurements.bays} khoang
          </p>
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={mode === "GRID" ? "default" : "outline"}
            onClick={() => setMode("GRID")}
            type="button"
          >
            <Grid3X3 data-icon="inline-start" />
            2D
          </Button>
          <Button
            size="sm"
            variant={mode === "3D" ? "default" : "outline"}
            disabled={webGlAvailable === false}
            onClick={() => {
              const available = webGlAvailable ?? supportsWebGl();
              setWebGlAvailable(available);
              if (available) setMode("3D");
            }}
            type="button"
          >
            <Box data-icon="inline-start" />
            3D
          </Button>
        </div>
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-h-[420px] border-b lg:border-b-0 lg:border-r">
          {mode === "3D" && webGlAvailable ? (
            <RackScene
              cells={cells}
              selectedCellId={selectedCellId}
              onSelectCell={onSelectCell}
            />
          ) : (
            <CellGrid
              cells={cells}
              selectedCellId={selectedCellId}
              onSelectCell={onSelectCell}
              getState={getState}
            />
          )}
        </div>
        <aside className="p-3">
          {selected && selectedState ? (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-mono text-sm font-bold">
                    {selected.code}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Tầng {selected.level} · Khoang {selected.bay}
                  </div>
                </div>
                <Badge variant="outline">{selected.fillPercent}% đầy</Badge>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-blue-600"
                  style={{ width: `${Math.min(100, selected.fillPercent)}%` }}
                />
              </div>
              <div
                className={cn(
                  "flex items-start gap-2 rounded-lg border p-2 text-xs",
                  selectedState.selectable
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-amber-200 bg-amber-50 text-amber-800",
                )}
              >
                {selectedState.selectable ? (
                  <CircleCheck className="mt-0.5 size-4 shrink-0" />
                ) : selected.status === "BLOCKED" ? (
                  <LockKeyhole className="mt-0.5 size-4 shrink-0" />
                ) : (
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                )}
                <div>
                  <div className="font-semibold">
                    {selectedState.statusLabel}
                  </div>
                  {selectedState.remainingPackages !== undefined ? (
                    <div className="mt-0.5">
                      Khoang còn nhận tối đa {selectedState.remainingPackages}{" "}
                      thùng theo thể tích.
                    </div>
                  ) : null}
                </div>
              </div>
              {selected.contents.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                  <PackageOpen className="mx-auto mb-2 size-5" />
                  Khoang đang trống
                </div>
              ) : (
                <div className="space-y-2">
                  {selected.contents.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border bg-slate-50 p-2 text-xs"
                    >
                      <div className="font-mono font-semibold">{item.sku}</div>
                      <div className="mt-1 text-muted-foreground">
                        {item.itemName}
                      </div>
                      <div className="mt-1 font-medium">
                        {item.quantity} thùng
                      </div>
                      {item.lotNumber ? (
                        <div className="mt-1 text-muted-foreground">
                          Lô {item.lotNumber}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
              <Button
                className="w-full"
                disabled={!selectedState.selectable}
                onClick={() => onActivateCell(selected)}
                type="button"
              >
                {selectedState.selectable
                  ? "Chọn khoang và quét mã"
                  : "Khoang chỉ xem"}
              </Button>
            </div>
          ) : (
            <div className="grid min-h-56 place-items-center text-center text-sm text-muted-foreground">
              Chọn một khoang trên mặt kệ 2D để xem tồn và sức chứa.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
