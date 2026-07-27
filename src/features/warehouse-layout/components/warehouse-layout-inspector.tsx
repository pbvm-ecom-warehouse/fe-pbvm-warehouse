"use client";

import { RotateCw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LayoutSelection } from "@/features/warehouse-layout/components/warehouse-floor-plan";
import type { WarehouseLayout } from "@/types/api";

function NumberField({
  disabled,
  label,
  onChange,
  step = 0.5,
  value,
}: {
  disabled: boolean;
  label: string;
  onChange: (value: number) => void;
  step?: number;
  value: number;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        aria-label={label}
        disabled={disabled}
        min={0}
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
      <Label className="text-xs">{label}</Label>
      <Input
        aria-label={label}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </div>
  );
}

export function WarehouseLayoutInspector({
  canEdit,
  layout,
  onDelete,
  onPatch,
  onRotate,
  selection,
}: {
  canEdit: boolean;
  layout: WarehouseLayout;
  onDelete: () => void;
  onPatch: (patch: Record<string, unknown>) => void;
  onRotate: () => void;
  selection: LayoutSelection;
}) {
  if (!selection) {
    return (
      <aside className="border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-muted-foreground">
        Chọn khu vực, dãy kệ, lối đi hoặc cổng trên sơ đồ để xem thông số.
      </aside>
    );
  }

  const item =
    selection.kind === "zone"
      ? layout.zones.find((entry) => entry.id === selection.id)
      : selection.kind === "rack"
        ? layout.racks.find((entry) => entry.id === selection.id)
        : selection.kind === "aisle"
          ? layout.aisles.find((entry) => entry.id === selection.id)
          : layout.gates.find((entry) => entry.id === selection.id);

  if (!item) {
    return null;
  }

  const selectionLabel = {
    aisle: "lối đi",
    gate: "cổng",
    rack: "dãy kệ",
    zone: "khu vực",
  }[selection.kind];

  return (
    <aside className="border border-slate-300 bg-white">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="text-sm font-semibold">Thuộc tính {selectionLabel}</div>
        <div className="mt-1 font-mono text-xs text-muted-foreground">
          {item.code}
        </div>
      </div>

      <div className="grid gap-4 p-4">
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
          <>
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                disabled={!canEdit}
                label="Rộng (m)"
                onChange={(widthM) => onPatch({ widthM })}
                value={item.widthM}
              />
              <NumberField
                disabled={!canEdit}
                label="Cao (m)"
                onChange={(heightM) => onPatch({ heightM })}
                value={item.heightM}
              />
            </div>
            <Button disabled={!canEdit} onClick={onRotate} variant="outline">
              <RotateCw data-icon="inline-start" />
              Xoay ngang/dọc
            </Button>
          </>
        ) : null}

        {selection.kind === "rack" ? (
          <>
            <p className="text-xs text-muted-foreground">
              Kích thước rack dùng chung toàn kho — sửa ở mục &quot;Kích
              thước rack chuẩn&quot; phía trên sơ đồ, áp dụng cho mọi rack
              cùng lúc.
            </p>
            <Button disabled={!canEdit} onClick={onRotate} variant="outline">
              <RotateCw data-icon="inline-start" />
              Xoay ngang/dọc
            </Button>
          </>
        ) : null}

        {selection.kind === "aisle" && "type" in item ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                disabled={!canEdit}
                label="Rộng (m)"
                onChange={(widthM) => onPatch({ widthM })}
                value={item.widthM}
              />
              <NumberField
                disabled={!canEdit}
                label="Cao (m)"
                onChange={(heightM) => onPatch({ heightM })}
                value={item.heightM}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                disabled={!canEdit}
                onClick={() => onPatch({ type: "MAIN" })}
                variant={item.type === "MAIN" ? "default" : "outline"}
              >
                Đường chính
              </Button>
              <Button
                disabled={!canEdit}
                onClick={() => onPatch({ type: "RACK" })}
                variant={item.type === "RACK" ? "default" : "outline"}
              >
                Lối giữa kệ
              </Button>
            </div>
          </>
        ) : null}

        <Button
          disabled={!canEdit}
          onClick={onDelete}
          variant="destructive"
        >
          <Trash2 data-icon="inline-start" />
          Xóa phần tử
        </Button>
      </div>
    </aside>
  );
}
