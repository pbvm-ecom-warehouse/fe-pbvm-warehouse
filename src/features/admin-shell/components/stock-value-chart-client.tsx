"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { InventoryValuePoint } from "@/types/api";

export type StockValueChartClientProps = {
  data: InventoryValuePoint[];
};

export function StockValueChartClient({ data }: StockValueChartClientProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-72 w-full items-center justify-center rounded-lg border border-dashed bg-muted/30 text-sm font-medium text-muted-foreground">
        Chưa có dữ liệu báo cáo.
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="ingredients" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.28} />
              <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="cups" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="#e5e7eb"
            strokeDasharray="4 6"
            vertical={false}
          />
          <XAxis
            axisLine={false}
            dataKey="name"
            tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }}
            tickLine={false}
            tickFormatter={(value: number) => `${value / 1000000}M`}
          />
          <Tooltip
            contentStyle={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              boxShadow: "0 18px 36px -26px rgba(15, 23, 42, 0.45)",
              color: "#111827",
              fontSize: 12,
              fontWeight: 600,
            }}
            cursor={{ stroke: "#818cf8", strokeDasharray: "4 4" }}
          />
          <Area
            dataKey="ingredients"
            name="Nguyên liệu"
            stroke="#4f46e5"
            strokeWidth={3}
            fill="url(#ingredients)"
            dot={{ fill: "#ffffff", r: 3, stroke: "#4f46e5", strokeWidth: 2 }}
            activeDot={{ fill: "#4f46e5", r: 5 }}
          />
          <Area
            dataKey="cups"
            name="Ly & bao bì"
            stroke="#14b8a6"
            strokeWidth={2}
            fill="url(#cups)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
