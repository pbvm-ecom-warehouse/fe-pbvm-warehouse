"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQueries, useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Barcode,
  CheckCircle2,
  Loader2,
  MapPinned,
  Navigation,
  PackageCheck,
  RotateCcw,
  Ruler,
  ShieldCheck,
  Warehouse,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getWarehouseLayout } from "@/features/warehouse-layout/services/warehouse-layout.service";
import { buildLayoutRoute } from "@/features/warehouse-layout/utils/warehouse-layout";
import { useSessionUser } from "@/hooks/use-session-user";
import { isMissingBackendEndpoint } from "@/lib/api-contract";
import { hasAnyRole } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import type { PutawaySuggestion, ShelfContentItem, WarehouseShelf } from "@/types/api";

import { RouteGuidance } from "./route-guidance";
import {
  WarehouseArchitectureScene,
  type WarehouseSceneMode,
} from "./warehouse-architecture-scene";
import {
  listPutawaySuggestionResult,
  listShelfContents,
} from "../services/putaway-navigation.service";
import {
  buildNavigationPath,
  buildRouteToShelf,
  describeShelfGranularity,
  getRackCodesForZone,
  getShelfDimensionsLabel,
  getZoneCodes,
  groupShelvesByRack,
  selectSuggestedShelf,
} from "../utils/putaway-navigation";

const defaultPutawayInput = {
  sku: "CUP-BLANK-500",
  quantity: 80,
  warehouseId: "central",
};

function uniqueShelves(shelves: WarehouseShelf[]) {
  const byCode = new Map<string, WarehouseShelf>();

  shelves.forEach((shelf) => {
    byCode.set(shelf.code, shelf);
  });

  return Array.from(byCode.values());
}

function FilterChip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className="rounded-full border px-3 py-1.5 text-xs font-semibold transition hover:bg-accent/60 focus-visible:ring-3 focus-visible:ring-ring/30 data-[active=true]:border-primary/40 data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
      data-active={active}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

export function WarehouseNavigationClient() {
  const user = useSessionUser();
  const [sku, setSku] = useState(defaultPutawayInput.sku);
  const [quantity, setQuantity] = useState(defaultPutawayInput.quantity);
  const [suggestions, setSuggestions] = useState<PutawaySuggestion[]>([]);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [selectedRackCode, setSelectedRackCode] = useState<string | null>(null);
  const [sceneMode, setSceneMode] = useState<WarehouseSceneMode>("map");
  const [scanSku, setScanSku] = useState(defaultPutawayInput.sku);
  const [scanShelf, setScanShelf] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [zoneFilter, setZoneFilter] = useState<string | "ALL">("ALL");
  const [rackFilter, setRackFilter] = useState<string | "ALL">("ALL");

  const allShelves = useMemo(
    () => uniqueShelves(suggestions.map((item) => item.shelf)),
    [suggestions],
  );
  const layoutQuery = useQuery({
    queryFn: () =>
      getWarehouseLayout(defaultPutawayInput.warehouseId, "published"),
    queryKey: [
      "warehouse-layout",
      defaultPutawayInput.warehouseId,
      "published",
    ],
    retry: false,
  });
  const layoutUnsupported =
    layoutQuery.isError && isMissingBackendEndpoint(layoutQuery.error);
  const publishedLayout = layoutQuery.isError ? null : (layoutQuery.data ?? null);
  const layoutSource = layoutUnsupported
    ? "unsupported"
    : publishedLayout
      ? "api"
      : "missing";
  const displayLayout = useMemo(() => {
    if (!publishedLayout) {
      return null;
    }

    const zoneIds = new Set(
      publishedLayout.zones
        .filter((zone) => zoneFilter === "ALL" || zone.code === zoneFilter)
        .map((zone) => zone.id),
    );

    return {
      ...publishedLayout,
      zones: publishedLayout.zones.filter((zone) => zoneIds.has(zone.id)),
      racks: publishedLayout.racks.filter(
        (rack) =>
          zoneIds.has(rack.zoneId) &&
          (rackFilter === "ALL" || rack.code === rackFilter),
      ),
    };
  }, [publishedLayout, rackFilter, zoneFilter]);
  const zoneCodes = useMemo(() => getZoneCodes(allShelves), [allShelves]);
  const rackCodes = useMemo(
    () => getRackCodesForZone(allShelves, zoneFilter),
    [allShelves, zoneFilter],
  );
  const primarySuggestion = useMemo(
    () => selectSuggestedShelf(suggestions),
    [suggestions],
  );
  const exactSelectedSuggestion = useMemo(
    () =>
      selectedCode
        ? suggestions.find((suggestion) => suggestion.shelf.code === selectedCode) ??
          null
        : null,
    [selectedCode, suggestions],
  );
  const selectedShelf = useMemo(
    () =>
      allShelves.find((shelf) => shelf.code === selectedCode) ??
      primarySuggestion?.shelf ??
      null,
    [allShelves, primarySuggestion, selectedCode],
  );
  const selectedRoute = selectedShelf
    ? publishedLayout
      ? buildLayoutRoute(
          publishedLayout,
          selectedShelf.rackCode,
          selectedShelf.code,
        ) ?? exactSelectedSuggestion?.route ?? buildRouteToShelf(selectedShelf)
      : exactSelectedSuggestion?.route ?? buildRouteToShelf(selectedShelf)
    : primarySuggestion?.route ?? null;
  const selectedPath = selectedShelf
    ? buildNavigationPath(selectedShelf).join(" / ")
    : "Chưa chọn shelf";
  const capacityUsage =
    exactSelectedSuggestion && exactSelectedSuggestion.capacity > 0
      ? Math.min(
          100,
          Math.round((quantity / exactSelectedSuggestion.capacity) * 100),
        )
      : 0;
  const suggestedShelfCodes = useMemo(
    () => new Set(suggestions.map((suggestion) => suggestion.shelf.code)),
    [suggestions],
  );
  const selectedRackGroup = useMemo(
    () =>
      groupShelvesByRack(allShelves).find(
        (group) => group.rackCode === selectedRackCode,
      ) ?? null,
    [allShelves, selectedRackCode],
  );
  const selectedRackShelves = useMemo(
    () => selectedRackGroup?.shelves ?? [],
    [selectedRackGroup],
  );
  const canManageStructure = hasAnyRole(user?.roles, ["MANAGER"]);

  const shelfContentQueries = useQueries({
    queries: selectedRackShelves.map((shelf) => ({
      enabled: sceneMode === "rack" && Boolean(selectedRackGroup),
      queryFn: () =>
        listShelfContents({
          shelfCode: shelf.code,
          warehouseId: defaultPutawayInput.warehouseId,
        }),
      queryKey: [
        "warehouse-navigation",
        "shelf-contents",
        defaultPutawayInput.warehouseId,
        shelf.code,
      ],
    })),
  });

  const contentsByShelf = useMemo(() => {
    const next: Record<string, ShelfContentItem[] | undefined> = {};

    selectedRackShelves.forEach((shelf, index) => {
      next[shelf.code] = shelfContentQueries[index]?.data;
    });

    return next;
  }, [selectedRackShelves, shelfContentQueries]);
  const loadingShelfCodes = useMemo(
    () =>
      new Set(
        selectedRackShelves
          .filter((_, index) => shelfContentQueries[index]?.isLoading)
          .map((shelf) => shelf.code),
      ),
    [selectedRackShelves, shelfContentQueries],
  );
  const erroredShelfCodes = useMemo(
    () =>
      new Set(
        selectedRackShelves
          .filter((_, index) => shelfContentQueries[index]?.isError)
          .map((shelf) => shelf.code),
      ),
    [selectedRackShelves, shelfContentQueries],
  );
  const unsupportedShelfCodes = useMemo(
    () =>
      new Set(
        selectedRackShelves
          .filter((_, index) =>
            isMissingBackendEndpoint(shelfContentQueries[index]?.error),
          )
          .map((shelf) => shelf.code),
      ),
    [selectedRackShelves, shelfContentQueries],
  );

  const suggestionMutation = useMutation({
    mutationFn: listPutawaySuggestionResult,
    onError: () => {
      setSuggestions([]);
      setSelectedCode(null);
      setSelectedRackCode(null);
      setScanShelf("");
      setConfirmed(false);
      setSceneMode("map");
    },
    onSuccess: (result, variables) => {
      const nextSuggestions = result.suggestions;
      const nextSelected = selectSuggestedShelf(nextSuggestions);

      setSuggestions(nextSuggestions);
      setSelectedCode(nextSelected?.shelf.code ?? null);
      setSelectedRackCode(nextSelected?.shelf.rackCode ?? null);
      setScanSku(variables.sku);
      setScanShelf(nextSelected?.shelf.barcode ?? "");
      setConfirmed(false);
      setSceneMode("map");
      setZoneFilter("ALL");
      setRackFilter("ALL");
    },
  });

  function handleSelectShelf(shelfCode: string) {
    const nextShelf = allShelves.find((shelf) => shelf.code === shelfCode);

    setSelectedCode(shelfCode);
    setSelectedRackCode(nextShelf?.rackCode ?? selectedRackCode);
    setScanShelf(nextShelf?.barcode ?? "");
    setConfirmed(false);
  }

  function handleFocusRack(rackCode: string, shelfCode: string) {
    const nextShelf = allShelves.find((shelf) => shelf.code === shelfCode);

    setSelectedRackCode(rackCode);
    setSelectedCode(shelfCode);
    setScanShelf(nextShelf?.barcode ?? "");
    setConfirmed(false);
  }

  function handleOpenRack(rackCode: string, shelfCode: string) {
    handleFocusRack(rackCode, shelfCode);
    setSceneMode("rack");
  }

  function handleRetryShelf(shelfCode: string) {
    const index = selectedRackShelves.findIndex((shelf) => shelf.code === shelfCode);

    void shelfContentQueries[index]?.refetch();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    suggestionMutation.mutate({
      sku,
      quantity,
      warehouseId: defaultPutawayInput.warehouseId,
    });
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="space-y-4">
        <Card>
          <CardHeader className="border-b bg-muted/20">
            <CardTitle className="flex items-center gap-2 text-xl">
              <MapPinned className="size-5 text-primary" />
              Điều hướng put-away
            </CardTitle>
            <CardDescription>
              Sơ đồ 2.5D từ cổng vào đến target shelf; receiver vẫn xác nhận
              bằng barcode.
            </CardDescription>
            <CardAction>
              <Badge variant="secondary">
                <Navigation data-icon="inline-start" />
                {selectedShelf?.code ?? "No target"}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <FilterChip
                active={zoneFilter === "ALL"}
                onClick={() => {
                  setZoneFilter("ALL");
                  setRackFilter("ALL");
                }}
              >
                Tất cả zone
              </FilterChip>
              {zoneCodes.map((zoneCode) => (
                <FilterChip
                  active={zoneFilter === zoneCode}
                  key={zoneCode}
                  onClick={() => {
                    setZoneFilter(zoneCode);
                    setRackFilter("ALL");
                  }}
                >
                  Zone {zoneCode}
                </FilterChip>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <FilterChip
                active={rackFilter === "ALL"}
                onClick={() => setRackFilter("ALL")}
              >
                Tất cả rack
              </FilterChip>
              {rackCodes.map((rackCode) => {
                const rackGroup = groupShelvesByRack(allShelves, {
                  rackCode,
                  zoneCode: zoneFilter,
                })[0];
                const shelfCode = rackGroup?.shelves[0]?.code;

                return (
                  <FilterChip
                    active={rackFilter === rackCode}
                    key={rackCode}
                    onClick={() => {
                      setRackFilter(rackCode);
                      if (shelfCode) {
                        handleFocusRack(rackCode, shelfCode);
                      }
                    }}
                  >
                    Rack {rackCode}
                  </FilterChip>
                );
              })}
            </div>

            <WarehouseArchitectureScene
              contentsByShelf={contentsByShelf}
              erroredShelfCodes={erroredShelfCodes}
              layout={displayLayout}
              layoutSource={layoutSource}
              loadingShelfCodes={loadingShelfCodes}
              onBackToMap={() => setSceneMode("map")}
              onOpenRack={handleOpenRack}
              onRetryShelf={handleRetryShelf}
              onSelectShelf={handleSelectShelf}
              rackGroup={selectedRackGroup}
              route={selectedRoute}
              sceneMode={sceneMode}
              selectedRackCode={selectedRackCode}
              selectedShelfCode={selectedShelf?.code ?? null}
              suggestions={suggestions}
              suggestedShelfCodes={suggestedShelfCodes}
              unsupportedShelfCodes={unsupportedShelfCodes}
            />
          </CardContent>
        </Card>

        <RouteGuidance route={selectedRoute} />

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Gợi ý kệ</CardTitle>
            <CardDescription>
              Advisory only: receiver có thể override, miễn quét đúng barcode
              shelf trước khi xác nhận.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {suggestionMutation.isError &&
            isMissingBackendEndpoint(suggestionMutation.error) ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Chưa có gợi ý vị trí cho yêu cầu này.
              </div>
            ) : null}

            {suggestions.length === 0 ? (
              <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
                Không có shelf đủ sức chứa cho SKU và số lượng này.
              </div>
            ) : (
              suggestions.map((suggestion) => (
                <button
                  className="grid gap-2 rounded-lg border border-border/70 bg-card p-3 text-left text-sm transition hover:bg-accent/60 focus-visible:ring-3 focus-visible:ring-ring/40 data-[active=true]:border-primary/50 data-[active=true]:bg-primary/5"
                  data-active={selectedShelf?.code === suggestion.shelf.code}
                  key={suggestion.shelf.code}
                  onClick={() => handleSelectShelf(suggestion.shelf.code)}
                  type="button"
                >
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">
                      {suggestion.shelf.code} · level {suggestion.shelf.level}
                    </span>
                    <Badge
                      variant={
                        selectedShelf?.code === suggestion.shelf.code
                          ? "default"
                          : "outline"
                      }
                    >
                      {suggestion.capacity} còn trống
                    </Badge>
                  </span>
                  <span className="text-muted-foreground">
                    {suggestion.pathLabel}
                  </span>
                  <span className="text-xs">{suggestion.reason}</span>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-4">
        <Card>
          <CardHeader className="border-b bg-muted/20">
            <CardTitle className="text-lg">Phiếu put-away</CardTitle>
            <CardDescription>
              Nhập SKU và số lượng để tìm vị trí put-away phù hợp.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={handleSubmit}>
              <div className="grid gap-2">
                <Label htmlFor="putawaySku">SKU</Label>
                <Input
                  autoComplete="off"
                  id="putawaySku"
                  name="putawaySku"
                  onChange={(event) => {
                    setSku(event.target.value);
                    setScanSku(event.target.value);
                  }}
                  value={sku}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="putawayQty">Số lượng</Label>
                <Input
                  id="putawayQty"
                  inputMode="numeric"
                  min={1}
                  name="putawayQty"
                  onChange={(event) =>
                    setQuantity(Math.max(Number(event.target.value), 1))
                  }
                  type="number"
                  value={quantity}
                />
              </div>
              <Button disabled={suggestionMutation.isPending} type="submit">
                {suggestionMutation.isPending ? (
                  <Loader2 className="animate-spin" data-icon="inline-start" />
                ) : (
                  <RotateCcw data-icon="inline-start" />
                )}
                {suggestionMutation.isPending ? "Đang tính…" : "Tính gợi ý"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Target shelf</CardTitle>
            <CardDescription>{selectedPath}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">
                    {selectedShelf?.code ?? "No shelf"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {exactSelectedSuggestion?.reason ??
                      "Override shelf hoặc chưa có gợi ý trực tiếp"}
                  </div>
                </div>
                <Badge variant="secondary">
                  <ShieldCheck data-icon="inline-start" />
                  Advisory
                </Badge>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-background">
                <div
                  className={cn(
                    "h-full rounded-full bg-primary",
                    !exactSelectedSuggestion && "bg-muted-foreground/40",
                  )}
                  style={{ width: `${capacityUsage}%` }}
                />
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {exactSelectedSuggestion
                  ? `Dự kiến dùng ${capacityUsage}% sức chứa gợi ý của shelf.`
                  : "Shelf override không có capacity usage từ gợi ý AI."}
              </div>
            </div>

            {selectedShelf ? (
              <div className="grid gap-3">
                <div className="rounded-lg border border-border/70 bg-card p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <PackageCheck className="size-4 text-primary" />
                    Thông tin shelf
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                    <div>
                      <span className="font-semibold text-foreground">Rack:</span>{" "}
                      {selectedShelf.rackName}
                    </div>
                    <div>
                      <span className="font-semibold text-foreground">Level:</span>{" "}
                      {selectedShelf.level}
                    </div>
                    <div>
                      <span className="font-semibold text-foreground">
                        Barcode:
                      </span>{" "}
                      {selectedShelf.barcode}
                    </div>
                    <div>
                      <span className="font-semibold text-foreground">
                        Kích thước:
                      </span>{" "}
                      {getShelfDimensionsLabel(selectedShelf)}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border/70 bg-card p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Ruler className="size-4 text-primary" />
                    Từng ngăn / granularity
                  </div>
                  <div className="mt-2 text-sm leading-6 text-muted-foreground">
                    {describeShelfGranularity(selectedShelf)}
                  </div>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Xác nhận scan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="scanSku">Barcode SKU</Label>
              <Input
                autoComplete="off"
                id="scanSku"
                name="scanSku"
                onChange={(event) => setScanSku(event.target.value)}
                value={scanSku}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="scanShelf">Barcode shelf</Label>
              <Input
                autoComplete="off"
                id="scanShelf"
                name="scanShelf"
                onChange={(event) => setScanShelf(event.target.value)}
                value={scanShelf}
              />
            </div>
            <Button
              className="w-full"
              disabled={!selectedShelf || !scanSku || !scanShelf}
              onClick={() => setConfirmed(true)}
            >
              <Barcode data-icon="inline-start" />
              Kiểm tra barcode
            </Button>
            {confirmed ? (
              <div
                className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm"
                role="status"
              >
                <CheckCircle2 className="size-4 text-primary" />
                Barcode đã khớp trên giao diện.
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cấu trúc vị trí</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                <div className="text-xs font-semibold text-muted-foreground">
                  Zone
                </div>
                <div className="font-mono text-lg font-bold">
                  {zoneCodes.length}
                </div>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                <div className="text-xs font-semibold text-muted-foreground">
                  Rack
                </div>
                <div className="font-mono text-lg font-bold">
                  {groupShelvesByRack(allShelves).length}
                </div>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                <div className="text-xs font-semibold text-muted-foreground">
                  Shelf
                </div>
                <div className="font-mono text-lg font-bold">
                  {allShelves.filter((shelf) => !shelf.isStaging).length}
                </div>
              </div>
            </div>

            {canManageStructure ? (
              <Button asChild className="w-full" variant="outline">
                <Link href="/warehouses">
                  <Warehouse data-icon="inline-start" />
                  Mở module Kho
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
