"use client";

import { MapPinned, RotateCw, Settings2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WarehouseLayout } from "@/types/api";
import type { LayoutSelection } from "./warehouse-floor-plan";

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
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs text-slate-600">{label}</Label>
      <Input
        aria-label={label}
        className="h-9"
        disabled={disabled}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type="number"
        value={value}
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

const issueLabels: Record<string, string> = {
  CANVAS_DIMENSIONS_INVALID: "Kích thước canvas phải lớn hơn 0",
  RACK_TEMPLATE_DIMENSIONS_INVALID: "Kích thước rack phải lớn hơn 0",
  ZONE_OUTSIDE_CANVAS: "Khu vực nằm ngoài canvas",
  AISLE_OUTSIDE_CANVAS: "Lối đi nằm ngoài canvas",
  GATE_OUTSIDE_CANVAS: "Cổng nằm ngoài canvas",
  RACK_OUTSIDE_ZONE: "Rack phải nằm hoàn toàn trong khu vực",
  RACK_OVERLAP: "Rack đang chồng lên rack khác",
  RACK_OVERLAPS_AISLE: "Rack đang chồng lên lối đi",
};

export function WarehouseLayoutInspector({
  canEdit,
  issues = [],
  layout,
  onDelete,
  onPatch,
  onPatchCanvas,
  onPatchRackTemplate,
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

          {(selection.kind === "zone" || selection.kind === "aisle") &&
          "heightM" in item ? (
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
                label="Cao (m)"
                min={0.1}
                onChange={(heightM) => onPatch({ heightM })}
                value={item.heightM}
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
            Chiều dài, chiều sâu và số khoang áp dụng cho mọi rack trên bản đồ.
          </p>
        </div>
      </details>
    </aside>
  );
}
