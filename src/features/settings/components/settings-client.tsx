"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, LoaderCircle, RefreshCw, Server } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/features/admin-shell/components/operations-ui";
import type { WmsHealthResponse, WmsRootResponse } from "@/types/api";

import { getWmsHealth, getWmsRoot } from "../services/settings.service";

function formatUnknownError(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Không kết nối được WMS.";
}

function formatRootResponse(response: WmsRootResponse | undefined) {
  if (response === undefined) {
    return "Chưa có phản hồi.";
  }

  if (typeof response === "string") {
    return response;
  }

  return response.message ?? JSON.stringify(response);
}

function StatusLine({
  label,
  value,
}: {
  label: string;
  value: string | undefined;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Badge
        className="max-w-[180px] justify-start truncate"
        variant={value === "up" || value === "ok" ? "default" : "outline"}
      >
        {value === "up" || value === "ok" ? "Hoạt động" : (value ?? "Chưa rõ")}
      </Badge>
    </div>
  );
}

function HealthCard({
  error,
  health,
  isLoading,
  onRefresh,
}: {
  error: unknown;
  health: WmsHealthResponse | undefined;
  isLoading: boolean;
  onRefresh: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="size-4 text-primary" />
            Trạng thái hệ thống
          </CardTitle>
          <CardDescription>MongoDB, Redis và trạng thái WMS.</CardDescription>
        </div>
        <Button
          aria-label="Làm mới trạng thái hệ thống"
          onClick={onRefresh}
          size="icon-sm"
          type="button"
          variant="outline"
        >
          {isLoading ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <RefreshCw />
          )}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {formatUnknownError(error)}
          </div>
        ) : null}
        <StatusLine label="Trạng thái" value={health?.status} />
        <StatusLine label="Cơ sở dữ liệu" value={health?.db} />
        <StatusLine label="Bộ nhớ đệm" value={health?.redis} />
      </CardContent>
    </Card>
  );
}

function RootCard({
  error,
  isLoading,
  onRefresh,
  root,
}: {
  error: unknown;
  isLoading: boolean;
  onRefresh: () => void;
  root: WmsRootResponse | undefined;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="size-4 text-primary" />
            Kết nối WMS
          </CardTitle>
          <CardDescription>Phản hồi từ API WMS.</CardDescription>
        </div>
        <Button
          aria-label="Làm mới kết nối WMS"
          onClick={onRefresh}
          size="icon-sm"
          type="button"
          variant="outline"
        >
          {isLoading ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <RefreshCw />
          )}
        </Button>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {formatUnknownError(error)}
          </div>
        ) : (
          <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-3 text-sm font-medium">
            {formatRootResponse(root)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SettingsClient() {
  const healthQuery = useQuery({
    queryKey: ["settings", "wms-health"],
    queryFn: getWmsHealth,
  });
  const rootQuery = useQuery({
    queryKey: ["settings", "wms-root"],
    queryFn: getWmsRoot,
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Hệ thống" />

      <div className="grid gap-4 lg:grid-cols-2">
        <HealthCard
          error={healthQuery.error}
          health={healthQuery.data}
          isLoading={healthQuery.isLoading || healthQuery.isFetching}
          onRefresh={() => void healthQuery.refetch()}
        />
        <RootCard
          error={rootQuery.error}
          isLoading={rootQuery.isLoading || rootQuery.isFetching}
          onRefresh={() => void rootQuery.refetch()}
          root={rootQuery.data}
        />
      </div>
    </div>
  );
}
