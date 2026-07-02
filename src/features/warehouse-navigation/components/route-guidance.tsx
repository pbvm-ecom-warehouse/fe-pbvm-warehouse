"use client";

import { Clock3, MapPinned, Route } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { WarehouseRoute } from "@/types/api";

export function RouteGuidance({ route }: { route: WarehouseRoute | null }) {
  if (!route) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        Tính gợi ý để nhận route từ cổng vào đến shelf target.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/70 bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Route className="size-4 text-primary" />
            Chỉ đường từ cổng vào
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {route.from.label} → {route.to.label}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="default">WMS route</Badge>
          {route.distanceMeters ? (
            <Badge variant="secondary">
              <MapPinned data-icon="inline-start" />
              {route.distanceMeters} m
            </Badge>
          ) : null}
          {route.estimatedSeconds ? (
            <Badge variant="secondary">
              <Clock3 data-icon="inline-start" />
              {Math.max(1, Math.round(route.estimatedSeconds / 60))} phút
            </Badge>
          ) : null}
        </div>
      </div>

      <ol className="mt-4 grid gap-2 text-sm">
        {(route.instructions && route.instructions.length > 0
          ? route.instructions
          : route.waypoints.map((point) => point.label)
        ).map((instruction, index) => (
          <li className="flex items-start gap-2" key={`${instruction}-${index}`}>
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-[11px] font-semibold text-primary">
              {index + 1}
            </span>
            <span className="text-muted-foreground">{instruction}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
