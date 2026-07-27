"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/lib/api-contract";
import { hasAnyRole } from "@/lib/rbac";
import { useSessionUser } from "@/hooks/use-session-user";

import {
  fetchRackTemplate,
  fetchWarehouseLayout,
  patchAisle,
  patchGate,
  patchRack,
  patchZone,
  updateRackTemplate,
  type RackTemplate,
} from "../services/warehouse-layout.service";
import {
  fetchShelfContents,
  fetchShelvesForRacks,
} from "../services/warehouse-shelves.service";
import {
  WarehouseFloorPlan,
  type LayoutElementKind,
  type LayoutSelection,
} from "./warehouse-floor-plan";
import { WarehouseLayoutInspector } from "./warehouse-layout-inspector";
import { WarehouseArchitectureScene } from "@/features/warehouse-navigation/components/warehouse-architecture-scene";
import {
  groupShelvesByRack,
  layoutToWarehouseShelves,
} from "@/features/warehouse-navigation/utils/putaway-navigation";
import type { WarehouseShelf } from "@/types/api";

const layoutKeys = {
  detail: ["warehouse-layout"] as const,
};
const rackTemplateKeys = {
  detail: ["rack-template"] as const,
};

function RackTemplateForm({
  canEdit,
  onSaved,
  template,
}: {
  canEdit: boolean;
  onSaved: () => void;
  template: RackTemplate;
}) {
  const [form, setForm] = useState(template);

  const mutation = useMutation({
    mutationFn: () => updateRackTemplate(form),
    onError: (error) => toast.error(getApiErrorMessage(error)),
    onSuccess: () => {
      toast.success("Đã cập nhật kích thước rack cho toàn kho.");
      onSaved();
    },
  });

  return (
    <div className="grid gap-3 border border-slate-300 bg-white p-4">
      <h3 className="text-sm font-semibold">
        Kích thước rack chuẩn (áp dụng toàn kho)
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label className="text-xs">Rộng (m)</Label>
          <Input
            aria-label="Rộng (m)"
            disabled={!canEdit}
            min={0.1}
            onChange={(event) =>
              setForm({ ...form, widthM: Number(event.target.value) })
            }
            step={0.5}
            type="number"
            value={form.widthM}
          />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Sâu (m)</Label>
          <Input
            aria-label="Sâu (m)"
            disabled={!canEdit}
            min={0.1}
            onChange={(event) =>
              setForm({ ...form, depthM: Number(event.target.value) })
            }
            step={0.1}
            type="number"
            value={form.depthM}
          />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Số tầng</Label>
          <Input
            aria-label="Số tầng"
            disabled={!canEdit}
            min={1}
            onChange={(event) =>
              setForm({ ...form, levelCount: Number(event.target.value) })
            }
            step={1}
            type="number"
            value={form.levelCount}
          />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Số khoang</Label>
          <Input
            aria-label="Số khoang"
            disabled={!canEdit}
            min={1}
            onChange={(event) =>
              setForm({ ...form, bayCount: Number(event.target.value) })
            }
            step={1}
            type="number"
            value={form.bayCount}
          />
        </div>
      </div>
      <Button
        disabled={!canEdit || mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        Áp dụng cho toàn bộ rack
      </Button>
    </div>
  );
}

export function WarehouseMapClient() {
  const user = useSessionUser();
  const canEdit = hasAnyRole(user?.roles, ["MANAGER", "ADMIN"]);
  const queryClient = useQueryClient();
  const [selection, setSelection] = useState<LayoutSelection>(null);
  const [sceneMode, setSceneMode] = useState<"map" | "rack">("map");
  const [selectedRackCode, setSelectedRackCode] = useState<string | null>(
    null,
  );
  const [selectedShelfCode, setSelectedShelfCode] = useState<string | null>(
    null,
  );

  const layoutQuery = useQuery({
    queryKey: layoutKeys.detail,
    queryFn: fetchWarehouseLayout,
  });

  const rackTemplateQuery = useQuery({
    queryKey: rackTemplateKeys.detail,
    queryFn: fetchRackTemplate,
  });

  const rackIds = useMemo(
    () => layoutQuery.data?.racks.map((rack) => rack.id) ?? [],
    [layoutQuery.data],
  );

  const shelvesQuery = useQuery({
    queryKey: ["warehouse-shelves", rackIds],
    queryFn: () => fetchShelvesForRacks(rackIds),
    enabled: rackIds.length > 0,
  });

  const shelves: WarehouseShelf[] = useMemo(() => {
    if (!layoutQuery.data || !shelvesQuery.data) return [];
    return layoutToWarehouseShelves(layoutQuery.data, shelvesQuery.data);
  }, [layoutQuery.data, shelvesQuery.data]);

  const rackGroup = useMemo(() => {
    if (!selectedRackCode) return null;
    return (
      groupShelvesByRack(shelves, { rackCode: selectedRackCode })[0] ?? null
    );
  }, [shelves, selectedRackCode]);

  const contentsQuery = useQuery({
    queryKey: ["shelf-contents", selectedShelfCode],
    queryFn: () => {
      const shelf = shelves.find((s) => s.code === selectedShelfCode);
      if (!shelf) return Promise.resolve([]);
      return fetchShelfContents(shelf.id);
    },
    enabled: sceneMode === "rack" && Boolean(selectedShelfCode),
  });

  const patchMutation = useMutation({
    mutationFn: async (params: {
      kind: LayoutElementKind;
      id: string;
      patch: Record<string, unknown>;
    }) => {
      if (params.kind === "zone") return patchZone(params.id, params.patch);
      if (params.kind === "rack") return patchRack(params.id, params.patch);
      if (params.kind === "aisle") return patchAisle(params.id, params.patch);
      return patchGate(params.id, params.patch);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: layoutKeys.detail });
    },
  });

  function handlePatch(patch: Record<string, unknown>) {
    if (!selection) return;
    patchMutation.mutate({ kind: selection.kind, id: selection.id, patch });
  }

  function handleOpenRack(rackCode: string, shelfCode: string) {
    setSelectedRackCode(rackCode);
    setSelectedShelfCode(shelfCode);
    setSceneMode("rack");
  }

  if (layoutQuery.isLoading || rackTemplateQuery.isLoading) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Đang tải sơ đồ kho…
      </div>
    );
  }

  if (layoutQuery.isError || !layoutQuery.data || !rackTemplateQuery.data) {
    return (
      <div className="p-6 text-sm text-destructive">
        Không tải được sơ đồ kho.
      </div>
    );
  }

  return (
    <div className="grid gap-4 p-6 lg:grid-cols-[1fr_320px]">
      <div className="grid gap-4">
        <RackTemplateForm
          canEdit={canEdit}
          onSaved={() => {
            void queryClient.invalidateQueries({
              queryKey: rackTemplateKeys.detail,
            });
            void queryClient.invalidateQueries({ queryKey: layoutKeys.detail });
          }}
          template={rackTemplateQuery.data}
        />

        {sceneMode === "map" ? (
          <Card>
            <CardHeader>
              <CardTitle>Sơ đồ kho</CardTitle>
            </CardHeader>
            <CardContent>
              <WarehouseFloorPlan
                editable={canEdit}
                layout={layoutQuery.data}
                onMoveElement={(target, position) =>
                  patchMutation.mutate({
                    kind: target.kind,
                    id: target.id,
                    patch: position,
                  })
                }
                onOpenRack={handleOpenRack}
                onResizeElement={(target, size) =>
                  patchMutation.mutate({
                    kind: target.kind,
                    id: target.id,
                    patch: size,
                  })
                }
                onSelect={setSelection}
                selectedRackCode={selectedRackCode}
                selection={selection}
              />
            </CardContent>
          </Card>
        ) : (
          <WarehouseArchitectureScene
            contentsByShelf={{
              [selectedShelfCode ?? ""]: contentsQuery.data ?? [],
            }}
            erroredShelfCodes={new Set()}
            layout={layoutQuery.data}
            layoutSource="api"
            loadingShelfCodes={
              contentsQuery.isLoading && selectedShelfCode
                ? new Set([selectedShelfCode])
                : new Set()
            }
            onBackToMap={() => setSceneMode("map")}
            onOpenRack={handleOpenRack}
            onRetryShelf={() => void contentsQuery.refetch()}
            onSelectShelf={setSelectedShelfCode}
            rackGroup={rackGroup}
            route={null}
            sceneMode={sceneMode}
            selectedRackCode={selectedRackCode}
            selectedShelfCode={selectedShelfCode}
            suggestions={[]}
            suggestedShelfCodes={new Set()}
            unsupportedShelfCodes={new Set()}
          />
        )}
      </div>

      <WarehouseLayoutInspector
        canEdit={canEdit}
        layout={layoutQuery.data}
        onDelete={() => {
          // Xoá không nằm trong scope task này — để trống handler an toàn
          // (không throw); nút xóa vẫn hiển thị nhưng không phá huỷ dữ liệu.
        }}
        onPatch={handlePatch}
        onRotate={() => {
          if (!selection) return;
          const current =
            selection.kind === "zone"
              ? layoutQuery.data.zones.find((z) => z.id === selection.id)
              : selection.kind === "rack"
                ? layoutQuery.data.racks.find((r) => r.id === selection.id)
                : null;
          if (!current) return;
          handlePatch({ rotation: current.rotation === 0 ? 90 : 0 });
        }}
        selection={selection}
      />
    </div>
  );
}
