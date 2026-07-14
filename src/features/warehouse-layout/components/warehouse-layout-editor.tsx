"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DoorOpen,
  Grid2X2,
  Loader2,
  MousePointer2,
  Redo2,
  Route,
  Save,
  Send,
  SquareDashed,
  Undo2,
  Warehouse,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { getWarehouseLayout } from "@/features/warehouse-layout/services/warehouse-layout.service";
import {
  publishWarehouseLayout,
  saveWarehouseLayoutDraft,
} from "@/features/warehouse-layout/services/warehouse-layout.service";
import {
  WarehouseFloorPlan,
  type LayoutSelection,
} from "@/features/warehouse-layout/components/warehouse-floor-plan";
import { WarehouseLayoutInspector } from "@/features/warehouse-layout/components/warehouse-layout-inspector";
import {
  applyRackConfiguration,
  createDefaultWarehouseRack,
  cloneWarehouseLayout,
  type RackConfigurationScope,
  validateWarehouseLayoutClient,
} from "@/features/warehouse-layout/utils/warehouse-layout";
import { useSessionUser } from "@/hooks/use-session-user";
import { isMissingBackendEndpoint } from "@/lib/api-contract";
import { hasAnyRole } from "@/lib/rbac";
import type { WarehouseLayout } from "@/types/api";

const DEFAULT_WAREHOUSE_ID = "central";

function emptyDraftLayout(warehouseId: string): WarehouseLayout {
  return {
    warehouseId,
    revision: 0,
    status: "DRAFT" as const,
    canvas: { widthM: 40, heightM: 24, gridM: 0.5 },
    zones: [],
    racks: [],
    aisles: [],
    gates: [],
  };
}

function nextId(prefix: string, count: number) {
  return `${prefix}-${Date.now()}-${count + 1}`;
}

export function WarehouseLayoutEditor() {
  const user = useSessionUser();
  const canEdit = hasAnyRole(user?.roles, ["MANAGER"]);
  const queryClient = useQueryClient();
  const warehouseId = user?.warehouseId ?? DEFAULT_WAREHOUSE_ID;
  const [layout, setLayout] = useState<WarehouseLayout | null>(null);
  const [selection, setSelection] = useState<LayoutSelection>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [past, setPast] = useState<WarehouseLayout[]>([]);
  const [future, setFuture] = useState<WarehouseLayout[]>([]);
  const initializedRef = useRef(false);
  const interactionStartRef = useRef<WarehouseLayout | null>(null);
  const queryStatus = canEdit ? "draft" : "published";

  const layoutQuery = useQuery({
    enabled: Boolean(user && warehouseId),
    queryFn: () => getWarehouseLayout(warehouseId, queryStatus),
    queryKey: ["warehouse-layout", warehouseId, queryStatus],
    retry: false,
  });

  useEffect(() => {
    if (initializedRef.current || layoutQuery.isPending) {
      return;
    }

    if (layoutQuery.isError) {
      if (canEdit && isMissingBackendEndpoint(layoutQuery.error)) {
        const draftLayout = emptyDraftLayout(warehouseId);
        initializedRef.current = true;
        const timeoutId = window.setTimeout(() => setLayout(draftLayout), 0);
        return () => window.clearTimeout(timeoutId);
      }
      return;
    }

    const initial = layoutQuery.data ?? (canEdit ? emptyDraftLayout(warehouseId) : null);
    initializedRef.current = true;
    const timeoutId = window.setTimeout(() => setLayout(initial), 0);
    return () => window.clearTimeout(timeoutId);
  }, [
    canEdit,
    layoutQuery.data,
    layoutQuery.error,
    layoutQuery.isError,
    layoutQuery.isPending,
    warehouseId,
  ]);

  const saveMutation = useMutation({
    mutationFn: (nextLayout: WarehouseLayout) =>
      saveWarehouseLayoutDraft(nextLayout),
    onError: (error) => {
      toast.error(
        isMissingBackendEndpoint(error)
          ? "Chưa thể lưu bản nháp mặt bằng."
          : "Không lưu được bản nháp. Kiểm tra kết nối hoặc phiên bản mặt bằng.",
      );
    },
    onSuccess: (saved) => {
      setLayout(saved);
      setDirty(false);
      setPast([]);
      setFuture([]);
      queryClient.setQueryData(
        ["warehouse-layout", saved.warehouseId, "draft"],
        saved,
      );
      toast.success(`Đã lưu bản nháp mặt bằng bản ${saved.revision}.`);
    },
  });

  const publishMutation = useMutation({
    mutationFn: ({
      draftRevision,
      warehouseId,
    }: {
      draftRevision: number;
      warehouseId: string;
    }) => publishWarehouseLayout(warehouseId, draftRevision),
    onError: (error) => {
      toast.error(
        isMissingBackendEndpoint(error)
          ? "Chưa thể công bố mặt bằng."
          : "Không công bố được mặt bằng. Kiểm tra các lỗi đang hiển thị.",
      );
    },
    onSuccess: (published) => {
      queryClient.setQueryData(
        ["warehouse-layout", published.warehouseId, "published"],
        published,
      );
      toast.success(`Đã công bố mặt bằng bản ${published.revision}.`);
    },
  });

  const validationErrors = useMemo(
    () =>
      layout
        ? validateWarehouseLayoutClient(layout, { publishing: true })
        : [],
    [layout],
  );
  const renderLayout = useMemo(() => {
    if (!layout || snapEnabled) {
      return layout;
    }

    return {
      ...layout,
      canvas: { ...layout.canvas, gridM: 0.1 },
    };
  }, [layout, snapEnabled]);

  function commit(next: WarehouseLayout) {
    if (!layout) {
      return;
    }

    setPast((items) => [...items.slice(-39), cloneWarehouseLayout(layout)]);
    setFuture([]);
    setLayout(next);
    setDirty(true);
  }

  function updateWithoutHistory(
    updater: (current: WarehouseLayout) => WarehouseLayout,
  ) {
    setLayout((current) => {
      if (!current) {
        return current;
      }
      return updater(cloneWarehouseLayout(current));
    });
    setDirty(true);
  }

  function addZone() {
    if (!layout) return;
    const count = layout.zones.length;
    const code = `Z${count + 1}`;
    const next = cloneWarehouseLayout(layout);
    const id = nextId("zone", count);
    next.zones.push({
      id,
      code,
      name: `Khu ${code}`,
      xM: 1 + count,
      yM: 1 + count,
      widthM: 12,
      heightM: 8,
      rotation: 0,
    });
    commit(next);
    setSelection({ kind: "zone", id });
  }

  function addRack() {
    if (!layout) return;
    const zone = layout.zones[0];
    if (!zone) {
      toast.error("Tạo khu vực trước khi thêm dãy kệ.");
      return;
    }

    const count = layout.racks.length;
    const id = nextId("rack", count);
    const next = cloneWarehouseLayout(layout);
    next.racks.push(createDefaultWarehouseRack(zone, count, id));
    commit(next);
    setSelection({ kind: "rack", id });
  }

  function applySelectedRackConfiguration(scope: RackConfigurationScope) {
    if (!layout || selection?.kind !== "rack") {
      return;
    }

    commit(applyRackConfiguration(layout, selection.id, scope));
  }

  function addAisle(type: "MAIN" | "RACK") {
    if (!layout) return;
    const sameTypeCount = layout.aisles.filter((aisle) => aisle.type === type).length;
    const id = nextId(type === "MAIN" ? "main" : "aisle", layout.aisles.length);
    const code = type === "MAIN" ? `MAIN-${sameTypeCount + 1}` : `AISLE-${sameTypeCount + 1}`;
    const next = cloneWarehouseLayout(layout);
    next.aisles.push({
      id,
      code,
      type,
      xM: type === "MAIN" ? layout.canvas.widthM / 2 - 2 : 1,
      yM: type === "MAIN" ? 0 : layout.canvas.heightM / 2 - 1,
      widthM: type === "MAIN" ? 4 : layout.canvas.widthM - 2,
      heightM: type === "MAIN" ? layout.canvas.heightM : 2,
    });
    commit(next);
    setSelection({ kind: "aisle", id });
  }

  function addGate() {
    if (!layout) return;
    const count = layout.gates.length;
    const id = nextId("gate", count);
    const next = cloneWarehouseLayout(layout);
    next.gates.push({
      id,
      code: `GATE-${String(count + 1).padStart(2, "0")}`,
      label: "Cổng vào",
      xM: layout.canvas.widthM / 2,
      yM: layout.canvas.heightM,
    });
    commit(next);
    setSelection({ kind: "gate", id });
  }

  function patchSelected(patch: Record<string, unknown>) {
    if (!layout || !selection) return;
    const next = cloneWarehouseLayout(layout);

    if (selection.kind === "zone") {
      next.zones = next.zones.map((item) =>
        item.id === selection.id ? { ...item, ...patch } : item,
      );
    } else if (selection.kind === "rack") {
      next.racks = next.racks.map((item) => {
        if (item.id !== selection.id) return item;
        const updated = { ...item, ...patch };
        const levelCount = Math.max(1, Math.round(Number(updated.levelCount)));
        const code = String(updated.code);
        return {
          ...updated,
          levelCount,
          bayCount: Math.max(1, Math.round(Number(updated.bayCount))),
          shelfCodes: Array.from(
            { length: levelCount },
            (_, index) => `${code}-S${String(index + 1).padStart(2, "0")}`,
          ),
        };
      });
    } else if (selection.kind === "aisle") {
      next.aisles = next.aisles.map((item) =>
        item.id === selection.id ? { ...item, ...patch } : item,
      );
    } else {
      next.gates = next.gates.map((item) =>
        item.id === selection.id ? { ...item, ...patch } : item,
      );
    }

    commit(next);
  }

  function deleteSelected() {
    if (!layout || !selection) return;
    const next = cloneWarehouseLayout(layout);
    if (selection.kind === "zone") {
      next.zones = next.zones.filter((item) => item.id !== selection.id);
      next.racks = next.racks.filter((item) => item.zoneId !== selection.id);
    } else if (selection.kind === "rack") {
      next.racks = next.racks.filter((item) => item.id !== selection.id);
    } else if (selection.kind === "aisle") {
      next.aisles = next.aisles.filter((item) => item.id !== selection.id);
    } else {
      next.gates = next.gates.filter((item) => item.id !== selection.id);
    }
    commit(next);
    setSelection(null);
  }

  function rotateSelected() {
    if (!layout || !selection || selection.kind === "gate" || selection.kind === "aisle") {
      return;
    }
    const collection = selection.kind === "zone" ? layout.zones : layout.racks;
    const item = collection.find((entry) => entry.id === selection.id);
    if (item) {
      patchSelected({ rotation: item.rotation === 0 ? 90 : 0 });
    }
  }

  function moveElement(
    target: NonNullable<LayoutSelection>,
    position: { xM: number; yM: number },
  ) {
    updateWithoutHistory((next) => {
      if (target.kind === "zone") {
        next.zones = next.zones.map((item) =>
          item.id === target.id ? { ...item, ...position } : item,
        );
      } else if (target.kind === "rack") {
        next.racks = next.racks.map((item) =>
          item.id === target.id ? { ...item, ...position } : item,
        );
      } else if (target.kind === "aisle") {
        next.aisles = next.aisles.map((item) =>
          item.id === target.id ? { ...item, ...position } : item,
        );
      } else {
        next.gates = next.gates.map((item) =>
          item.id === target.id
            ? { ...item, xM: position.xM + 0.5, yM: position.yM + 0.5 }
            : item,
        );
      }
      return next;
    });
  }

  function resizeElement(
    target: NonNullable<LayoutSelection>,
    size: { widthM: number; heightM: number },
  ) {
    updateWithoutHistory((next) => {
      if (target.kind === "zone") {
        next.zones = next.zones.map((item) =>
          item.id === target.id
            ? {
                ...item,
                widthM: item.rotation === 90 ? size.heightM : size.widthM,
                heightM: item.rotation === 90 ? size.widthM : size.heightM,
              }
            : item,
        );
      } else if (target.kind === "rack") {
        next.racks = next.racks.map((item) =>
          item.id === target.id
            ? {
                ...item,
                widthM: item.rotation === 90 ? size.heightM : size.widthM,
                depthM: item.rotation === 90 ? size.widthM : size.heightM,
              }
            : item,
        );
      } else if (target.kind === "aisle") {
        next.aisles = next.aisles.map((item) =>
          item.id === target.id ? { ...item, ...size } : item,
        );
      }
      return next;
    });
  }

  function undo() {
    const previous = past.at(-1);
    if (!layout || !previous) return;
    setPast((items) => items.slice(0, -1));
    setFuture((items) => [cloneWarehouseLayout(layout), ...items]);
    setLayout(previous);
    setDirty(true);
  }

  function redo() {
    const next = future[0];
    if (!layout || !next) return;
    setPast((items) => [...items, cloneWarehouseLayout(layout)]);
    setFuture((items) => items.slice(1));
    setLayout(next);
    setDirty(true);
  }

  if (!user) {
    return null;
  }

  if (layoutQuery.isError && !(canEdit && layout && isMissingBackendEndpoint(layoutQuery.error))) {
    const unsupported = isMissingBackendEndpoint(layoutQuery.error);

    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950">
        <div className="font-semibold">
          {unsupported
            ? "Mặt bằng kho chưa sẵn sàng"
            : "Không tải được mặt bằng kho"}
        </div>
        <p className="mt-2 max-w-3xl text-amber-900/80">
          {unsupported
            ? "Chưa có dữ liệu mặt bằng để hiển thị kho."
            : "Kiểm tra lại phiên đăng nhập hoặc thử tải lại trang."}
        </p>
      </div>
    );
  }

  if (!layoutQuery.isPending && !layout && !canEdit) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        Chưa có bản vẽ mặt bằng cho kho này.
      </div>
    );
  }

  if (layoutQuery.isPending || !layout || !renderLayout) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[620px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Warehouse className="size-6 text-primary" />
            <h1 className="text-2xl font-bold">Bố trí mặt bằng kho</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Khu vực, dãy kệ và lối đi dùng đơn vị mét.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={dirty ? "secondary" : "outline"}>
            {dirty ? "Có thay đổi chưa lưu" : `Bản ${layout.revision}`}
          </Badge>
          {canEdit ? (
            <>
              <Button
                disabled={!dirty || saveMutation.isPending}
                onClick={() => saveMutation.mutate(layout)}
                variant="outline"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="animate-spin" data-icon="inline-start" />
                ) : (
                  <Save data-icon="inline-start" />
                )}
                Lưu bản nháp
              </Button>
              <Button
                disabled={
                  dirty ||
                  layout.revision < 1 ||
                  validationErrors.length > 0 ||
                  publishMutation.isPending
                }
                onClick={() =>
                  publishMutation.mutate({
                    draftRevision: layout.revision,
                    warehouseId: layout.warehouseId,
                  })
                }
              >
                <Send data-icon="inline-start" />
                Công bố
              </Button>
            </>
          ) : (
            <Badge variant="outline">Chế độ xem</Badge>
          )}
        </div>
      </header>

      <section className="border border-slate-300 bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 p-3">
          {canEdit ? (
            <>
              <Button onClick={() => setSelection(null)} size="sm" variant="outline">
                <MousePointer2 data-icon="inline-start" />
                Chọn
              </Button>
              <Button onClick={addZone} size="sm" variant="outline">
                <SquareDashed data-icon="inline-start" />
                Khu vực
              </Button>
              <Button onClick={addRack} size="sm" variant="outline">
                <Grid2X2 data-icon="inline-start" />
                Dãy kệ
              </Button>
              <Button onClick={() => addAisle("MAIN")} size="sm" variant="outline">
                <Route data-icon="inline-start" />
                Đường chính
              </Button>
              <Button onClick={() => addAisle("RACK")} size="sm" variant="outline">
                <Route data-icon="inline-start" />
                Lối giữa kệ
              </Button>
              <Button onClick={addGate} size="sm" variant="outline">
                <DoorOpen data-icon="inline-start" />
                Cổng
              </Button>
              <span className="mx-1 h-6 w-px bg-slate-300" />
              <Button
                aria-label="Hoàn tác"
                disabled={past.length === 0}
                onClick={undo}
                size="icon-sm"
                variant="ghost"
              >
                <Undo2 />
              </Button>
              <Button
                aria-label="Làm lại"
                disabled={future.length === 0}
                onClick={redo}
                size="icon-sm"
                variant="ghost"
              >
                <Redo2 />
              </Button>
              <div className="ml-auto flex items-center gap-2 text-xs font-medium text-slate-600">
                Căn lưới {layout.canvas.gridM}m
                <Switch checked={snapEnabled} onCheckedChange={setSnapEnabled} />
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">
              Quản lý có thể xem mặt bằng kho nhưng không thể chỉnh sửa.
            </div>
          )}
        </div>

        <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <WarehouseFloorPlan
              editable={canEdit}
              layout={renderLayout}
              onInteractionEnd={() => {
                if (interactionStartRef.current) {
                  setPast((items) => [
                    ...items.slice(-39),
                    interactionStartRef.current!,
                  ]);
                  setFuture([]);
                  interactionStartRef.current = null;
                }
              }}
              onInteractionStart={() => {
                interactionStartRef.current ??= cloneWarehouseLayout(layout);
              }}
              onMoveElement={moveElement}
              onResizeElement={resizeElement}
              onSelect={setSelection}
              selection={selection}
            />

            {validationErrors.length > 0 ? (
              <div className="mt-3 border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                <div className="font-semibold">Mặt bằng chưa thể công bố</div>
                <ul className="mt-2 grid gap-1">
                  {validationErrors.map((error) => (
                    <li key={error}>- {error}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="mt-3 border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
                Mặt bằng đã sẵn sàng công bố.
              </div>
            )}
          </div>

          <WarehouseLayoutInspector
            canEdit={canEdit}
            layout={layout}
            onDelete={deleteSelected}
            onApplyRackConfiguration={applySelectedRackConfiguration}
            onPatch={patchSelected}
            onRotate={rotateSelected}
            selection={selection}
          />
        </div>
      </section>
    </div>
  );
}





