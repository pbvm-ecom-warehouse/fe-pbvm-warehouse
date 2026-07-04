"use client";

import { useEffect } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { ArrowLeft, Boxes, MapPinned, PackageOpen, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WarehouseFloorPlan } from "@/features/warehouse-layout/components/warehouse-floor-plan";
import { cn } from "@/lib/utils";
import type {
  PutawaySuggestion,
  ShelfContentItem,
  WarehouseLayout,
  WarehouseRoute,
  WarehouseShelf,
} from "@/types/api";

import {
  getShelfDimensionsLabel,
  normalizeShelfBoxPlacement,
  type RackGroup,
} from "../utils/putaway-navigation";

export type WarehouseSceneMode = "map" | "rack";

function contentTone(item: ShelfContentItem) {
  if (item.status === "EXPIRED") {
    return "border-red-500 bg-red-100 text-red-950";
  }
  if (item.status === "RESERVED") {
    return "border-amber-500 bg-amber-100 text-amber-950";
  }
  if (item.containerType === "crate") {
    return "border-teal-600 bg-teal-100 text-teal-950";
  }
  if (item.containerType === "pallet") {
    return "border-slate-500 bg-slate-200 text-slate-950";
  }
  if (item.containerType === "bag") {
    return "border-emerald-600 bg-emerald-100 text-emerald-950";
  }

  return "border-sky-600 bg-sky-100 text-sky-950";
}

function TechnicalBox({
  item,
  index,
}: {
  item: ShelfContentItem;
  index: number;
}) {
  const placement = normalizeShelfBoxPlacement(item, index);

  return (
    <div
      aria-label={`${item.itemName}, ${item.sku}, ${item.quantity} ${item.unit}`}
      className={cn(
        "absolute overflow-hidden border px-1.5 py-1 shadow-sm",
        contentTone(item),
      )}
      style={{
        height: `${placement.height}%`,
        left: `${placement.x}%`,
        top: `${placement.y}%`,
        transform: `translateY(${-placement.z}px) rotate(${placement.rotationDeg}deg)`,
        width: `${placement.width}%`,
      }}
      title={item.itemName}
    >
      <div className="truncate text-[10px] font-bold leading-tight">
        {placement.label}
      </div>
      <div className="truncate font-mono text-[9px] leading-tight">{item.sku}</div>
      <div className="truncate text-[9px] leading-tight">
        {item.quantity} {item.unit}
        {item.lotNumber ? ` · ${item.lotNumber}` : ""}
      </div>
    </div>
  );
}

function TechnicalShelfLevel({
  contents,
  error,
  loading,
  onRetry,
  onSelectShelf,
  selected,
  shelf,
  suggested,
  unsupported,
}: {
  contents: ShelfContentItem[];
  error: boolean;
  loading: boolean;
  onRetry: () => void;
  onSelectShelf: (shelfCode: string) => void;
  selected: boolean;
  shelf: WarehouseShelf;
  suggested: boolean;
  unsupported: boolean;
}) {
  const estimated = contents.some((item) => !item.placement);

  return (
    <section
      className={cn(
        "grid min-h-[128px] grid-cols-[104px_minmax(0,1fr)] border-x-[6px] border-b-[6px] border-slate-600 bg-white",
        selected && "relative z-10 ring-3 ring-primary/30",
      )}
    >
      <button
        aria-pressed={selected}
        className="border-r border-slate-300 bg-slate-50 p-3 text-left focus-visible:ring-3 focus-visible:ring-ring/40"
        onClick={() => onSelectShelf(shelf.code)}
        type="button"
      >
        <span className="block text-[10px] font-semibold uppercase text-slate-500">
          Level {shelf.level}
        </span>
        <span className="mt-1 block font-mono text-sm font-bold">{shelf.code}</span>
        <span className="mt-1 block truncate text-[10px] text-slate-500">
          {shelf.barcode}
        </span>
        {suggested ? <Badge className="mt-2">Suggested</Badge> : null}
        <span className="sr-only">Chọn shelf {shelf.code}</span>
      </button>

      <div className="relative min-w-[360px] overflow-hidden bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f4_100%)]">
        <div className="absolute inset-x-3 top-2 text-[10px] text-slate-500">
          {getShelfDimensionsLabel(shelf)}
        </div>

        {loading ? (
          <div className="absolute inset-0 grid content-center gap-2 p-5">
            <Skeleton className="h-9 w-2/3" />
            <Skeleton className="h-9 w-1/2" />
          </div>
        ) : error ? (
          <div className="absolute inset-0 grid place-items-center p-4 text-center text-sm">
            <div>
              <div className="font-semibold text-destructive">
                {unsupported
                  ? "Chưa có dữ liệu trong kệ"
                  : `Không tải được thùng trong ${shelf.code}`}
              </div>
              {unsupported ? null : (
                <Button
                  className="mt-2 h-8"
                  onClick={onRetry}
                  size="sm"
                  variant="outline"
                >
                  <RefreshCw data-icon="inline-start" />
                  Tải lại
                </Button>
              )}
            </div>
          </div>
        ) : contents.length === 0 ? (
          <div className="absolute inset-0 grid place-items-center px-4 text-sm text-muted-foreground">
            Kệ đang trống.
          </div>
        ) : (
          <div className="absolute inset-x-4 bottom-3 top-7 overflow-hidden border-x border-dashed border-slate-300">
            {contents.map((item, index) => (
              <TechnicalBox index={index} item={item} key={item.id} />
            ))}
          </div>
        )}

        {estimated ? (
          <div className="absolute bottom-1 right-2 bg-white/90 px-1.5 py-0.5 text-[9px] text-slate-600">
            vị trí tương đối
          </div>
        ) : null}
      </div>
    </section>
  );
}

function RackElevation({
  contentsByShelf,
  erroredShelfCodes,
  loadingShelfCodes,
  onBackToMap,
  onRetryShelf,
  onSelectShelf,
  rackGroup,
  selectedShelfCode,
  suggestedShelfCodes,
  unsupportedShelfCodes,
}: {
  contentsByShelf: Record<string, ShelfContentItem[] | undefined>;
  erroredShelfCodes: Set<string>;
  loadingShelfCodes: Set<string>;
  onBackToMap: () => void;
  onRetryShelf: (shelfCode: string) => void;
  onSelectShelf: (shelfCode: string) => void;
  rackGroup: RackGroup | null;
  selectedShelfCode: string | null;
  suggestedShelfCodes: Set<string>;
  unsupportedShelfCodes: Set<string>;
}) {
  if (!rackGroup) {
    return (
      <div className="grid min-h-[420px] place-items-center border border-dashed text-sm text-muted-foreground">
        Chọn rack trên mặt bằng để xem mặt đứng.
      </div>
    );
  }

  return (
    <motion.div
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="min-h-[620px] border border-slate-300 bg-[#f4f6f5] p-4"
      exit={{ opacity: 0, scale: 0.96, y: 20 }}
      initial={{ opacity: 0, scale: 0.94, y: 24 }}
      key="rack-elevation"
      transition={{ type: "spring", stiffness: 210, damping: 28 }}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Button onClick={onBackToMap} size="sm" variant="outline">
          <ArrowLeft data-icon="inline-start" />
          Quay lại mặt bằng
        </Button>
        <Badge variant="secondary">Esc để zoom ra</Badge>
      </div>

      <div className="mx-auto max-w-5xl">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold">{rackGroup.rackName}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Mặt đứng kỹ thuật · {rackGroup.warehouseCode} / {rackGroup.zoneName}
            </p>
          </div>
          <div className="font-mono text-xs text-slate-600">
            {rackGroup.shelves.length} tầng
          </div>
        </div>

        <div className="overflow-x-auto border-t-[8px] border-slate-600 bg-slate-200/40 p-3">
          <div className="min-w-[620px]">
            {rackGroup.shelves.map((shelf) => (
              <TechnicalShelfLevel
                contents={contentsByShelf[shelf.code] ?? []}
                error={erroredShelfCodes.has(shelf.code)}
                key={shelf.id}
                loading={loadingShelfCodes.has(shelf.code)}
                onRetry={() => onRetryShelf(shelf.code)}
                onSelectShelf={onSelectShelf}
                selected={shelf.code === selectedShelfCode}
                shelf={shelf}
                suggested={suggestedShelfCodes.has(shelf.code)}
                unsupported={unsupportedShelfCodes.has(shelf.code)}
              />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function WarehouseArchitectureScene({
  contentsByShelf,
  erroredShelfCodes,
  layout,
  layoutSource,
  loadingShelfCodes,
  onBackToMap,
  onOpenRack,
  onRetryShelf,
  onSelectShelf,
  rackGroup,
  route,
  sceneMode,
  selectedRackCode,
  selectedShelfCode,
  suggestions,
  suggestedShelfCodes,
  unsupportedShelfCodes,
}: {
  contentsByShelf: Record<string, ShelfContentItem[] | undefined>;
  erroredShelfCodes: Set<string>;
  layout: WarehouseLayout | null;
  layoutSource: "api" | "missing" | "unsupported";
  loadingShelfCodes: Set<string>;
  onBackToMap: () => void;
  onOpenRack: (rackCode: string, shelfCode: string) => void;
  onRetryShelf: (shelfCode: string) => void;
  onSelectShelf: (shelfCode: string) => void;
  rackGroup: RackGroup | null;
  route: WarehouseRoute | null;
  sceneMode: WarehouseSceneMode;
  selectedRackCode: string | null;
  selectedShelfCode: string | null;
  suggestions: PutawaySuggestion[];
  suggestedShelfCodes: Set<string>;
  unsupportedShelfCodes: Set<string>;
}) {
  useEffect(() => {
    if (sceneMode !== "rack") {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onBackToMap();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onBackToMap, sceneMode]);

  return (
    <section className="border border-border/70 bg-card p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-base font-semibold">
            <MapPinned className="size-5 text-primary" />
            Mặt bằng kho
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Bản vẽ top-down theo zone, rack và bề rộng lối đi đã publish.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={route ? "default" : "outline"}>
            {route ? `${route.from.code} → ${route.to.code}` : "Chưa có route"}
          </Badge>
          <Badge variant="outline">
            <Boxes data-icon="inline-start" />
            {sceneMode === "rack" ? "Mặt đứng rack" : "Mặt bằng"}
          </Badge>
          {layoutSource !== "api" ? (
            <Badge variant="secondary">
              {layoutSource === "unsupported"
                ? "Chưa có layout"
                : "Chưa publish"}
            </Badge>
          ) : null}
        </div>
      </div>

      <MotionConfig reducedMotion="user">
        <AnimatePresence mode="wait">
          {sceneMode === "rack" ? (
            <RackElevation
              contentsByShelf={contentsByShelf}
              erroredShelfCodes={erroredShelfCodes}
              loadingShelfCodes={loadingShelfCodes}
              onBackToMap={onBackToMap}
              onRetryShelf={onRetryShelf}
              onSelectShelf={onSelectShelf}
              rackGroup={rackGroup}
              selectedShelfCode={selectedShelfCode}
              suggestedShelfCodes={suggestedShelfCodes}
              unsupportedShelfCodes={unsupportedShelfCodes}
            />
          ) : layout ? (
            <motion.div
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              initial={{ opacity: 0, scale: 0.98 }}
              key="floor-plan"
              transition={{ duration: 0.24 }}
            >
              <WarehouseFloorPlan
                layout={layout}
                onOpenRack={onOpenRack}
                route={route}
                selectedRackCode={selectedRackCode}
              />
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-2">
                  <span className="h-3 w-6 border border-slate-500 bg-slate-200" />
                  Rack
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-3 w-6 bg-[#dfe5e7]" />
                  Đường chính
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-3 w-6 bg-[#edf0ef]" />
                  Lối giữa rack
                </span>
              </div>
            </motion.div>
          ) : (
            <div className="grid min-h-[420px] place-items-center border border-dashed p-8 text-center">
              <div>
                <MapPinned className="mx-auto size-8 text-muted-foreground" />
                <h3 className="mt-3 font-semibold">Kho chưa có bản vẽ mặt bằng</h3>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  Admin cần mở module Kho, bố trí zone/rack/aisle và Publish trước
                  khi dùng điều hướng.
                </p>
              </div>
            </div>
          )}
        </AnimatePresence>
      </MotionConfig>

      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <PackageOpen className="size-4" />
        {suggestions.length} gợi ý đang dùng cùng hệ tọa độ với layout.
      </div>
    </section>
  );
}
