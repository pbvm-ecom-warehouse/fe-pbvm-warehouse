"use client";

import { useState } from "react";
import { CopyCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { RackConfigurationScope } from "@/features/warehouse-layout/utils/warehouse-layout";
import type { WarehouseLayout, WarehouseLayoutRack } from "@/types/api";

export function RackConfigurationDialog({
  layout,
  onApply,
  sourceRack,
}: {
  layout: WarehouseLayout;
  onApply: (scope: RackConfigurationScope) => void;
  sourceRack: WarehouseLayoutRack;
}) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<RackConfigurationScope>("ZONE");
  const sourceZone = layout.zones.find((zone) => zone.id === sourceRack.zoneId);
  const targetCount = layout.racks.filter(
    (rack) =>
      rack.id !== sourceRack.id &&
      (scope === "WAREHOUSE" || rack.zoneId === sourceRack.zoneId),
  ).length;

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setScope("ZONE");
    }
  }

  function handleApply() {
    if (targetCount === 0) {
      return;
    }
    onApply(scope);
    setOpen(false);
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        <Button
          className="w-full"
          data-testid="sync-rack-configuration"
          variant="outline"
        >
          <CopyCheck data-icon="inline-start" />
          Đồng bộ cấu hình kệ
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Đồng bộ cấu hình kệ</DialogTitle>
          <DialogDescription>
            Áp dụng cấu hình vật lý của {sourceRack.name} cho các kệ khác.
            Mã, zone và vị trí từng kệ được giữ nguyên.
          </DialogDescription>
        </DialogHeader>

        <div
          aria-label="Phạm vi đồng bộ"
          className="grid grid-cols-2 gap-1 border border-slate-200 bg-slate-50 p-1"
          role="group"
        >
          <Button
            aria-pressed={scope === "ZONE"}
            onClick={() => setScope("ZONE")}
            size="sm"
            variant={scope === "ZONE" ? "default" : "ghost"}
          >
            Zone {sourceZone?.code ?? sourceRack.zoneId}
          </Button>
          <Button
            aria-pressed={scope === "WAREHOUSE"}
            data-testid="rack-scope-warehouse"
            onClick={() => setScope("WAREHOUSE")}
            size="sm"
            variant={scope === "WAREHOUSE" ? "default" : "ghost"}
          >
            Toàn kho
          </Button>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-y border-slate-200 py-3 text-xs">
          <div>
            <dt className="text-muted-foreground">Kệ nguồn</dt>
            <dd className="mt-0.5 font-semibold">{sourceRack.code}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Kệ đích</dt>
            <dd className="mt-0.5 font-semibold">{targetCount} kệ</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Kích thước</dt>
            <dd className="mt-0.5 font-semibold">
              {sourceRack.widthM}m × {sourceRack.depthM}m
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Kết cấu</dt>
            <dd className="mt-0.5 font-semibold">
              {sourceRack.levelCount} tầng · {sourceRack.bayCount} khoang
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Hướng xoay</dt>
            <dd className="mt-0.5 font-semibold">{sourceRack.rotation}°</dd>
          </div>
        </dl>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Hủy</Button>
          </DialogClose>
          <Button
            data-testid="apply-rack-configuration"
            disabled={targetCount === 0}
            onClick={handleApply}
          >
            <CopyCheck data-icon="inline-start" />
            Áp dụng cho {targetCount} kệ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
