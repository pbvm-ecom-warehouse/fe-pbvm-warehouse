"use client";

import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DoorOpen,
  Eye,
  Hand,
  LoaderCircle,
  MousePointer2,
  Redo2,
  RefreshCw,
  Route,
  Rows3,
  Save,
  SquareDashed,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getApiErrorCode, getApiErrorMessage } from "@/lib/api-contract";
import { hasAnyRole } from "@/lib/rbac";
import { useSessionUser } from "@/hooks/use-session-user";
import {
  listRackCells,
  type StorageCellView,
} from "@/features/warehouse-navigation/services/warehouse-operations.service";
import { RackCellViewer } from "@/features/warehouse-navigation/components/rack-cell-viewer";
import type {
  WarehouseLayout,
  WarehouseLayoutGate,
  WarehouseLayoutRack,
  WarehouseLayoutRotation,
  WarehouseLayoutZone,
} from "@/types/api";

import {
  fetchWarehouseLayout,
  resetWarehouseLayout,
  saveWarehouseLayout,
} from "../services/warehouse-layout.service";
import { useWarehouseEditor } from "../hooks/use-warehouse-editor";
import {
  reconcileRackShelves,
  setStagingRack,
} from "../utils/warehouse-layout-operations";
import {
  findRackAccessPoint,
  getAisleRect,
  getZoneRect,
  isRackHeightWhitelistIssue,
  isRectInside,
  reconnectRackAccessPoints,
  snapToGrid,
  validateWarehouseLayoutClient,
} from "../utils/warehouse-layout";
import {
  WarehouseFloorPlan,
  type LayoutElementKind,
  type LayoutSelection,
  type WarehouseEditorTool,
} from "./warehouse-floor-plan";
import { WarehouseLayoutInspector } from "./warehouse-layout-inspector";

const layoutKey = ["warehouse-layout"] as const;

type LayoutValidationIssue = {
  entity: string;
  id?: string;
  clientId?: string;
  field?: string;
  code: string;
};

const tools: Array<{
  id: WarehouseEditorTool | "view";
  label: string;
  icon: typeof MousePointer2;
}> = [
  { id: "select", label: "Chọn", icon: MousePointer2 },
  { id: "view", label: "Xem", icon: Eye },
  { id: "pan", label: "Di chuyển", icon: Hand },
  { id: "zone", label: "Khu vực", icon: SquareDashed },
  { id: "rack", label: "Rack", icon: Rows3 },
  { id: "aisle", label: "Lối đi", icon: Route },
  { id: "gate", label: "Cổng", icon: DoorOpen },
];

function temporaryId() {
  return `tmp:${crypto.randomUUID()}`;
}

function nextCode(prefix: string, codes: string[]) {
  const used = new Set(codes.map((code) => code.toUpperCase()));
  let index = 1;
  while (used.has(`${prefix}-${String(index).padStart(2, "0")}`)) index += 1;
  return `${prefix}-${String(index).padStart(2, "0")}`;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

function getErrorDetails(error: unknown) {
  return (
    error as {
      response?: {
        data?: {
          error?: {
            details?: {
              currentRevision?: number;
              issues?: LayoutValidationIssue[];
            };
          };
        };
      };
    }
  ).response?.data?.error?.details;
}

function formatLayoutError(error: unknown, fallback: string) {
  const code = getApiErrorCode(error);
  const messages: Record<string, string> = {
    STAGING_SHELF_CANNOT_DELETE:
      "Không thể xoá vị trí nhận hàng tạm. Hãy chọn một tầng kệ khác làm vị trí nhận hàng tạm trước, rồi xoá lại.",
    LAYOUT_RESET_REQUIRES_EMPTY_STOCK:
      "Không thể reset sơ đồ vì vẫn còn hàng tồn trên kệ. Hãy chuyển hoặc xuất hết hàng khỏi các kệ trước.",
    RACK_HAS_SHELVES:
      "Không thể xoá rack vì rack vẫn còn tầng kệ. Hãy xoá tầng kệ hoặc dùng Reset sơ đồ nếu muốn dựng lại từ đầu.",
    ZONE_HAS_RACKS:
      "Không thể xoá khu vực vì khu vực vẫn còn rack. Hãy xoá hoặc chuyển rack trước.",
    SHELF_HAS_STOCK: "Không thể xoá tầng kệ vì tầng này vẫn còn hàng tồn.",
    RACK_TEMPLATE_STOCK_CONFLICT:
      "Không thể thu nhỏ kệ vì một hoặc nhiều khoang vẫn đang có hàng tồn.",
  };

  return (code && messages[code]) || getApiErrorMessage(error) || fallback;
}

function selectionExists(layout: WarehouseLayout, selection: LayoutSelection) {
  if (!selection) return false;
  const collection =
    selection.kind === "zone"
      ? layout.zones
      : selection.kind === "rack"
        ? layout.racks
        : selection.kind === "aisle"
          ? layout.aisles
          : layout.gates;
  return collection.some((item) => item.id === selection.id);
}

function isEditableEventTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tagName = target.tagName;
  return (
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT" ||
    Boolean(target.closest("[contenteditable='true']"))
  );
}

function WarehouseEditor({
  initialLayout,
  onReload,
}: {
  initialLayout: WarehouseLayout;
  onReload: () => Promise<WarehouseLayout>;
}) {
  const user = useSessionUser();
  const canEdit = hasAnyRole(user?.roles, ["MANAGER", "ADMIN"]);
  const queryClient = useQueryClient();
  const editor = useWarehouseEditor(initialLayout);
  const [tool, setTool] = useState<WarehouseEditorTool>("select");
  const [selection, setSelection] = useState<LayoutSelection>(null);
  const [conflictRevision, setConflictRevision] = useState<number | null>(null);
  const [issues, setIssues] = useState<LayoutValidationIssue[]>([]);
  const [clientErrors, setClientErrors] = useState<string[]>([]);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewRackId, setViewRackId] = useState("");
  const [rackDialogOpen, setRackDialogOpen] = useState(false);
  const [viewportResetKey, setViewportResetKey] = useState(0);

  const invalidSelectionKeys = useMemo(() => {
    const keys = new Set(
      issues.flatMap((issue) => {
        const id = issue.id ?? issue.clientId;
        return id ? [`${issue.entity.toLowerCase()}:${id}`] : [];
      }),
    );
    editor.draftLayout.racks.forEach((rack) => {
      const connected = editor.draftLayout.aisles.some((aisle) =>
        isRectInside(
          {
            xM: rack.accessPoint.xM,
            yM: rack.accessPoint.yM,
            widthM: 0,
            heightM: 0,
          },
          getAisleRect(aisle),
        ),
      );
      if (!connected) keys.add(`rack:${rack.id}`);
    });
    return keys;
  }, [editor.draftLayout, issues]);

  const activeSelection =
    selection && selectionExists(editor.draftLayout, selection)
      ? selection
      : null;
  const hasStagingShelf = editor.draftLayout.shelves.some(
    (shelf) => shelf.isStaging,
  );
  const selectedViewRack = editor.draftLayout.racks.find(
    (rack) => rack.id === viewRackId,
  );
  const viewCellsQuery = useQuery({
    enabled: rackDialogOpen && Boolean(viewRackId),
    queryKey: ["warehouse-layout", "view-rack-cells", viewRackId],
    queryFn: () => listRackCells(viewRackId),
  });

  const saveMutation = useMutation({
    mutationFn: saveWarehouseLayout,
    onSuccess: (result) => {
      editor.reset(result.layout);
      setIssues([]);
      setClientErrors([]);
      setConflictRevision(null);
      if (!selectionExists(result.layout, activeSelection)) setSelection(null);
      queryClient.setQueryData(layoutKey, result.layout);
      toast.success(`Đã lưu bản đồ kho · revision ${result.revision}.`);
    },
    onError: (error) => {
      const code = getApiErrorCode(error);
      const details = getErrorDetails(error);
      if (code === "LAYOUT_REVISION_CONFLICT") {
        setConflictRevision(details?.currentRevision ?? null);
        return;
      }
      if (isRackHeightWhitelistIssue(details?.issues)) {
        toast.error(
          "Backend đang chạy phiên bản cũ, chưa hỗ trợ chiều cao kệ. Hãy build và khởi động lại backend từ nhánh develop.",
        );
        return;
      }
      if (code === "LAYOUT_VALIDATION_FAILED") {
        setIssues(details?.issues ?? []);
        toast.error(
          "Bản đồ còn vị trí chưa hợp lệ. Các phần tử lỗi đã được đánh dấu.",
        );
        return;
      }
      toast.error(formatLayoutError(error, "Không thể lưu bản đồ kho."));
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const latestLayout = await onReload();
      return resetWarehouseLayout(latestLayout.revision);
    },
    onSuccess: (layout) => {
      editor.reset(layout);
      setSelection(null);
      setIssues([]);
      setClientErrors([]);
      setConflictRevision(null);
      setViewportResetKey((value) => value + 1);
      queryClient.setQueryData(layoutKey, layout);
      toast.success(
        "Đã reset sơ đồ kho. Hãy tạo lại khu vực, rack và chọn một tầng kệ làm vị trí nhận hàng tạm.",
      );
    },
    onError: (error) => {
      toast.error(formatLayoutError(error, "Không thể reset sơ đồ kho."));
    },
  });

  const busy = saveMutation.isPending || resetMutation.isPending;

  function updateElement(
    target: NonNullable<LayoutSelection>,
    patch: Record<string, unknown>,
    live = false,
  ) {
    const updater = (layout: WarehouseLayout) => {
      if (target.kind === "zone") {
        layout.zones = layout.zones.map((item) =>
          item.id === target.id ? { ...item, ...patch } : item,
        ) as WarehouseLayoutZone[];
      } else if (target.kind === "rack") {
        layout.racks = layout.racks.map((item) => {
          if (item.id !== target.id) return item;
          const next = { ...item, ...patch } as WarehouseLayoutRack;
          if (typeof patch.xM === "number") {
            next.accessPoint = {
              ...next.accessPoint,
              xM: next.accessPoint.xM + patch.xM - item.xM,
            };
          }
          if (typeof patch.yM === "number") {
            next.accessPoint = {
              ...next.accessPoint,
              yM: next.accessPoint.yM + patch.yM - item.yM,
            };
          }
          return next;
        });
      } else if (target.kind === "aisle") {
        layout.aisles = layout.aisles.map((item) =>
          item.id === target.id ? { ...item, ...patch } : item,
        );
      } else {
        layout.gates = layout.gates.map((item) =>
          item.id === target.id
            ? ({ ...item, ...patch } as WarehouseLayoutGate)
            : item,
        );
      }
      return target.kind === "rack" ||
        target.kind === "aisle" ||
        target.kind === "zone"
        ? reconnectRackAccessPoints(layout)
        : layout;
    };

    if (live) editor.updateLive(updater);
    else editor.commit(updater);
    setIssues([]);
    setClientErrors([]);
  }

  function updateGroupElements(
    moves: Array<{
      selection: NonNullable<LayoutSelection>;
      position: { xM: number; yM: number };
    }>,
    live = false,
  ) {
    const moveByKey = new Map(
      moves.map((move) => [
        `${move.selection.kind}:${move.selection.id}`,
        move.position,
      ]),
    );
    const updater = (layout: WarehouseLayout) => {
      layout.zones = layout.zones.map((item) => {
        const position = moveByKey.get(`zone:${item.id}`);
        return position ? { ...item, ...position } : item;
      }) as WarehouseLayoutZone[];

      layout.racks = layout.racks.map((item) => {
        const position = moveByKey.get(`rack:${item.id}`);
        if (!position) return item;
        const deltaX = position.xM - item.xM;
        const deltaY = position.yM - item.yM;
        return {
          ...item,
          ...position,
          accessPoint: {
            ...item.accessPoint,
            xM: item.accessPoint.xM + deltaX,
            yM: item.accessPoint.yM + deltaY,
          },
        };
      });

      layout.aisles = layout.aisles.map((item) => {
        const position = moveByKey.get(`aisle:${item.id}`);
        return position ? { ...item, ...position } : item;
      });

      layout.gates = layout.gates.map((item) => {
        const position = moveByKey.get(`gate:${item.id}`);
        return position
          ? ({ ...item, ...position } as WarehouseLayoutGate)
          : item;
      });

      return reconnectRackAccessPoints(layout);
    };

    if (live) editor.updateLive(updater);
    else editor.commit(updater);
    setIssues([]);
    setClientErrors([]);
  }

  function createElement(
    kind: Exclude<LayoutElementKind, never>,
    point: { xM: number; yM: number },
  ) {
    if (!canEdit) return;
    const layout = editor.draftLayout;
    const grid = layout.canvas.gridM;
    const xM = snapToGrid(point.xM, grid);
    const yM = snapToGrid(point.yM, grid);
    const id = temporaryId();

    if (kind === "zone") {
      const widthM = Math.min(10, layout.canvas.widthM);
      const heightM = Math.min(8, layout.canvas.heightM);
      const zone: WarehouseLayoutZone = {
        id,
        code: nextCode(
          "ZONE",
          layout.zones.map((item) => item.code),
        ),
        name: `Khu vực ${layout.zones.length + 1}`,
        xM: clamp(xM, 0, layout.canvas.widthM - widthM),
        yM: clamp(yM, 0, layout.canvas.heightM - heightM),
        widthM,
        heightM,
        rotation: 0,
        zonePurpose: "STORAGE",
        allowedItemTypes: [],
      };
      editor.commit((next) => ({ ...next, zones: [...next.zones, zone] }));
      setSelection({ kind, id });
    } else if (kind === "rack") {
      const zone =
        (activeSelection?.kind === "zone"
          ? layout.zones.find((item) => item.id === activeSelection.id)
          : null) ??
        layout.zones.find((item) =>
          isRectInside(
            { xM, yM, widthM: grid, heightM: grid },
            getZoneRect(item),
          ),
        );
      if (!zone) {
        toast.error("Hãy chọn một khu vực hoặc đặt rack bên trong khu vực.");
        return;
      }
      const template = layout.rackTemplate;
      const zoneRect = getZoneRect(zone);
      const code = nextCode(
        "RACK",
        layout.racks.map((item) => item.code),
      );
      const rackX = clamp(
        xM,
        zoneRect.xM,
        zoneRect.xM + zoneRect.widthM - template.widthM,
      );
      const rackY = clamp(
        yM,
        zoneRect.yM,
        zoneRect.yM + zoneRect.heightM - template.depthM,
      );
      const rackDraft: WarehouseLayoutRack = {
        id,
        zoneId: zone.id,
        code,
        name: `Dãy kệ ${layout.racks.length + 1}`,
        xM: rackX,
        yM: rackY,
        widthM: template.widthM,
        depthM: template.depthM,
        rotation: 0,
        levelCount: template.levelCount,
        bayCount: template.bayCount,
        shelfCodes: Array.from(
          { length: template.levelCount },
          (_, index) => `${code}-T${index + 1}`,
        ),
        accessPoint: { xM: rackX, yM: rackY },
      };
      const accessPoint = findRackAccessPoint(rackDraft, layout.aisles, grid);
      if (!accessPoint) {
        toast.error(
          "Hãy tạo Đường chính hoặc Lối đi giữa rack trước khi tạo rack.",
        );
        return;
      }
      const rack = { ...rackDraft, accessPoint };
      const innerHeight = (template.heightM * 100) / template.levelCount;
      const shelves = rack.shelfCodes.map((shelfCode, index) => ({
        id: temporaryId(),
        rackId: id,
        level: index + 1,
        code: shelfCode,
        innerDepth: template.depthM * 100,
        innerWidth: template.widthM * 100,
        innerHeight,
        isStaging: false,
      }));
      editor.commit((next) => ({
        ...next,
        racks: [...next.racks, rack],
        shelves: [...next.shelves, ...shelves],
      }));
      setSelection({ kind, id });
    } else if (kind === "aisle") {
      const widthM = Math.min(8, layout.canvas.widthM);
      const heightM = Math.min(2, layout.canvas.heightM);
      const aisle = {
        id,
        code: nextCode(
          "AISLE",
          layout.aisles.map((item) => item.code),
        ),
        type: "RACK" as const,
        xM: clamp(xM, 0, layout.canvas.widthM - widthM),
        yM: clamp(yM, 0, layout.canvas.heightM - heightM),
        widthM,
        heightM,
      };
      editor.commit((next) =>
        reconnectRackAccessPoints({
          ...next,
          aisles: [...next.aisles, aisle],
        }),
      );
      setSelection({ kind, id });
    } else {
      const gate = {
        id,
        code: nextCode(
          "GATE",
          layout.gates.map((item) => item.code),
        ),
        label: `Cổng ${layout.gates.length + 1}`,
        xM: clamp(xM, 0, layout.canvas.widthM),
        yM: clamp(yM, 0, layout.canvas.heightM),
      };
      editor.commit((next) => ({ ...next, gates: [...next.gates, gate] }));
      setSelection({ kind, id });
    }

    setTool("select");
    setIssues([]);
    setConflictRevision(null);
  }

  function deleteSelection() {
    if (!canEdit || busy || !activeSelection) return;
    const currentSelection = activeSelection;
    const currentLayout = editor.draftLayout;
    if (
      currentSelection.kind === "zone" &&
      currentLayout.racks.some((rack) => rack.zoneId === currentSelection.id)
    ) {
      toast.error("Khu vực vẫn còn rack. Hãy xoá hoặc chuyển rack trước.");
      return;
    }
    editor.commit((layout) => {
      if (currentSelection.kind === "zone") {
        layout.zones = layout.zones.filter(
          (item) => item.id !== currentSelection.id,
        );
      } else if (currentSelection.kind === "rack") {
        if (
          currentLayout.shelves.some(
            (item) => item.rackId === currentSelection.id && item.isStaging,
          )
        ) {
          toast.error(
            "Rack này đang chứa vị trí nhận hàng tạm. Hãy chọn tầng kệ khác làm vị trí nhận hàng tạm trước.",
          );
          return layout;
        }
        layout.racks = layout.racks.filter(
          (item) => item.id !== currentSelection.id,
        );
        layout.shelves = layout.shelves.filter(
          (item) => item.rackId !== currentSelection.id,
        );
      } else if (currentSelection.kind === "aisle") {
        layout.aisles = layout.aisles.filter(
          (item) => item.id !== currentSelection.id,
        );
      } else {
        layout.gates = layout.gates.filter(
          (item) => item.id !== currentSelection.id,
        );
      }
      return currentSelection.kind === "aisle"
        ? reconnectRackAccessPoints(layout)
        : layout;
    });
    setSelection(null);
    setIssues([]);
    setClientErrors([]);
  }

  function rotateSelection() {
    if (
      !activeSelection ||
      (activeSelection.kind !== "zone" && activeSelection.kind !== "rack")
    )
      return;
    const item =
      activeSelection.kind === "zone"
        ? editor.draftLayout.zones.find(
            (entry) => entry.id === activeSelection.id,
          )
        : editor.draftLayout.racks.find(
            (entry) => entry.id === activeSelection.id,
          );
    if (!item) return;
    updateElement(activeSelection, {
      rotation: (item.rotation === 0 ? 90 : 0) as WarehouseLayoutRotation,
    });
  }

  function patchCanvas(patch: Record<string, number>) {
    editor.commit((layout) => ({
      ...layout,
      canvas: { ...layout.canvas, ...patch },
    }));
    setIssues([]);
  }

  function patchRackTemplate(patch: Record<string, number>) {
    editor.commit((layout) =>
      reconcileRackShelves({
        ...layout,
        rackTemplate: { ...layout.rackTemplate, ...patch },
      }),
    );
    setIssues([]);
  }

  function patchStagingRack(rackId: string) {
    editor.commit((layout) => {
      const rackShelves = layout.shelves.filter(
        (shelf) => shelf.rackId === rackId,
      );
      const isCurrentStagingRack =
        rackShelves.length > 0 && rackShelves.every((shelf) => shelf.isStaging);
      return setStagingRack(layout, isCurrentStagingRack ? null : rackId);
    });
    setIssues([]);
    setClientErrors([]);
  }

  function save() {
    const errors = validateWarehouseLayoutClient(editor.draftLayout);
    setClientErrors(errors);
    if (errors.length > 0) {
      toast.error("Hãy sửa các lỗi bố trí trước khi lưu.");
      return;
    }
    if (editor.operations.length === 0) return;
    setConflictRevision(null);
    saveMutation.mutate({
      expectedRevision: editor.baseLayout.revision,
      operations: editor.operations,
    });
  }

  function handleUndo() {
    if (!canEdit || !editor.canUndo || busy) return;
    editor.undo();
    setIssues([]);
    setClientErrors([]);
  }

  function handleRedo() {
    if (!canEdit || !editor.canRedo || busy) return;
    editor.redo();
    setIssues([]);
    setClientErrors([]);
  }

  function resetLayoutToEmpty() {
    if (!canEdit || busy) return;
    setResetDialogOpen(true);
  }

  function confirmResetLayoutToEmpty() {
    if (!canEdit || busy) return;
    setResetDialogOpen(false);
    resetMutation.mutate();
  }

  async function reloadCanonical() {
    const layout = await onReload();
    editor.reset(layout);
    setSelection(null);
    setIssues([]);
    setClientErrors([]);
    setConflictRevision(null);
    toast.success("Đã tải bản đồ mới nhất từ máy chủ.");
  }

  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (isEditableEventTarget(event.target)) return;
    if (event.altKey) return;

    if (event.key === "Delete") {
      if (!activeSelection) return;
      event.preventDefault();
      deleteSelection();
      return;
    }

    const key = event.key.toLowerCase();
    const wantsUndo = (event.ctrlKey || event.metaKey) && key === "z";
    const wantsRedo =
      (event.ctrlKey || event.metaKey) &&
      (key === "y" || (event.shiftKey && key === "z"));

    if (wantsUndo) {
      event.preventDefault();
      handleUndo();
      return;
    }

    if (wantsRedo) {
      event.preventDefault();
      handleRedo();
    }
  });

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="flex h-[calc(100dvh-7.25rem)] min-h-[640px] flex-col overflow-hidden bg-slate-100">
      <Dialog
        onOpenChange={(open) => {
          if (busy) return;
          setResetDialogOpen(open);
        }}
        open={resetDialogOpen}
      >
        <DialogContent size="md" className="gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-slate-200 bg-slate-50/80 px-6 py-5">
            <div className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 shadow-sm">
              <TriangleAlert className="size-5" />
            </div>
            <DialogTitle className="text-left text-lg font-semibold text-slate-950">
              Reset sơ đồ kho?
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 pt-1 text-left text-sm leading-6 text-slate-600">
                <p>
                  Thao tác này sẽ xoá toàn bộ khu vực, rack, tầng kệ, lối đi và
                  cổng đang có trên server.
                </p>
                <p>
                  Chỉ dùng khi bạn muốn dựng lại sơ đồ kho từ đầu. Canvas và mẫu
                  rack chuẩn vẫn được giữ lại.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-end gap-3 px-6 py-4">
            <Button
              disabled={busy}
              onClick={() => setResetDialogOpen(false)}
              variant="outline"
            >
              Huỷ
            </Button>
            <Button
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={busy}
              onClick={confirmResetLayoutToEmpty}
            >
              {resetMutation.isPending ? (
                <LoaderCircle
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : (
                <RefreshCw data-icon="inline-start" />
              )}
              Xoá toàn bộ sơ đồ
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <header className="flex min-h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-lg font-semibold text-slate-950">
              Bản đồ kho 2D
            </h1>
            <span
              className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600"
              title="Mỗi lần lưu hoặc reset sơ đồ sẽ tăng một phiên bản"
            >
              Phiên bản {editor.baseLayout.revision}
            </span>
            <span
              className={
                editor.isDirty
                  ? "rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700"
                  : "rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
              }
            >
              {editor.isDirty
                ? `${editor.operations.length} thay đổi chưa lưu`
                : "Đã đồng bộ"}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Chọn công cụ, đặt phần tử lên lưới rồi lưu toàn bộ thay đổi một lần.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            aria-label="Reset sơ đồ"
            disabled={!canEdit || busy}
            onClick={resetLayoutToEmpty}
            variant="outline"
          >
            <RefreshCw data-icon="inline-start" />
            Reset sơ đồ
          </Button>
          <Button
            aria-label="Hoàn tác"
            disabled={!canEdit || !editor.canUndo || busy}
            onClick={handleUndo}
            size="icon"
            variant="outline"
          >
            <Undo2 />
          </Button>
          <Button
            aria-label="Làm lại"
            disabled={!canEdit || !editor.canRedo || busy}
            onClick={handleRedo}
            size="icon"
            variant="outline"
          >
            <Redo2 />
          </Button>
          <Button
            aria-label="Lưu thay đổi"
            disabled={!canEdit || !editor.isDirty || busy}
            onClick={save}
          >
            {saveMutation.isPending ? (
              <LoaderCircle className="animate-spin" data-icon="inline-start" />
            ) : (
              <Save data-icon="inline-start" />
            )}
            Lưu thay đổi
          </Button>
        </div>
      </header>

      <Dialog
        open={viewDialogOpen}
        onOpenChange={(open) => {
          setViewDialogOpen(open);
          if (!open) {
            setViewRackId("");
            setRackDialogOpen(false);
          }
        }}
      >
        <DialogContent
          className="flex h-[92dvh] max-h-[92dvh] flex-col gap-0 overflow-hidden p-0"
          size="5xl"
        >
          <DialogHeader className="shrink-0 border-b px-5 py-4 pr-14">
            <DialogTitle>Chọn rack để xem mặt kệ</DialogTitle>
            <DialogDescription>
              Bấm vào rack trên bản đồ để mở mặt kệ 2D/3D.
            </DialogDescription>
          </DialogHeader>
          {editor.draftLayout.racks.length > 0 ? (
            <div className="min-h-0 flex-1 p-4">
              <WarehouseFloorPlan
                className="h-full rounded-xl border-slate-300 bg-white shadow-sm"
                editable={false}
                layout={editor.draftLayout}
                onSelect={(nextSelection) => {
                  if (nextSelection?.kind !== "rack") return;
                  setViewRackId(nextSelection.id);
                  setRackDialogOpen(true);
                }}
                selection={
                  viewRackId ? { kind: "rack", id: viewRackId } : null
                }
                tool="select"
              />
            </div>
          ) : (
            <div className="grid flex-1 place-items-center p-6 text-sm text-slate-500">
              Chưa có rack để xem mặt kệ.
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={rackDialogOpen} onOpenChange={setRackDialogOpen}>
        <DialogContent
          className="flex h-[92dvh] max-h-[92dvh] flex-col gap-0 overflow-hidden p-0"
          size="5xl"
        >
          <DialogHeader className="shrink-0 border-b px-5 py-4 pr-14">
            <DialogTitle>
              Mặt kệ {selectedViewRack?.code ?? "đã chọn"}
            </DialogTitle>
            <DialogDescription>
              Xem vị trí thực tế của hàng trên rack.
            </DialogDescription>
            <Button
              className="mt-1 w-fit"
              onClick={() => setRackDialogOpen(false)}
              size="sm"
              type="button"
              variant="outline"
            >
              Quay lại bản đồ
            </Button>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 p-4">
            {viewCellsQuery.isLoading ? (
              <div className="grid flex-1 place-items-center">
                <LoaderCircle className="size-5 animate-spin text-primary" />
              </div>
            ) : (
              <RackCellViewer
                rackCode={selectedViewRack?.code}
                cells={(viewCellsQuery.data ?? []) as StorageCellView[]}
                onActivateCell={() => {}}
                onSelectCell={() => {}}
                operation="PUTAWAY"
                showCellAction={false}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {conflictRevision !== null ? (
        <div className="flex items-center justify-between gap-4 border-b border-amber-200 bg-amber-50 px-5 py-2.5 text-sm text-amber-950">
          <span>
            Draft đang dựa trên phiên bản {editor.baseLayout.revision}; máy chủ
            hiện ở phiên bản {conflictRevision}. Draft của bạn vẫn được giữ.
          </span>
          <Button
            aria-label="Tải bản mới và bỏ draft"
            onClick={() => void reloadCanonical()}
            size="sm"
            variant="outline"
          >
            <RefreshCw data-icon="inline-start" />
            Tải bản mới và bỏ draft
          </Button>
        </div>
      ) : null}

      {!hasStagingShelf ? (
        <div className="border-b border-amber-200 bg-amber-50 px-5 py-2 text-xs text-amber-900">
          Chưa có vị trí nhận hàng tạm. Sau khi tạo rack, hãy chọn một tầng kệ
          làm vị trí nhận hàng tạm trước khi dùng nhập kho.
        </div>
      ) : null}

      {clientErrors.length > 0 ? (
        <div className="border-b border-red-200 bg-red-50 px-5 py-2 text-xs text-red-800">
          {clientErrors.slice(0, 3).join(" · ")}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <nav
          aria-label="Công cụ bản đồ kho"
          className="flex w-[84px] shrink-0 flex-col gap-1 border-r border-slate-200 bg-white p-2"
        >
          {tools.map((item) => {
            const Icon = item.icon;
            const active = item.id === tool;
            return (
              <button
                aria-label={item.label}
                aria-pressed={active}
                className={
                  active
                    ? "flex h-14 flex-col items-center justify-center gap-1 rounded-lg bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                    : "flex h-14 flex-col items-center justify-center gap-1 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                }
                disabled={
                  !canEdit &&
                  item.id !== "select" &&
                  item.id !== "pan" &&
                  item.id !== "view"
                }
                key={item.id}
                onClick={() => {
                  if (item.id === "view") {
                    setViewDialogOpen(true);
                    return;
                  }
                  setTool(item.id);
                }}
                type="button"
              >
                <Icon className="size-4" />
                <span className="text-[11px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <main className="relative min-w-0 flex-1 p-4">
          <WarehouseFloorPlan
            className="h-full rounded-xl border-slate-300 bg-white shadow-sm"
            editable={canEdit}
            invalidSelectionKeys={invalidSelectionKeys}
            key={`${viewportResetKey}:${editor.draftLayout.canvas.widthM}:${editor.draftLayout.canvas.heightM}:${editor.draftLayout.canvas.gridM}`}
            layout={editor.draftLayout}
            onCreate={createElement}
            onInteractionEnd={editor.endInteraction}
            onInteractionStart={editor.beginInteraction}
            onMoveElement={(target, position) =>
              updateElement(target, position, true)
            }
            onMoveGroup={(moves) => updateGroupElements(moves, true)}
            onResizeElement={(target, size) =>
              updateElement(target, size, true)
            }
            onSelect={setSelection}
            selection={activeSelection}
            tool={tool}
          />
        </main>

        <WarehouseLayoutInspector
          canEdit={canEdit}
          issues={issues}
          layout={editor.draftLayout}
          onDelete={deleteSelection}
          onPatch={(patch) =>
            activeSelection && updateElement(activeSelection, patch)
          }
          onPatchCanvas={patchCanvas}
          onPatchRackTemplate={patchRackTemplate}
          onSetStagingRack={patchStagingRack}
          onRotate={rotateSelection}
          selection={activeSelection}
        />
      </div>
    </div>
  );
}

export function WarehouseMapClient() {
  const layoutQuery = useQuery({
    queryKey: layoutKey,
    queryFn: fetchWarehouseLayout,
  });

  if (layoutQuery.isLoading) {
    return (
      <div className="grid h-[calc(100dvh-7.25rem)] place-items-center bg-slate-100 text-sm text-slate-500">
        <div className="flex items-center gap-2">
          <LoaderCircle className="size-4 animate-spin" />
          Đang tải bản đồ kho…
        </div>
      </div>
    );
  }

  if (layoutQuery.isError || !layoutQuery.data) {
    const contractError = layoutQuery.error as
      | { code?: string; missingFields?: string[] }
      | undefined;
    const backendIsOutdated =
      contractError?.code === "WAREHOUSE_LAYOUT_API_OUTDATED";

    return (
      <div className="grid h-[calc(100dvh-7.25rem)] place-items-center bg-slate-100">
        <div className="max-w-lg rounded-xl border border-red-200 bg-white p-6 text-center shadow-sm">
          {backendIsOutdated ? (
            <>
              <TriangleAlert className="mx-auto size-7 text-amber-600" />
              <h1 className="mt-3 text-base font-semibold text-slate-950">
                Backend WMS chưa có API editor 2D
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Snapshot đang thiếu: {contractError.missingFields?.join(", ")}.
                Cần deploy bản BE có GET/PATCH
                <span className="font-mono"> /location/layout</span> trước khi
                mở editor.
              </p>
            </>
          ) : (
            <p className="text-sm font-medium text-red-700">
              Không tải được bản đồ kho.
            </p>
          )}
          <Button
            className="mt-3"
            onClick={() => void layoutQuery.refetch()}
            size="sm"
            variant="outline"
          >
            <RefreshCw data-icon="inline-start" />
            Thử lại
          </Button>
        </div>
      </div>
    );
  }

  return (
    <WarehouseEditor
      initialLayout={layoutQuery.data}
      key={layoutQuery.data.revision}
      onReload={async () => {
        const result = await layoutQuery.refetch();
        if (!result.data) throw new Error("Không tải được bản đồ kho.");
        return result.data;
      }}
    />
  );
}
