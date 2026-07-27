"use client";

import {
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { Maximize2, Minus, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import type {
  WarehouseLayout,
  WarehouseLayoutAisle,
  WarehouseLayoutGate,
  WarehouseLayoutRack,
  WarehouseLayoutZone,
} from "@/types/api";

import {
  getAisleRect,
  getRackRect,
  getZoneRect,
  snapToGrid,
  type LayoutRect,
} from "../utils/warehouse-layout";

export type LayoutElementKind = "zone" | "rack" | "aisle" | "gate";
export type WarehouseEditorTool =
  | "select"
  | "pan"
  | "zone"
  | "rack"
  | "aisle"
  | "gate";
export type LayoutSelection = {
  kind: LayoutElementKind;
  id: string;
} | null;

type DragState = {
  action: "move" | "resize";
  changed: boolean;
  pointerId: number;
  selection: NonNullable<LayoutSelection>;
  startPoint: { x: number; y: number };
  startRect: LayoutRect;
};

type ViewBox = { x: number; y: number; width: number; height: number };

type PanState = {
  pointerId: number;
  startClient: { x: number; y: number };
  startViewBox: ViewBox;
};

function isSelected(
  selection: LayoutSelection,
  kind: LayoutElementKind,
  id: string,
) {
  return selection?.kind === kind && selection.id === id;
}

function getPoint(
  svg: SVGSVGElement,
  event:
    | ReactPointerEvent<SVGSVGElement | SVGElement>
    | ReactWheelEvent<SVGSVGElement>,
) {
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const matrix = svg.getScreenCTM()?.inverse();
  const transformed = matrix ? point.matrixTransform(matrix) : point;

  return { x: transformed.x, y: transformed.y };
}

function zoneRect(zone: WarehouseLayoutZone) {
  return getZoneRect(zone);
}

function rackRect(rack: WarehouseLayoutRack) {
  return getRackRect(rack);
}

function aisleRect(aisle: WarehouseLayoutAisle) {
  return getAisleRect(aisle);
}

function LayoutResizeHandle({
  rect,
  onPointerDown,
}: {
  rect: LayoutRect;
  onPointerDown: (event: ReactPointerEvent<SVGRectElement>) => void;
}) {
  const size = 0.55;

  return (
    <rect
      aria-label="Thay đổi kích thước"
      className="cursor-nwse-resize fill-primary stroke-white"
      height={size}
      onPointerDown={onPointerDown}
      role="button"
      rx={0.08}
      strokeWidth={0.12}
      tabIndex={0}
      width={size}
      x={rect.xM + rect.widthM - size / 2}
      y={rect.yM + rect.heightM - size / 2}
    />
  );
}

export function WarehouseFloorPlan({
  className,
  editable = false,
  invalidSelectionKeys = new Set<string>(),
  layout,
  onCreate,
  onMoveElement,
  onInteractionEnd,
  onInteractionStart,
  onResizeElement,
  onSelect,
  selection = null,
  tool = "select",
}: {
  className?: string;
  editable?: boolean;
  invalidSelectionKeys?: ReadonlySet<string>;
  layout: WarehouseLayout;
  onCreate?: (
    kind: LayoutElementKind,
    point: { xM: number; yM: number },
  ) => void;
  onMoveElement?: (
    selection: NonNullable<LayoutSelection>,
    position: { xM: number; yM: number },
  ) => void;
  onInteractionEnd?: () => void;
  onInteractionStart?: () => void;
  onResizeElement?: (
    selection: NonNullable<LayoutSelection>,
    size: { widthM: number; heightM: number },
  ) => void;
  onSelect?: (selection: LayoutSelection) => void;
  selection?: LayoutSelection;
  tool?: WarehouseEditorTool;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const panRef = useRef<PanState | null>(null);
  const { widthM, heightM, gridM } = layout.canvas;
  const defaultViewBox = {
    x: -1.8,
    y: -1.8,
    width: widthM + 3.6,
    height: heightM + 3.6,
  };
  const [viewBox, setViewBox] = useState<ViewBox>(defaultViewBox);
  const layoutDomId = layout.id;
  const patternId = `warehouse-grid-${layoutDomId}`;
  const hatchId = `warehouse-zone-hatch-${layoutDomId}`;

  function startDrag(
    event: ReactPointerEvent<SVGElement>,
    nextSelection: NonNullable<LayoutSelection>,
    rect: LayoutRect,
    action: DragState["action"],
  ) {
    if (!editable || !svgRef.current || tool !== "select") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onSelect?.(nextSelection);
    svgRef.current.setPointerCapture(event.pointerId);
    dragRef.current = {
      action,
      changed: false,
      pointerId: event.pointerId,
      selection: nextSelection,
      startPoint: getPoint(svgRef.current, event),
      startRect: rect,
    };
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const pan = panRef.current;
    if (pan && svgRef.current) {
      const bounds = svgRef.current.getBoundingClientRect();
      const deltaX =
        ((event.clientX - pan.startClient.x) / Math.max(bounds.width, 1)) *
        pan.startViewBox.width;
      const deltaY =
        ((event.clientY - pan.startClient.y) / Math.max(bounds.height, 1)) *
        pan.startViewBox.height;
      setViewBox({
        ...pan.startViewBox,
        x: pan.startViewBox.x - deltaX,
        y: pan.startViewBox.y - deltaY,
      });
      return;
    }

    const drag = dragRef.current;
    if (!drag || !svgRef.current) {
      return;
    }

    const point = getPoint(svgRef.current, event);
    const deltaX = point.x - drag.startPoint.x;
    const deltaY = point.y - drag.startPoint.y;

    if (drag.action === "move") {
      const gateOffset = drag.selection.kind === "gate" ? 0.5 : 0;
      const originalX = drag.startRect.xM + gateOffset;
      const originalY = drag.startRect.yM + gateOffset;
      const position = {
        xM: snapToGrid(originalX + deltaX, gridM),
        yM: snapToGrid(originalY + deltaY, gridM),
      };
      if (position.xM === originalX && position.yM === originalY) {
        return;
      }
      if (!drag.changed) {
        drag.changed = true;
        onInteractionStart?.();
      }
      onMoveElement?.(drag.selection, position);
      return;
    }

    const size = {
      widthM: Math.max(
        gridM,
        snapToGrid(drag.startRect.widthM + deltaX, gridM),
      ),
      heightM: Math.max(
        gridM,
        snapToGrid(drag.startRect.heightM + deltaY, gridM),
      ),
    };
    if (
      size.widthM === drag.startRect.widthM &&
      size.heightM === drag.startRect.heightM
    ) {
      return;
    }
    if (!drag.changed) {
      drag.changed = true;
      onInteractionStart?.();
    }
    onResizeElement?.(drag.selection, size);
  }

  function handlePointerUp(event: ReactPointerEvent<SVGSVGElement>) {
    if (panRef.current?.pointerId === event.pointerId) {
      panRef.current = null;
      svgRef.current?.releasePointerCapture(event.pointerId);
      return;
    }

    if (dragRef.current?.pointerId === event.pointerId) {
      const changed = dragRef.current.changed;
      dragRef.current = null;
      svgRef.current?.releasePointerCapture(event.pointerId);
      if (changed) {
        onInteractionEnd?.();
      }
    }
  }

  function selectElement(
    event: ReactPointerEvent<SVGElement>,
    nextSelection: NonNullable<LayoutSelection>,
  ) {
    if (tool !== "select") return;
    event.stopPropagation();
    onSelect?.(nextSelection);
  }

  function handleCanvasPointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (!svgRef.current) return;

    if (tool === "pan" || event.button === 1) {
      event.preventDefault();
      svgRef.current.setPointerCapture(event.pointerId);
      panRef.current = {
        pointerId: event.pointerId,
        startClient: { x: event.clientX, y: event.clientY },
        startViewBox: viewBox,
      };
      return;
    }

    if (tool === "select") {
      onSelect?.(null);
      return;
    }

    if (!editable) return;
    const point = getPoint(svgRef.current, event);
    if (point.x < 0 || point.y < 0 || point.x > widthM || point.y > heightM) {
      return;
    }
    onCreate?.(tool, {
      xM: snapToGrid(point.x, gridM),
      yM: snapToGrid(point.y, gridM),
    });
  }

  function zoom(factor: number, center?: { x: number; y: number }) {
    const nextWidth = Math.min(
      widthM * 3,
      Math.max(widthM / 5, viewBox.width * factor),
    );
    const nextHeight = nextWidth * (viewBox.height / viewBox.width);
    const target = center ?? {
      x: viewBox.x + viewBox.width / 2,
      y: viewBox.y + viewBox.height / 2,
    };
    const xRatio = (target.x - viewBox.x) / viewBox.width;
    const yRatio = (target.y - viewBox.y) / viewBox.height;
    setViewBox({
      x: target.x - nextWidth * xRatio,
      y: target.y - nextHeight * yRatio,
      width: nextWidth,
      height: nextHeight,
    });
  }

  function handleWheel(event: ReactWheelEvent<SVGSVGElement>) {
    if (!svgRef.current) return;
    event.preventDefault();
    zoom(event.deltaY > 0 ? 1.12 : 0.88, getPoint(svgRef.current, event));
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden border border-slate-300 bg-[#f5f7f6] shadow-inner",
        className,
      )}
    >
      <svg
        aria-label="Sơ đồ kho"
        className={cn(
          "block h-full min-h-[420px] w-full touch-none select-none",
          tool === "pan" ? "cursor-grab active:cursor-grabbing" : null,
          tool !== "pan" && tool !== "select" ? "cursor-crosshair" : null,
        )}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        preserveAspectRatio="xMidYMid meet"
        ref={svgRef}
        role="group"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
      >
        <defs>
          <pattern
            height={gridM}
            id={patternId}
            patternUnits="userSpaceOnUse"
            width={gridM}
          >
            <path
              d={`M ${gridM} 0 L 0 0 0 ${gridM}`}
              fill="none"
              stroke="rgba(51,65,85,0.09)"
              strokeWidth={0.025}
            />
          </pattern>
          <pattern
            height={0.6}
            id={hatchId}
            patternTransform="rotate(45)"
            patternUnits="userSpaceOnUse"
            width={0.6}
          >
            <line
              stroke="rgba(51,65,85,0.12)"
              strokeWidth={0.06}
              x1="0"
              x2="0"
              y1="0"
              y2="0.6"
            />
          </pattern>
        </defs>

        <rect
          data-canvas-background
          fill="#fbfcfb"
          height={heightM}
          width={widthM}
          x="0"
          y="0"
        />
        <rect
          data-canvas-background
          fill={`url(#${patternId})`}
          height={heightM}
          width={widthM}
        />

        {layout.zones.map((zone) => {
          const rect = zoneRect(zone);
          const selected = isSelected(selection, "zone", zone.id);
          const invalid = invalidSelectionKeys.has(`zone:${zone.id}`);

          return (
            <g
              aria-label={`${zone.name}, ${rect.widthM} x ${rect.heightM} mét`}
              className={
                editable && tool === "select" ? "cursor-move" : undefined
              }
              data-layout-element
              key={zone.id}
              onPointerDown={(event) =>
                startDrag(event, { kind: "zone", id: zone.id }, rect, "move")
              }
              onPointerUp={(event) =>
                selectElement(event, { kind: "zone", id: zone.id })
              }
              role="button"
              tabIndex={0}
            >
              <rect
                fill={`url(#${hatchId})`}
                height={rect.heightM}
                rx={0.18}
                stroke={invalid ? "#dc2626" : selected ? "#1d4ed8" : "#64748b"}
                strokeDasharray={selected ? undefined : "0.35 0.2"}
                strokeWidth={invalid || selected ? 0.16 : 0.08}
                width={rect.widthM}
                x={rect.xM}
                y={rect.yM}
              />
              <text
                fill="#334155"
                fontSize="0.62"
                fontWeight="700"
                x={rect.xM + 0.45}
                y={rect.yM + 0.85}
              >
                {zone.name}
              </text>
              <text
                fill="#64748b"
                fontSize="0.38"
                x={rect.xM + 0.45}
                y={rect.yM + 1.45}
              >
                {rect.widthM} × {rect.heightM} m
              </text>
              {editable && selected ? (
                <LayoutResizeHandle
                  onPointerDown={(event) =>
                    startDrag(
                      event,
                      { kind: "zone", id: zone.id },
                      rect,
                      "resize",
                    )
                  }
                  rect={rect}
                />
              ) : null}
            </g>
          );
        })}

        {layout.aisles.map((aisle) => {
          const rect = aisleRect(aisle);
          const selected = isSelected(selection, "aisle", aisle.id);
          const invalid = invalidSelectionKeys.has(`aisle:${aisle.id}`);
          const isMain = aisle.type === "MAIN";
          const horizontal = rect.widthM >= rect.heightM;
          const centerX = rect.xM + rect.widthM / 2;
          const centerY = rect.yM + rect.heightM / 2;

          return (
            <g
              aria-label={`${isMain ? "Đường chính" : "Lối giữa kệ"} ${aisle.code}`}
              className={
                editable && tool === "select" ? "cursor-move" : undefined
              }
              data-layout-element
              key={aisle.id}
              onPointerDown={(event) =>
                startDrag(event, { kind: "aisle", id: aisle.id }, rect, "move")
              }
              onPointerUp={(event) =>
                selectElement(event, { kind: "aisle", id: aisle.id })
              }
              role="button"
              tabIndex={0}
            >
              <rect
                fill={isMain ? "#dfe5e7" : "#edf0ef"}
                height={rect.heightM}
                stroke={
                  invalid
                    ? "#dc2626"
                    : selected
                      ? "#1d4ed8"
                      : isMain
                        ? "#94a3b8"
                        : "#cbd5e1"
                }
                strokeWidth={invalid || selected ? 0.16 : 0.06}
                width={rect.widthM}
                x={rect.xM}
                y={rect.yM}
              />
              <line
                stroke={isMain ? "#64748b" : "#94a3b8"}
                strokeDasharray={isMain ? "0.55 0.35" : "0.25 0.25"}
                strokeWidth={isMain ? 0.1 : 0.055}
                x1={horizontal ? rect.xM + 0.25 : centerX}
                x2={horizontal ? rect.xM + rect.widthM - 0.25 : centerX}
                y1={horizontal ? centerY : rect.yM + 0.25}
                y2={horizontal ? centerY : rect.yM + rect.heightM - 0.25}
              />
              <text
                fill={isMain ? "#475569" : "#64748b"}
                fontSize={isMain ? "0.48" : "0.38"}
                fontWeight={isMain ? "700" : "600"}
                textAnchor="middle"
                x={centerX}
                y={centerY - 0.22}
              >
                {isMain ? "ĐƯỜNG CHÍNH" : aisle.code}
              </text>
              {editable && selected ? (
                <LayoutResizeHandle
                  onPointerDown={(event) =>
                    startDrag(
                      event,
                      { kind: "aisle", id: aisle.id },
                      rect,
                      "resize",
                    )
                  }
                  rect={rect}
                />
              ) : null}
            </g>
          );
        })}

        {layout.racks.map((rack) => {
          const rect = rackRect(rack);
          const invalid = invalidSelectionKeys.has(`rack:${rack.id}`);
          const selected = isSelected(selection, "rack", rack.id);
          const bayWidth = rect.widthM / rack.bayCount;

          return (
            <g
              aria-label={rack.name}
              aria-pressed={selected}
              className={tool === "select" ? "cursor-pointer" : undefined}
              data-layout-element
              key={rack.id}
              onPointerDown={(event) =>
                startDrag(event, { kind: "rack", id: rack.id }, rect, "move")
              }
              onPointerUp={(event) =>
                selectElement(event, { kind: "rack", id: rack.id })
              }
              role="button"
              tabIndex={0}
            >
              {selected ? (
                <rect
                  fill="none"
                  height={rect.heightM + 0.5}
                  rx={0.16}
                  stroke={invalid ? "#dc2626" : "#1d4ed8"}
                  strokeWidth={0.16}
                  width={rect.widthM + 0.5}
                  x={rect.xM - 0.25}
                  y={rect.yM - 0.25}
                />
              ) : null}
              <rect
                fill={selected ? "#dbeafe" : "#e2e8f0"}
                height={rect.heightM}
                rx={0.08}
                stroke={invalid ? "#dc2626" : selected ? "#1d4ed8" : "#475569"}
                strokeWidth={invalid || selected ? 0.14 : 0.08}
                width={rect.widthM}
                x={rect.xM}
                y={rect.yM}
              />
              {Array.from({ length: Math.max(0, rack.bayCount - 1) }).map(
                (_, index) => (
                  <line
                    key={index}
                    stroke="#94a3b8"
                    strokeWidth={0.04}
                    x1={rect.xM + bayWidth * (index + 1)}
                    x2={rect.xM + bayWidth * (index + 1)}
                    y1={rect.yM}
                    y2={rect.yM + rect.heightM}
                  />
                ),
              )}
              <text
                dominantBaseline="middle"
                fill="#0f172a"
                fontSize="0.48"
                fontWeight="700"
                textAnchor="middle"
                x={rect.xM + rect.widthM / 2}
                y={rect.yM + rect.heightM / 2}
              >
                {rack.code} · {rack.levelCount} tầng
              </text>
            </g>
          );
        })}

        {layout.gates.map((gate: WarehouseLayoutGate) => {
          const selected = isSelected(selection, "gate", gate.id);
          const invalid = invalidSelectionKeys.has(`gate:${gate.id}`);
          const gateRect = {
            xM: gate.xM - 0.5,
            yM: gate.yM - 0.5,
            widthM: 1,
            heightM: 1,
          };

          return (
            <g
              aria-label={gate.label}
              className={
                editable && tool === "select" ? "cursor-move" : undefined
              }
              data-layout-element
              key={gate.id}
              onPointerDown={(event) =>
                startDrag(
                  event,
                  { kind: "gate", id: gate.id },
                  gateRect,
                  "move",
                )
              }
              onPointerUp={(event) =>
                selectElement(event, { kind: "gate", id: gate.id })
              }
              role="button"
              tabIndex={0}
            >
              <circle
                cx={gate.xM}
                cy={gate.yM}
                fill={invalid ? "#dc2626" : "#0f766e"}
                r={selected ? 0.42 : 0.32}
                stroke="white"
                strokeWidth={0.1}
              />
              <text
                fill={invalid ? "#dc2626" : "#0f766e"}
                fontSize="0.42"
                fontWeight="700"
                textAnchor="middle"
                x={gate.xM}
                y={gate.yM - 0.65}
              >
                {gate.code}
              </text>
            </g>
          );
        })}

        <rect
          fill="none"
          height={heightM}
          pointerEvents="none"
          stroke="#1e293b"
          strokeWidth={0.22}
          width={widthM}
          x="0"
          y="0"
        />
        <line
          stroke="#475569"
          strokeWidth={0.05}
          x1="0"
          x2={widthM}
          y1="-0.75"
          y2="-0.75"
        />
        <text
          fill="#475569"
          fontSize="0.42"
          textAnchor="middle"
          x={widthM / 2}
          y="-0.95"
        >
          {widthM} m
        </text>
        <line
          stroke="#475569"
          strokeWidth={0.05}
          x1="-0.75"
          x2="-0.75"
          y1="0"
          y2={heightM}
        />
        <text
          fill="#475569"
          fontSize="0.42"
          textAnchor="middle"
          transform={`rotate(-90 -1 ${heightM / 2})`}
          x="-1"
          y={heightM / 2}
        >
          {heightM} m
        </text>
      </svg>

      <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-lg border border-slate-200 bg-white/95 p-1 shadow-sm backdrop-blur">
        <button
          aria-label="Thu nhỏ"
          className="grid size-8 place-items-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-950"
          onClick={() => zoom(1.2)}
          type="button"
        >
          <Minus className="size-4" />
        </button>
        <button
          aria-label="Vừa màn hình"
          className="grid size-8 place-items-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-950"
          onClick={() => setViewBox(defaultViewBox)}
          type="button"
        >
          <Maximize2 className="size-4" />
        </button>
        <button
          aria-label="Phóng to"
          className="grid size-8 place-items-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-950"
          onClick={() => zoom(0.8)}
          type="button"
        >
          <Plus className="size-4" />
        </button>
      </div>

      <div className="pointer-events-none absolute right-3 top-3 rounded-md border border-slate-200 bg-white/90 px-2 py-1 font-mono text-[10px] text-slate-500 shadow-sm">
        Lưới {gridM} m · {widthM} × {heightM} m
      </div>
    </div>
  );
}
