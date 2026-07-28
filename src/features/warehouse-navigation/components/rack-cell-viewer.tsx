"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Box, Grid3X3, LoaderCircle, PackageOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StorageCellView } from "../services/warehouse-operations.service";

const RackScene = dynamic(() => import("./rack-scene"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[420px] place-items-center text-sm text-muted-foreground">
      <LoaderCircle className="mr-2 inline size-4 animate-spin" />
      Đang mở mô hình kệ...
    </div>
  ),
});

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
}: {
  cells: StorageCellView[];
  selectedCellId?: string;
  onSelectCell: (cell: StorageCellView) => void;
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
          className="grid min-w-[480px] gap-2"
          style={{
            gridTemplateColumns: `72px repeat(${bays}, minmax(110px, 1fr))`,
          }}
        >
          <div className="flex items-center text-xs font-semibold text-slate-500">
            Tầng {level}
          </div>
          {Array.from({ length: bays }, (_, index) => index + 1).map((bay) => {
            const cell = byCoordinate.get(`${level}:${bay}`);
            if (!cell)
              return (
                <div key={bay} className="h-24 rounded border border-dashed" />
              );
            const count = cell.contents.reduce(
              (sum, item) => sum + item.packageCount,
              0,
            );
            return (
              <button
                key={cell.id}
                className={cn(
                  "h-24 rounded-lg border p-2 text-left transition hover:border-blue-400 hover:bg-blue-50",
                  selectedCellId === cell.id
                    ? "border-amber-500 bg-amber-50 ring-2 ring-amber-200"
                    : "bg-white",
                )}
                onClick={() => onSelectCell(cell)}
                type="button"
              >
                <span className="block font-mono text-xs font-bold">
                  {cell.code}
                </span>
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  Khoang {bay} · {cell.fillPercent}% đầy
                </span>
                <span className="mt-2 block text-xs font-semibold">
                  {count} thùng · {cell.contents.length} SKU/lô
                </span>
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
}: {
  rackCode?: string;
  cells: StorageCellView[];
  selectedCellId?: string;
  onSelectCell: (cell: StorageCellView) => void;
  onActivateCell: (cell: StorageCellView) => void;
}) {
  const [webGlAvailable, setWebGlAvailable] = useState<boolean>();
  const [mode, setMode] = useState<"3D" | "GRID">("3D");
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const available = supportsWebGl();
      setWebGlAvailable(available);
      if (!available) setMode("GRID");
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const selected = useMemo(
    () => cells.find((cell) => cell.id === selectedCellId),
    [cells, selectedCellId],
  );
  return (
    <div className="overflow-hidden rounded-xl border bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-50 px-3 py-2">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Box className="size-4 text-blue-700" />
            Mặt kệ {rackCode ?? "đã chọn"}
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Mức đầy và danh sách thùng là dữ liệu thật; vị trí thùng trong
            khoang chỉ được tổng hợp.
          </p>
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={mode === "3D" ? "default" : "outline"}
            disabled={webGlAvailable === false}
            onClick={() => setMode("3D")}
            type="button"
          >
            <Box data-icon="inline-start" />
            3D
          </Button>
          <Button
            size="sm"
            variant={mode === "GRID" ? "default" : "outline"}
            onClick={() => setMode("GRID")}
            type="button"
          >
            <Grid3X3 data-icon="inline-start" />
            Lưới
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
            />
          )}
        </div>
        <aside className="p-3">
          {selected ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
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
                        {item.packageCount} thùng · {item.quantity} {item.unit}
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
                onClick={() => onActivateCell(selected)}
                type="button"
              >
                Chọn khoang và quét mã
              </Button>
            </div>
          ) : (
            <div className="grid min-h-56 place-items-center text-center text-sm text-muted-foreground">
              Chọn một khoang trên mô hình kệ để xem tồn.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
