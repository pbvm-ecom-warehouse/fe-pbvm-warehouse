"use client";

import { useRef, type PointerEvent as ReactPointerEvent } from "react";

import { cn } from "@/lib/utils";
import type {
  WarehouseLayout,
  WarehouseLayoutAisle,
  WarehouseLayoutGate,
  WarehouseLayoutRack,
  WarehouseLayoutZone,
  WarehouseRoute,
} from "@/types/api";

import {
  getAisleRect,
  getRackRect,
  getZoneRect,
  snapToGrid,
  type LayoutRect,
} from "../utils/warehouse-layout";

export type LayoutElementKind = "zone" | "rack" | "aisle" | "gate";
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

function isSelected(
  selection: LayoutSelection,
  kind: LayoutElementKind,
  id: string,
) {
  return selection?.kind === kind && selection.id === id;
}

function getPoint(
  svg: SVGSVGElement,
  event: ReactPointerEvent<SVGSVGElement | SVGElement>,
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

function routePoints(route: WarehouseRoute | null) {
  return route?.waypoints.map((point) => `${point.x},${point.y}`).join(" ") ?? "";
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
  layout,
  onMoveElement,
  onOpenRack,
  onInteractionEnd,
  onInteractionStart,
  onResizeElement,
  onSelect,
  route = null,
  selectedRackCode = null,
  selection = null,
}: {
  className?: string;
  editable?: boolean;
  layout: WarehouseLayout;
  onMoveElement?: (
    selection: NonNullable<LayoutSelection>,
    position: { xM: number; yM: number },
  ) => void;
  onInteractionEnd?: () => void;
  onInteractionStart?: () => void;
  onOpenRack?: (rackCode: string, shelfCode: string) => void;
  onResizeElement?: (
    selection: NonNullable<LayoutSelection>,
    size: { widthM: number; heightM: number },
  ) => void;
  onSelect?: (selection: LayoutSelection) => void;
  route?: WarehouseRoute | null;
  selectedRackCode?: string | null;
  selection?: LayoutSelection;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const { widthM, heightM, gridM } = layout.canvas;
  const layoutDomId = layout.id ?? "single-warehouse-layout";
  const patternId = `warehouse-grid-${layoutDomId}`;
  const hatchId = `warehouse-zone-hatch-${layoutDomId}`;
  const arrowId = `warehouse-route-arrow-${layoutDomId}`;

  function startDrag(
    event: ReactPointerEvent<SVGElement>,
    nextSelection: NonNullable<LayoutSelection>,
    rect: LayoutRect,
    action: DragState["action"],
  ) {
    if (!editable || !svgRef.current) {
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
    const drag = dragRef.current;
    if (!drag || !svgRef.current) {
      return;
    }

    const point = getPoint(svgRef.current, event);
    const deltaX = point.x - drag.startPoint.x;
    const deltaY = point.y - drag.startPoint.y;

    if (drag.action === "move") {
      const position = {
        xM: snapToGrid(drag.startRect.xM + deltaX, gridM),
        yM: snapToGrid(drag.startRect.yM + deltaY, gridM),
      };
      if (
        position.xM === drag.startRect.xM &&
        position.yM === drag.startRect.yM
      ) {
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
      widthM: Math.max(gridM, snapToGrid(drag.startRect.widthM + deltaX, gridM)),
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
    event.stopPropagation();
    onSelect?.(nextSelection);
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
        className="block h-auto min-h-[420px] w-full touch-none select-none"
        onPointerDown={() => onSelect?.(null)}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        preserveAspectRatio="xMidYMid meet"
        ref={svgRef}
        role="group"
        viewBox={`-1.8 -1.8 ${widthM + 3.6} ${heightM + 3.6}`}
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
          <marker
            id={arrowId}
            markerHeight="5"
            markerUnits="strokeWidth"
            markerWidth="5"
            orient="auto"
            refX="4"
            refY="2.5"
          >
            <path d="M0,0 L5,2.5 L0,5 Z" fill="#1d4ed8" />
          </marker>
        </defs>

        <rect fill="#fbfcfb" height={heightM} width={widthM} x="0" y="0" />
        <rect fill={`url(#${patternId})`} height={heightM} width={widthM} />

        {layout.zones.map((zone) => {
          const rect = zoneRect(zone);
          const selected = isSelected(selection, "zone", zone.id);

          return (
            <g
              aria-label={`${zone.name}, ${rect.widthM} x ${rect.heightM} mét`}
              className={editable ? "cursor-move" : undefined}
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
                stroke={selected ? "#1d4ed8" : "#64748b"}
                strokeDasharray={selected ? undefined : "0.35 0.2"}
                strokeWidth={selected ? 0.16 : 0.08}
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
                    startDrag(event, { kind: "zone", id: zone.id }, rect, "resize")
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
          const isMain = aisle.type === "MAIN";
          const horizontal = rect.widthM >= rect.heightM;
          const centerX = rect.xM + rect.widthM / 2;
          const centerY = rect.yM + rect.heightM / 2;

          return (
            <g
              aria-label={`${isMain ? "Đường chính" : "Lối giữa kệ"} ${aisle.code}`}
              className={editable ? "cursor-move" : undefined}
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
                stroke={selected ? "#1d4ed8" : isMain ? "#94a3b8" : "#cbd5e1"}
                strokeWidth={selected ? 0.16 : 0.06}
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

        {route ? (
          <polyline
            fill="none"
            markerEnd={`url(#${arrowId})`}
            points={routePoints(route)}
            stroke="#1d4ed8"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={0.28}
          />
        ) : null}

        {layout.racks.map((rack) => {
          const rect = rackRect(rack);
          const selected =
            isSelected(selection, "rack", rack.id) ||
            rack.code === selectedRackCode;
          const bayWidth = rect.widthM / rack.bayCount;

          return (
            <g
              aria-label={`Mở ${rack.name}`}
              aria-pressed={selected}
              className="cursor-pointer"
              key={rack.id}
              onClick={() => onOpenRack?.(rack.code, rack.shelfCodes[0] ?? rack.code)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpenRack?.(rack.code, rack.shelfCodes[0] ?? rack.code);
                }
              }}
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
                  stroke="#1d4ed8"
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
                stroke={selected ? "#1d4ed8" : "#475569"}
                strokeWidth={selected ? 0.14 : 0.08}
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
              {editable && isSelected(selection, "rack", rack.id) ? (
                <LayoutResizeHandle
                  onPointerDown={(event) =>
                    startDrag(event, { kind: "rack", id: rack.id }, rect, "resize")
                  }
                  rect={rect}
                />
              ) : null}
            </g>
          );
        })}

        {layout.gates.map((gate: WarehouseLayoutGate) => {
          const selected = isSelected(selection, "gate", gate.id);
          const gateRect = {
            xM: gate.xM - 0.5,
            yM: gate.yM - 0.5,
            widthM: 1,
            heightM: 1,
          };

          return (
            <g
              aria-label={gate.label}
              className={editable ? "cursor-move" : undefined}
              key={gate.id}
              onPointerDown={(event) =>
                startDrag(event, { kind: "gate", id: gate.id }, gateRect, "move")
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
                fill="#0f766e"
                r={selected ? 0.42 : 0.32}
                stroke="white"
                strokeWidth={0.1}
              />
              <text
                fill="#0f766e"
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
    </div>
  );
}
