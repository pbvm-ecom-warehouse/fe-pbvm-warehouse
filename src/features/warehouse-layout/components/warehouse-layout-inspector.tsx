"use client";

import { useEffect, useRef, useState } from "react";
import { MapPinned, RotateCw, Settings2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WarehouseLayout } from "@/types/api";
import type { LayoutSelection } from "./warehouse-floor-plan";
import { getZonePolicy, zoneItemTypes } from "../utils/zone-policy";

type LayoutValidationIssue = {
  entity: string;
  id?: string;
  clientId?: string;
  field?: string;
  code: string;
};

function NumberField({
  disabled,
  label,
  min = 0,
  onChange,
  step = 0.5,
  value,
}: {
  disabled: boolean;
  label: string;
  min?: number;
  onChange: (value: number) => void;
  step?: number;
  value: number;
}) {
  const [draftValue, setDraftValue] = useState(() => String(value));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) {
      setDraftValue(String(value));
    }
  }, [value]);

  return (
    <div className="grid gap-1.5">
      <Label className="text-xs text-slate-600">{label}</Label>
      <Input
        aria-label={label}
        className="h-9"
        disabled={disabled}
        min={min}
        onBlur={() => {
          focusedRef.current = false;
          const numericValue = Number(draftValue);
          if (draftValue.trim() === "" || !Number.isFinite(numericValue)) {
            setDraftValue(String(value));
            return;
          }
          onChange(numericValue);
          setDraftValue(String(numericValue));
        }}
        onChange={(event) => {
          const nextValue = event.target.value;
          setDraftValue(nextValue);
          if (
            nextValue.trim() === "" ||
            nextValue === "-" ||
            nextValue === "." ||
            nextValue === "-."
          ) {
            return;
          }
          const numericValue = Number(nextValue);
          if (Number.isFinite(numericValue)) {
            onChange(numericValue);
          }
        }}
        onFocus={() => {
          focusedRef.current = true;
        }}
        step={step}
        type="number"
        value={draftValue}
      />
    </div>
  );
}

function TextField({
  disabled,
  label,
  onChange,
  value,
}: {
  disabled: boolean;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs text-slate-600">{label}</Label>
      <Input
        aria-label={label}
        className="h-9"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </div>
  );
}

function formatCentimeters(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

const issueLabels: Record<string, string> = {
  CANVAS_DIMENSIONS_INVALID: "Kích thước canvas phải lớn hơn 0",
  RACK_TEMPLATE_DIMENSIONS_INVALID: "Kích thước rack phải lớn hơn 0",
  ZONE_OUTSIDE_CANVAS: "Khu vực nằm ngoài canvas",
  AISLE_OUTSIDE_CANVAS: "Lối đi nằm ngoài canvas",
  GATE_OUTSIDE_CANVAS: "Cổng nằm ngoài canvas",
  RACK_OUTSIDE_ZONE: "Rack phải nằm hoàn toàn trong khu vực",
  RACK_OVERLAP: "Rack đang chồng lên rack khác",
  RACK_OVERLAPS_AISLE: "Rack đang chồng lên lối đi",
  RACK_ACCESS_POINT_NOT_CONNECTED:
    "Điểm tiếp cận của rack chưa nằm trong lối đi",
};

export function WarehouseLayoutInspector({
  canEdit,
  issues = [],
  layout,
  onDelete,
  onPatch,
  onPatchCanvas,
  onPatchRackTemplate,
  onSetStagingRack,
  onRotate,
  selection,
}: {
  canEdit: boolean;
  issues?: LayoutValidationIssue[];
  layout: WarehouseLayout;
  onDelete: () => void;
  onPatch: (patch: Record<string, unknown>) => void;
  onPatchCanvas: (patch: Record<string, number>) => void;
  onPatchRackTemplate: (patch: Record<string, number>) => void;
  onSetStagingRack: (rackId: string) => void;
  onRotate: () => void;
  selection: LayoutSelection;
}) {
  const item = !selection
    ? null
    : selection.kind === "zone"
      ? layout.zones.find((entry) => entry.id === selection.id)
      : selection.kind === "rack"
        ? layout.racks.find((entry) => entry.id === selection.id)
        : selection.kind === "aisle"
          ? layout.aisles.find((entry) => entry.id === selection.id)
          : layout.gates.find((entry) => entry.id === selection.id);
  const selectionIssues = selection
    ? issues.filter(
        (issue) =>
          (issue.id ?? issue.clientId) === selection.id &&
          issue.entity.toLowerCase() === selection.kind,
      )
    : [];
  const template = layout.rackTemplate;
  const rackShelves =
    selection?.kind === "rack" && item && "id" in item
      ? layout.shelves
          .filter((shelf) => shelf.rackId === item.id)
          .sort((left, right) => left.level - right.level)
      : [];
  const isStagingRack =
    rackShelves.length > 0 && rackShelves.every((shelf) => shelf.isStaging);
  const selectedZone =
    selection?.kind === "zone"
      ? layout.zones.find((zone) => zone.id === selection.id)
      : undefined;
  const zonePolicy = selectedZone ? getZonePolicy(selectedZone) : null;
  const hasAnotherScrapZone = selectedZone
    ? layout.zones.some(
        (zone) =>
          zone.id !== selectedZone.id &&
          getZonePolicy(zone).zonePurpose === "SCRAP",
      )
    : false;

  return (
    <aside className="w-[320px] shrink-0 overflow-y-auto border-l border-slate-200 bg-white">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
          <Settings2 className="size-4 text-slate-500" />
          Thuộc tính
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {item
            ? "Chỉnh phần tử đang chọn trên canvas."
            : "Chọn một phần tử để chỉnh chi tiết."}
        </p>
      </div>

      {item && selection ? (
        <section className="grid gap-4 border-b border-slate-200 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
                {
                  {
                    zone: "Khu vực",
                    rack: "Rack",
                    aisle: "Lối đi",
                    gate: "Cổng",
                  }[selection.kind]
                }
              </div>
              <div className="mt-1 font-mono text-xs text-slate-500">
                {item.code}
              </div>
            </div>
            {item.id.startsWith("tmp:") ? (
              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                Mới
              </span>
            ) : null}
          </div>

          {selectionIssues.length > 0 ? (
            <div className="grid gap-1 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">
              {selectionIssues.map((issue, index) => (
                <div key={`${issue.code}-${index}`}>
                  {issueLabels[issue.code] ?? issue.code}
                </div>
              ))}
            </div>
          ) : null}

          <TextField
            disabled={!canEdit}
            label="Mã"
            onChange={(code) => onPatch({ code })}
            value={item.code}
          />
          {"name" in item ? (
            <TextField
              disabled={!canEdit}
              label="Tên"
              onChange={(name) => onPatch({ name })}
              value={item.name}
            />
          ) : null}
          {"label" in item ? (
            <TextField
              disabled={!canEdit}
              label="Nhãn"
              onChange={(label) => onPatch({ label })}
              value={item.label}
            />
          ) : null}

          {selection.kind === "rack" && "zoneId" in item ? (
            <div className="grid gap-1.5">
              <Label className="text-xs text-slate-600">Khu vực</Label>
              <select
                aria-label="Khu vực"
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
                disabled={!canEdit}
                onChange={(event) => onPatch({ zoneId: event.target.value })}
                value={item.zoneId}
              >
                {layout.zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.code} · {zone.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <NumberField
              disabled={!canEdit}
              label="X (m)"
              onChange={(xM) => onPatch({ xM })}
              value={item.xM}
            />
            <NumberField
              disabled={!canEdit}
              label="Y (m)"
              onChange={(yM) => onPatch({ yM })}
              value={item.yM}
            />
          </div>

          {selection.kind === "zone" && "heightM" in item ? (
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                disabled={!canEdit}
                label="Rộng (m)"
                min={0.1}
                onChange={(widthM) => onPatch({ widthM })}
                value={item.widthM}
              />
              <NumberField
                disabled={!canEdit}
                label="Dài (m)"
                min={0.1}
                onChange={(heightM) => onPatch({ heightM })}
                value={item.heightM}
              />
            </div>
          ) : null}

          {selection.kind === "zone" && zonePolicy ? (
            <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div>
                <Label className="text-xs text-slate-700">
                  Mục đích khu vực
                </Label>
                <p className="mt-1 text-[11px] leading-4 text-slate-500">
                  Chỉ có một khu hủy để cách ly hàng chờ tiêu hủy.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  disabled={!canEdit}
                  onClick={() =>
                    onPatch({
                      zonePurpose: "STORAGE",
                      allowedItemTypes: zonePolicy.allowedItemTypes,
                    })
                  }
                  size="sm"
                  variant={
                    zonePolicy.zonePurpose === "STORAGE" ? "default" : "outline"
                  }
                >
                  Lưu trữ
                </Button>
                <Button
                  disabled={
                    !canEdit ||
                    (hasAnotherScrapZone && zonePolicy.zonePurpose !== "SCRAP")
                  }
                  onClick={() =>
                    onPatch({ zonePurpose: "SCRAP", allowedItemTypes: [] })
                  }
                  size="sm"
                  variant={
                    zonePolicy.zonePurpose === "SCRAP"
                      ? "destructive"
                      : "outline"
                  }
                >
                  Khu hủy
                </Button>
              </div>
              {hasAnotherScrapZone && zonePolicy.zonePurpose !== "SCRAP" ? (
                <p className="text-[11px] leading-4 text-amber-700">
                  Đã có một khu hủy khác trên sơ đồ.
                </p>
              ) : null}
              {zonePolicy.zonePurpose === "SCRAP" ? (
                <p className="text-xs leading-5 text-slate-600">
                  Khu hủy không áp dụng phân loại lưu trữ.
                </p>
              ) : (
                <fieldset className="grid gap-2">
                  <legend className="text-xs font-medium text-slate-700">
                    Phân loại lưu trữ
                  </legend>
                  <p className="text-[11px] leading-4 text-slate-500">
                    Không chọn loại nào nghĩa là khu lưu trữ chung.
                  </p>
                  {zoneItemTypes.map((itemType) => {
                    const checked = zonePolicy.allowedItemTypes.includes(
                      itemType.value,
                    );
                    return (
                      <label
                        className="flex items-center gap-2 text-sm text-slate-700"
                        key={itemType.value}
                      >
                        <input
                          aria-label={itemType.label}
                          checked={checked}
                          disabled={!canEdit}
                          onChange={() =>
                            onPatch({
                              allowedItemTypes: checked
                                ? zonePolicy.allowedItemTypes.filter(
                                    (value) => value !== itemType.value,
                                  )
                                : [
                                    ...zonePolicy.allowedItemTypes,
                                    itemType.value,
                                  ],
                            })
                          }
                          type="checkbox"
                        />
                        {itemType.label}
                      </label>
                    );
                  })}
                </fieldset>
              )}
            </div>
          ) : null}

          {selection.kind === "aisle" && "heightM" in item ? (
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                disabled={!canEdit}
                label="Dài (m)"
                min={0.1}
                onChange={(lengthM) =>
                  onPatch(
                    item.widthM >= item.heightM
                      ? { widthM: lengthM }
                      : { heightM: lengthM },
                  )
                }
                value={item.widthM >= item.heightM ? item.widthM : item.heightM}
              />
              <NumberField
                disabled={!canEdit}
                label="Rộng (m)"
                min={0.1}
                onChange={(widthM) =>
                  onPatch(
                    item.widthM >= item.heightM
                      ? { heightM: widthM }
                      : { widthM },
                  )
                }
                value={item.widthM >= item.heightM ? item.heightM : item.widthM}
              />
            </div>
          ) : null}

          {selection.kind === "aisle" && "type" in item ? (
            <div className="grid grid-cols-2 gap-2">
              <Button
                disabled={!canEdit}
                onClick={() => onPatch({ type: "MAIN" })}
                size="sm"
                variant={item.type === "MAIN" ? "default" : "outline"}
              >
                Đường chính
              </Button>
              <Button
                disabled={!canEdit}
                onClick={() => onPatch({ type: "RACK" })}
                size="sm"
                variant={item.type === "RACK" ? "default" : "outline"}
              >
                Giữa rack
              </Button>
            </div>
          ) : null}

          {selection.kind === "rack" ? (
            <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div>
                <div className="text-xs font-semibold text-slate-700">
                  Kệ nhận tạm
                </div>
                <p className="mt-1 text-[11px] leading-4 text-slate-500">
                  Chọn theo cả rack. Tất cả tầng của rack này dùng để nhận tạm;
                  mọi rack còn lại vẫn luôn là vị trí lưu trữ.
                </p>
              </div>
              <Button
                disabled={!canEdit || rackShelves.length === 0}
                onClick={() => onSetStagingRack(item.id)}
                size="sm"
                variant={isStagingRack ? "default" : "outline"}
              >
                {isStagingRack
                  ? `Đang nhận tạm · ${rackShelves.length} tầng`
                  : "Chọn cả rack làm kệ nhận tạm"}
              </Button>
              <div className="grid gap-1.5">
                {rackShelves.map((shelf) => (
                  <div
                    className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2"
                    key={shelf.id}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-800">
                        {shelf.code}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Tầng {shelf.level}
                      </div>
                    </div>
                    <span
                      className={
                        isStagingRack
                          ? "rounded-full bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700"
                          : "rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700"
                      }
                    >
                      {isStagingRack ? "Nhận tạm" : "Lưu trữ"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {selection.kind === "zone" || selection.kind === "rack" ? (
            <Button disabled={!canEdit} onClick={onRotate} variant="outline">
              <RotateCw data-icon="inline-start" />
              Xoay 90°
            </Button>
          ) : null}

          <Button disabled={!canEdit} onClick={onDelete} variant="destructive">
            <Trash2 data-icon="inline-start" />
            Xóa phần tử
          </Button>
        </section>
      ) : (
        <div className="border-b border-slate-200 p-4">
          <div className="grid place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
            <MapPinned className="size-6 text-slate-400" />
            <p className="mt-2 text-sm font-medium text-slate-700">
              Chưa chọn phần tử
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Dùng công cụ Chọn rồi bấm vào khu vực, rack, lối đi hoặc cổng.
            </p>
          </div>
        </div>
      )}

      <details className="group border-b border-slate-200" open={!item}>
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-800 marker:hidden">
          Canvas & lưới
        </summary>
        <div className="grid gap-3 px-4 pb-4">
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              disabled={!canEdit}
              label="Rộng kho (m)"
              min={0.1}
              onChange={(widthM) => onPatchCanvas({ widthM })}
              value={layout.canvas.widthM}
            />
            <NumberField
              disabled={!canEdit}
              label="Cao kho (m)"
              min={0.1}
              onChange={(heightM) => onPatchCanvas({ heightM })}
              value={layout.canvas.heightM}
            />
          </div>
          <NumberField
            disabled={!canEdit}
            label="Bước lưới (m)"
            min={0.1}
            onChange={(gridM) => onPatchCanvas({ gridM })}
            step={0.1}
            value={layout.canvas.gridM}
          />
        </div>
      </details>

      <details className="group" open={!item}>
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-800 marker:hidden">
          Cấu hình rack dùng chung
        </summary>
        <div className="grid gap-3 px-4 pb-5">
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              disabled={!canEdit}
              label="Dài (m)"
              min={0.1}
              onChange={(widthM) => onPatchRackTemplate({ widthM })}
              value={template.widthM}
            />
            <NumberField
              disabled={!canEdit}
              label="Sâu (m)"
              min={0.1}
              onChange={(depthM) => onPatchRackTemplate({ depthM })}
              step={0.1}
              value={template.depthM}
            />
          </div>
          <NumberField
            disabled={!canEdit}
            label="Cao toàn kệ (m)"
            min={0.1}
            onChange={(heightM) => onPatchRackTemplate({ heightM })}
            step={0.1}
            value={template.heightM}
          />
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              disabled={!canEdit}
              label="Số tầng"
              min={1}
              onChange={(levelCount) => onPatchRackTemplate({ levelCount })}
              step={1}
              value={template.levelCount}
            />
            <NumberField
              disabled={!canEdit}
              label="Số khoang"
              min={1}
              onChange={(bayCount) => onPatchRackTemplate({ bayCount })}
              step={1}
              value={template.bayCount}
            />
          </div>
          <p className="text-[11px] leading-4 text-slate-500">
            Chiều dài, chiều sâu, chiều cao và số khoang áp dụng cho mọi rack
            trên bản đồ.
          </p>
          <div
            aria-label="Kích thước mỗi khoang"
            className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] leading-5 text-blue-900"
          >
            <span className="font-semibold">Mỗi khoang:</span>{" "}
            {formatCentimeters((template.widthM * 100) / template.bayCount)} ×{" "}
            {formatCentimeters(template.depthM * 100)} ×{" "}
            {formatCentimeters((template.heightM * 100) / template.levelCount)}{" "}
            cm. Sức chứa còn lại được tính từ thể tích hữu dụng trừ thể tích
            hàng đang có.
          </div>
        </div>
      </details>
    </aside>
  );
}
