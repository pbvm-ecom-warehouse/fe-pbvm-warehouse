"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  Barcode,
  CheckCircle2,
  MapPinned,
  Navigation,
  RotateCcw,
  ShieldCheck,
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
import { listPutawaySuggestions } from "@/features/warehouse-navigation/services/putaway-navigation.service";
import {
  buildNavigationPath,
  fallbackPutawaySuggestions,
  fallbackShelves,
  selectSuggestedShelf,
} from "@/features/warehouse-navigation/utils/putaway-navigation";
import type { PutawaySuggestion, WarehouseShelf } from "@/types/api";

const defaultPutawayInput = {
  sku: "CUP-BLANK-500",
  quantity: 80,
  warehouseId: "central",
};

const initialSuggestions = fallbackPutawaySuggestions(defaultPutawayInput);
const initialSelectedCode = initialSuggestions[0]?.shelf.code ?? null;

function shelfCenter(shelf: WarehouseShelf) {
  return {
    x: shelf.x + shelf.width / 2,
    y: shelf.y + shelf.height / 2,
  };
}

function WarehouseFloorMap({
  suggestions,
  selected,
}: {
  suggestions: PutawaySuggestion[];
  selected: PutawaySuggestion | null;
}) {
  const suggestedCodes = new Set(suggestions.map((item) => item.shelf.code));
  const staging = fallbackShelves.find((shelf) => shelf.isStaging);
  const routePath =
    selected && staging
      ? `M ${shelfCenter(staging).x} ${staging.y} L ${shelfCenter(staging).x} 198 L ${shelfCenter(selected.shelf).x} 198 L ${shelfCenter(selected.shelf).x} ${shelfCenter(selected.shelf).y}`
      : null;

  return (
    <svg
      viewBox="0 0 488 340"
      role="img"
      aria-label="Warehouse shelf navigation map"
      className="h-auto w-full rounded-lg border bg-background shadow-sm"
    >
      <defs>
        <linearGradient id="warehouse-floor" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="100%" stopColor="#eef2ff" />
        </linearGradient>
      </defs>
      <rect
        x="24"
        y="24"
        width="440"
        height="292"
        rx="10"
        fill="url(#warehouse-floor)"
        stroke="#e2e8f0"
      />
      <rect x="46" y="44" width="396" height="24" rx="6" fill="#e2e8f0" />
      <text x="62" y="61" fill="#475569" fontSize="11" fontWeight="700">
        MAIN AISLE
      </text>
      <rect x="224" y="82" width="30" height="204" rx="6" fill="#e2e8f0" />
      <text x="228" y="188" fill="#64748b" fontSize="10" fontWeight="700">
        LANE
      </text>
      {routePath ? (
        <>
          <path
            d={routePath}
            fill="none"
            stroke="#0f766e"
            strokeDasharray="9 7"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="5"
          />
          {selected ? (
            <circle
              cx={shelfCenter(selected.shelf).x}
              cy={shelfCenter(selected.shelf).y}
              fill="#0f766e"
              r="6"
            />
          ) : null}
        </>
      ) : null}
      {fallbackShelves.map((shelf) => {
        const isSelected = selected?.shelf.code === shelf.code;
        const isSuggested = suggestedCodes.has(shelf.code);

        return (
          <g key={shelf.id}>
            <rect
              x={shelf.x}
              y={shelf.y}
              width={shelf.width}
              height={shelf.height}
              rx="8"
              fill={
                shelf.isStaging
                  ? "#dbeafe"
                  : isSelected
                    ? "#ccfbf1"
                    : isSuggested
                      ? "#fef3c7"
                      : "#ffffff"
              }
              stroke={isSelected ? "#0f766e" : "#94a3b8"}
              strokeWidth={isSelected ? 3 : 1.5}
            />
            <text
              x={shelf.x + 14}
              y={shelf.y + 27}
              fill="#0f172a"
              fontSize="14"
              fontWeight="700"
            >
              {shelf.code}
            </text>
            <text
              x={shelf.x + 14}
              y={shelf.y + 48}
              fill="#475569"
              fontSize="11"
            >
              {shelf.zoneName}
            </text>
            {isSelected ? (
              <text
                x={shelf.x + shelf.width - 42}
                y={shelf.y + 48}
                fill="#0f766e"
                fontSize="10"
                fontWeight="700"
              >
                TARGET
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

export function WarehouseNavigationClient() {
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
  const selected = useMemo(
    () =>
      suggestions.find(
        (suggestion) => suggestion.shelf.code === selectedCode,
      ) ?? selectSuggestedShelf(suggestions),
    [selectedCode, suggestions],
  );
  const selectedPath = selected
    ? buildNavigationPath(selected.shelf).join(" / ")
    : "Chưa chọn shelf";
  const capacityUsage = selected
    ? Math.min(100, Math.round((quantity / selected.capacity) * 100))
    : 0;

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
  }

  function handleSelectSuggestion(code: string) {
    const nextSelected = suggestions.find(
      (suggestion) => suggestion.shelf.code === code,
    );
    setSelectedCode(code);
    setScanShelf(nextSelected?.shelf.barcode ?? "");
    setConfirmed(false);
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-5">
        <Card className="shadow-sm">
          <CardHeader className="border-b bg-muted/25">
            <CardTitle className="flex items-center gap-2 text-xl">
              <MapPinned className="size-5 text-primary" />
              Điều hướng put-away
            </CardTitle>
            <CardDescription>
              Bản đồ SVG nội bộ cho zone/rack/shelf, không phải 3D bin-packing.
            </CardDescription>
            <CardAction>
              <Badge variant="secondary">
                <Navigation data-icon="inline-start" />
                {selected?.shelf.code ?? "No target"}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-3">
            <WarehouseFloorMap suggestions={suggestions} selected={selected} />
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border bg-primary/5 px-2.5 py-1 font-medium text-primary">
                Suggested route
              </span>
              <span className="rounded-full border bg-amber-50 px-2.5 py-1 font-medium text-amber-700">
                Candidate shelf
              </span>
              <span className="rounded-full border bg-blue-50 px-2.5 py-1 font-medium text-blue-700">
                Receiving
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Gợi ý kệ</CardTitle>
            <CardDescription>
              Gợi ý là advisory; receiver có thể override và hệ thống audit lại.
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
                  className="grid gap-2 rounded-lg border p-3 text-left text-sm transition hover:bg-muted/60 data-[active=true]:border-primary data-[active=true]:bg-primary/5"
                  data-active={selected?.shelf.code === suggestion.shelf.code}
                  onClick={() => handleSelectSuggestion(suggestion.shelf.code)}
                >
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">
                      {suggestion.shelf.code}
                    </span>
                    <Badge
                      variant={
                        selected?.shelf.code === suggestion.shelf.code
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

      <aside className="space-y-5">
        <Card className="shadow-sm">
          <CardHeader className="border-b bg-muted/25">
            <CardTitle className="text-lg">Phiếu put-away</CardTitle>
            <CardDescription>
              Nhập SKU và số lượng để lấy gợi ý.
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

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Target shelf</CardTitle>
            <CardDescription>{selectedPath}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border bg-primary/5 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">
                    {selected?.shelf.code ?? "No shelf"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {selected?.reason ?? "Chưa có gợi ý"}
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
                Dự kiến dùng {capacityUsage}% sức chứa còn lại của shelf.
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Xác nhận scan</CardTitle>
            <CardDescription>
              Barcode SKU và shelf là bước quyết định trước khi ghi nhận.
            </CardDescription>
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
              disabled={!selected || !scanSku || !scanShelf}
              onClick={() => setConfirmed(true)}
            >
              <Barcode data-icon="inline-start" />
              Xác nhận đặt kệ
            </Button>
            {confirmed ? (
              <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
                <CheckCircle2 className="size-4 text-primary" />
                Đã xác nhận bằng barcode; override vẫn được audit.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
