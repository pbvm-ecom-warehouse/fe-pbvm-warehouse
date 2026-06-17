"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import {
  ArrowRight,
  Barcode,
  CheckCircle2,
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
import { useSessionUser } from "@/hooks/use-session-user";
import { listPutawaySuggestions } from "@/features/warehouse-navigation/services/putaway-navigation.service";
import {
  buildNavigationPath,
  describeShelfGranularity,
  fallbackPutawaySuggestions,
  fallbackShelves,
  getRackCodesForZone,
  getShelfDimensionsLabel,
  getZoneCodes,
  groupShelvesByRack,
  selectSuggestedShelf,
} from "@/features/warehouse-navigation/utils/putaway-navigation";
import { hasAnyRole } from "@/lib/rbac";
import type { PutawaySuggestion, WarehouseShelf } from "@/types/api";

const defaultPutawayInput = {
  sku: "CUP-BLANK-500",
  quantity: 80,
  warehouseId: "central",
};

const initialSuggestions = fallbackPutawaySuggestions(defaultPutawayInput);
const initialSelectedCode = initialSuggestions[0]?.shelf.code ?? null;

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
      type="button"
      className="rounded-full border px-3 py-1.5 text-xs font-semibold transition hover:bg-accent/60 data-[active=true]:border-primary/40 data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
      data-active={active}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function RackStackMap({
  onSelectShelf,
  selectedCode,
  shelves,
  suggestions,
  zoneCode,
  rackCode,
}: {
  onSelectShelf: (shelfCode: string) => void;
  selectedCode: string | null;
  shelves: WarehouseShelf[];
  suggestions: PutawaySuggestion[];
  zoneCode: string | "ALL";
  rackCode: string | "ALL";
}) {
  const groups = groupShelvesByRack(shelves, { rackCode, zoneCode });
  const suggestedCodes = new Set(suggestions.map((suggestion) => suggestion.shelf.code));
  const stagingShelf = shelves.find((shelf) => shelf.isStaging);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-3">
        {groups.map((group) => (
          <div
            className="rounded-lg border border-border/70 bg-card p-3"
            key={group.id}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">{group.rackName}</div>
                <div className="text-xs text-muted-foreground">
                  {group.warehouseCode} / {group.zoneName}
                </div>
              </div>
              <Badge variant="outline">
                {group.shelves.length} shelf
                {group.shelves.length > 1 ? "s" : ""}
              </Badge>
            </div>

            <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-3">
              <div className="space-y-2">
                {group.shelves.map((shelf) => {
                  const isSelected = shelf.code === selectedCode;
                  const isSuggested = suggestedCodes.has(shelf.code);

                  return (
                    <button
                      key={shelf.id}
                      type="button"
                      className="grid min-h-[92px] w-full grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border/70 bg-card px-3 py-2 text-left transition hover:bg-accent/60 data-[selected=true]:border-primary/40 data-[selected=true]:bg-primary/5"
                      data-selected={isSelected}
                      onClick={() => onSelectShelf(shelf.code)}
                    >
                      <div className="rounded-lg bg-muted px-2 py-2 text-center">
                        <div className="text-[11px] font-semibold text-muted-foreground">
                          Level
                        </div>
                        <div className="font-mono text-base font-bold">
                          {shelf.level}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{shelf.code}</span>
                          {isSuggested ? (
                            <Badge variant={isSelected ? "default" : "outline"}>
                              Suggested
                            </Badge>
                          ) : null}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {getShelfDimensionsLabel(shelf)}
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          Barcode: {shelf.barcode}
                        </div>
                      </div>
                      <div className="text-right text-[11px] font-semibold text-muted-foreground">
                        {shelf.rackCode}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {stagingShelf ? (
        <div className="rounded-lg border border-sky-200 bg-sky-50/80 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-sky-900">
                Staging / Receiving
              </div>
              <div className="text-xs text-sky-800/80">
                {stagingShelf.code} là shelf tạm sau GRN. Put-away luôn đi từ
                staging sang shelf thật.
              </div>
            </div>
            <Badge className="bg-white text-sky-800" variant="outline">
              {stagingShelf.barcode}
            </Badge>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function WarehouseNavigationClient() {
  const user = useSessionUser();
  const [sku, setSku] = useState(defaultPutawayInput.sku);
  const [quantity, setQuantity] = useState(defaultPutawayInput.quantity);
  const [suggestions, setSuggestions] =
    useState<PutawaySuggestion[]>(initialSuggestions);
  const [selectedCode, setSelectedCode] = useState<string | null>(
    initialSelectedCode,
  );
  const [scanSku, setScanSku] = useState(defaultPutawayInput.sku);
  const [scanShelf, setScanShelf] = useState(
    initialSuggestions[0]?.shelf.barcode ?? "",
  );
  const [confirmed, setConfirmed] = useState(false);
  const [zoneFilter, setZoneFilter] = useState<string | "ALL">("ALL");
  const [rackFilter, setRackFilter] = useState<string | "ALL">("ALL");

  const allShelves = useMemo(
    () => uniqueShelves([...fallbackShelves, ...suggestions.map((item) => item.shelf)]),
    [suggestions],
  );
  const zoneCodes = useMemo(() => getZoneCodes(allShelves), [allShelves]);
  const rackCodes = useMemo(
    () => getRackCodesForZone(allShelves, zoneFilter),
    [allShelves, zoneFilter],
  );
  const selectedSuggestion = useMemo(
    () =>
      suggestions.find((suggestion) => suggestion.shelf.code === selectedCode) ??
      selectSuggestedShelf(suggestions),
    [selectedCode, suggestions],
  );
  const selectedShelf = useMemo(
    () =>
      allShelves.find((shelf) => shelf.code === selectedCode) ??
      selectedSuggestion?.shelf ??
      null,
    [allShelves, selectedCode, selectedSuggestion],
  );
  const selectedPath = selectedShelf
    ? buildNavigationPath(selectedShelf).join(" / ")
    : "Chưa chọn shelf";
  const capacityUsage =
    selectedSuggestion && selectedSuggestion.capacity > 0
      ? Math.min(100, Math.round((quantity / selectedSuggestion.capacity) * 100))
      : 0;
  const canManageStructure = hasAnyRole(user?.roles, ["ADMIN", "MANAGER"]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextSuggestions = await listPutawaySuggestions({
      sku,
      quantity,
      warehouseId: "central",
    });
    const nextSelected = nextSuggestions[0];

    setSuggestions(nextSuggestions);
    setSelectedCode(nextSelected?.shelf.code ?? null);
    setScanSku(sku);
    setScanShelf(nextSelected?.shelf.barcode ?? "");
    setConfirmed(false);
    setZoneFilter(nextSelected?.shelf.zoneCode ?? "ALL");
    setRackFilter(nextSelected?.shelf.rackCode ?? "ALL");
  }

  function handleSelectShelf(shelfCode: string) {
    const nextShelf = allShelves.find((shelf) => shelf.code === shelfCode);

    setSelectedCode(shelfCode);
    setScanShelf(nextShelf?.barcode ?? "");
    setConfirmed(false);
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
              Render đúng mô hình `Zone → Rack → Shelf(level)`; shelf là barcode
              location nhỏ nhất hiện có trong docs.
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
              {rackCodes.map((rackCode) => (
                <FilterChip
                  active={rackFilter === rackCode}
                  key={rackCode}
                  onClick={() => setRackFilter(rackCode)}
                >
                  Rack {rackCode}
                </FilterChip>
              ))}
            </div>

            <RackStackMap
              onSelectShelf={handleSelectShelf}
              rackCode={rackFilter}
              selectedCode={selectedShelf?.code ?? null}
              shelves={allShelves}
              suggestions={suggestions}
              zoneCode={zoneFilter}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Gợi ý kệ</CardTitle>
            <CardDescription>
              Advisory only: receiver vẫn có thể override, miễn quét đúng barcode
              shelf trước khi xác nhận.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {suggestions.length === 0 ? (
              <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
                Không có shelf đủ sức chứa cho SKU và số lượng này.
              </div>
            ) : (
              suggestions.map((suggestion) => (
                <button
                  key={suggestion.shelf.code}
                  type="button"
                  className="grid gap-2 rounded-lg border border-border/70 bg-card p-3 text-left text-sm transition hover:bg-accent/60 data-[active=true]:border-primary/50 data-[active=true]:bg-primary/5"
                  data-active={selectedShelf?.code === suggestion.shelf.code}
                  onClick={() => handleSelectShelf(suggestion.shelf.code)}
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
              Nhập SKU và số lượng để lấy gợi ý từ backend hoặc fallback local.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={handleSubmit}>
              <div className="grid gap-2">
                <Label htmlFor="putawaySku">SKU</Label>
                <Input
                  id="putawaySku"
                  value={sku}
                  onChange={(event) => {
                    setSku(event.target.value);
                    setScanSku(event.target.value);
                  }}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="putawayQty">Số lượng</Label>
                <Input
                  id="putawayQty"
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(event) =>
                    setQuantity(Math.max(Number(event.target.value), 1))
                  }
                />
              </div>
              <Button type="submit">
                <RotateCcw data-icon="inline-start" />
                Tính gợi ý
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
                <div>
                  <div className="text-sm font-semibold">
                    {selectedShelf?.code ?? "No shelf"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {selectedSuggestion?.reason ?? "Chưa có gợi ý"}
                  </div>
                </div>
                <Badge variant="secondary">
                  <ShieldCheck data-icon="inline-start" />
                  Advisory
                </Badge>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-background">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${capacityUsage}%` }}
                />
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Dự kiến dùng {capacityUsage}% sức chứa gợi ý của shelf.
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
                      <span className="font-semibold text-foreground">Level:</span>{" "}
                      {selectedShelf.level}
                    </div>
                    <div>
                      <span className="font-semibold text-foreground">Barcode:</span>{" "}
                      {selectedShelf.barcode}
                    </div>
                    <div>
                      <span className="font-semibold text-foreground">Kích thước:</span>{" "}
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
                id="scanSku"
                value={scanSku}
                onChange={(event) => setScanSku(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="scanShelf">Barcode shelf</Label>
              <Input
                id="scanShelf"
                value={scanShelf}
                onChange={(event) => setScanShelf(event.target.value)}
              />
            </div>
            <Button
              className="w-full"
              disabled={!selectedShelf || !scanSku || !scanShelf}
              onClick={() => setConfirmed(true)}
            >
              <Barcode data-icon="inline-start" />
              Xác nhận đặt kệ
            </Button>
            {confirmed ? (
              <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
                <CheckCircle2 className="size-4 text-primary" />
                Đã xác nhận bằng barcode; nếu override shelf, hệ vẫn audit theo
                mã vị trí đã quét.
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
                <div className="text-xs font-semibold text-muted-foreground">Zone</div>
                <div className="font-mono text-lg font-bold">
                  {zoneCodes.length}
                </div>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                <div className="text-xs font-semibold text-muted-foreground">Rack</div>
                <div className="font-mono text-lg font-bold">
                  {groupShelvesByRack(allShelves).length}
                </div>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                <div className="text-xs font-semibold text-muted-foreground">Shelf</div>
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
