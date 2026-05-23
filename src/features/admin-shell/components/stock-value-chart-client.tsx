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
      <div className="flex h-72 w-full items-center justify-center rounded-lg border border-dashed bg-muted/30 text-sm text-muted-foreground">
        Chưa có dữ liệu báo cáo từ wms-api.
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="ingredients" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#0f766e" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#0f766e" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="cups" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#2563eb" stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} />
          <Tooltip />
          <Area
            dataKey="ingredients"
            name="Nguyên liệu"
            stroke="#0f766e"
            fill="url(#ingredients)"
          />
          <Area
            dataKey="cups"
            name="Ly & bao bì"
            stroke="#2563eb"
            fill="url(#cups)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
