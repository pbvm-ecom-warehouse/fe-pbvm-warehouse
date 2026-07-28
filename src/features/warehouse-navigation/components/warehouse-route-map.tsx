"use client";

import { useState } from "react";
import { Navigation, Warehouse } from "lucide-react";
import type { WarehouseLayout } from "@/types/api";
import { getRackRect } from "@/features/warehouse-layout/utils/warehouse-layout";
import type { NavigationPath } from "../services/putaway-navigation.service";

export function WarehouseRouteMap({
  layout,
  path,
  selectedRackId,
  onSelectRack,
}: {
  layout: WarehouseLayout;
  path?: NavigationPath;
  selectedRackId?: string;
  onSelectRack: (rackId: string) => void;
}) {
  const [focusedRackId, setFocusedRackId] = useState("");
  const { widthM, heightM } = layout.canvas;
  const routePoints = path?.points
    .map((point) => `${point.xM},${point.yM}`)
    .join(" ");
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-300 bg-[#f4f7f6]">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-2 text-xs">
        <span className="flex items-center gap-2 font-semibold text-slate-800">
          <Navigation className="size-3.5 text-blue-700" />
          Đường từ {path?.startGateCode ?? "GATE-01"}
        </span>
        <span className="font-mono text-slate-500">
          {path ? `${path.distanceM.toLocaleString("vi-VN")} m` : "Chọn vị trí"}
        </span>
      </div>
      <svg
        aria-label="Sơ đồ đường đi trong kho"
        className="min-h-0 w-full flex-1"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        viewBox={`-1 -1 ${widthM + 2} ${heightM + 2}`}
      >
        <defs>
          <pattern
            id="operation-grid"
            width={layout.canvas.gridM}
            height={layout.canvas.gridM}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${layout.canvas.gridM} 0 L 0 0 0 ${layout.canvas.gridM}`}
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="0.025"
            />
          </pattern>
        </defs>
        <rect
          width={widthM}
          height={heightM}
          fill="#fff"
          stroke="#334155"
          strokeWidth="0.18"
        />
        <rect width={widthM} height={heightM} fill="url(#operation-grid)" />
        {layout.zones.map((zone) => (
          <rect
            key={zone.id}
            x={zone.xM}
            y={zone.yM}
            width={zone.widthM}
            height={zone.heightM}
            fill="#f8fafc"
            stroke="#94a3b8"
            strokeDasharray="0.3 0.22"
            strokeWidth="0.06"
          />
        ))}
        {layout.aisles.map((aisle) => (
          <g key={aisle.id}>
            <rect
              x={aisle.xM}
              y={aisle.yM}
              width={aisle.widthM}
              height={aisle.heightM}
              fill={aisle.type === "MAIN" ? "#dbe4e7" : "#eef2f3"}
              stroke="#cbd5e1"
              strokeWidth="0.04"
            />
            <text
              x={aisle.xM + aisle.widthM / 2}
              y={aisle.yM + aisle.heightM / 2}
              dominantBaseline="middle"
              textAnchor="middle"
              fontSize="0.34"
              fill="#64748b"
            >
              {aisle.code}
            </text>
          </g>
        ))}
        {layout.racks.map((rack) => {
          const rect = getRackRect(rack);
          const active =
            rack.id === selectedRackId || rack.id === focusedRackId;
          const target = rack.id === path?.targetRackId;
          return (
            <g
              key={rack.id}
              aria-label={rack.code}
              className="cursor-pointer"
              onClick={() => onSelectRack(rack.id)}
              onBlur={() => setFocusedRackId("")}
              onFocus={() => setFocusedRackId(rack.id)}
              role="button"
              style={{ outline: "none" }}
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectRack(rack.id);
                }
              }}
            >
              <rect
                x={rect.xM}
                y={rect.yM}
                width={rect.widthM}
                height={rect.heightM}
                rx="0.08"
                fill={target ? "#fbbf24" : active ? "#bfdbfe" : "#cbd5e1"}
                stroke={target ? "#b45309" : active ? "#1d4ed8" : "#475569"}
                strokeWidth={target || active ? "0.15" : "0.07"}
              />
              <text
                x={rect.xM + rect.widthM / 2}
                y={rect.yM + rect.heightM / 2}
                dominantBaseline="middle"
                textAnchor="middle"
                fontSize="0.38"
                fontWeight="700"
                fill="#0f172a"
              >
                {rack.code}
              </text>
            </g>
          );
        })}
        {routePoints ? (
          <>
            <polyline
              points={routePoints}
              fill="none"
              stroke="#fff"
              strokeWidth="0.48"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points={routePoints}
              fill="none"
              stroke="#2563eb"
              strokeWidth="0.22"
              strokeDasharray="0.45 0.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {path!.points.map((point, index) => (
              <circle
                key={`${point.xM}-${point.yM}-${index}`}
                cx={point.xM}
                cy={point.yM}
                r={
                  index === 0 || index === path!.points.length - 1 ? 0.24 : 0.11
                }
                fill={
                  index === 0
                    ? "#0f766e"
                    : index === path!.points.length - 1
                      ? "#d97706"
                      : "#2563eb"
                }
                stroke="#fff"
                strokeWidth="0.07"
              />
            ))}
          </>
        ) : null}
        {layout.gates.map((gate) => (
          <g key={gate.id}>
            <circle
              cx={gate.xM}
              cy={gate.yM}
              r="0.28"
              fill="#0f766e"
              stroke="#fff"
              strokeWidth="0.08"
            />
            <text
              x={gate.xM}
              y={gate.yM - 0.5}
              textAnchor="middle"
              fontSize="0.36"
              fontWeight="700"
              fill="#0f766e"
            >
              {gate.code}
            </text>
          </g>
        ))}
      </svg>
      <div className="flex items-center gap-2 border-t px-3 py-2 text-xs text-slate-600">
        <Warehouse className="size-3.5" />
        {path
          ? "Nhấn vào rack để chọn vị trí và cập nhật đường đi."
          : "Không có đường đi cho vị trí đang chọn."}
      </div>
    </div>
  );
}
