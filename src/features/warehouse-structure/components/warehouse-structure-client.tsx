"use client";

import { FormEvent, type ReactNode, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Boxes,
  CheckCircle2,
  LoaderCircle,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Warehouse,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getApiErrorMessage } from "@/lib/api-contract";
import { hasAnyRole } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { useSessionUser } from "@/hooks/use-session-user";

import {
  createRack,
  createShelf,
  createWarehouse,
  createZone,
  deleteRack,
  deleteShelf,
  deleteWarehouse,
  deleteZone,
  listRacks,
  listShelves,
  listWarehouses,
  listZones,
  updateRack,
  updateShelf,
  updateWarehouse,
  updateZone,
  type WarehouseStructureRack,
  type WarehouseStructureShelf,
  type WarehouseStructureWarehouse,
  type WarehouseStructureZone,
} from "../services/warehouse-structure.service";

const warehouseKeys = {
  racks: (zoneId: string) => ["warehouse-structure", "racks", zoneId] as const,
  shelves: (rackId: string) =>
    ["warehouse-structure", "shelves", rackId] as const,
  warehouses: ["warehouse-structure", "warehouses"] as const,
  zones: (warehouseId: string) =>
    ["warehouse-structure", "zones", warehouseId] as const,
};

const defaultWarehouseForm = {
  address: "",
  isActive: true,
  name: "",
};

const defaultZoneForm = {
  code: "",
  name: "",
};

const defaultRackForm = {
  code: "",
  name: "",
};

const defaultShelfForm = {
  code: "",
  fillFactor: "",
  innerDepth: "",
  innerHeight: "",
  innerWidth: "",
  isStaging: false,
  level: "1",
};

function formatError(error: unknown) {
  return getApiErrorMessage(error) ?? "Không kết nối được WMS.";
}

function requiredText(value: string) {
  return value.trim();
}

function optionalNumber(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function positiveInteger(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <Badge variant={active ? "default" : "outline"}>
      {active ? "Đang dùng" : "Ngưng dùng"}
    </Badge>
  );
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <TableRow>
      <TableCell
        className="h-20 text-center text-sm text-muted-foreground"
        colSpan={colSpan}
      >
        {label}
      </TableCell>
    </TableRow>
  );
}

function ErrorBanner({ error }: { error: unknown }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
      {formatError(error)}
    </div>
  );
}

function SectionTitle({
  count,
  icon,
  subtitle,
  title,
}: {
  count: number | undefined;
  icon: ReactNode;
  subtitle: string;
  title: string;
}) {
  return (
    <CardHeader className="border-b bg-muted/20">
      <CardTitle className="flex items-center gap-2 text-base">
        {icon}
        {title}
      </CardTitle>
      <CardDescription className="flex items-center gap-2">
        <span>{subtitle}</span>
        <Badge variant="outline">{count ?? 0}</Badge>
      </CardDescription>
    </CardHeader>
  );
}

export function WarehouseStructureClient() {
  const user = useSessionUser();
  const canManage = hasAnyRole(user?.roles, ["MANAGER"]);
  const queryClient = useQueryClient();
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [selectedRackId, setSelectedRackId] = useState("");
  const [warehouseForm, setWarehouseForm] = useState(defaultWarehouseForm);
  const [zoneForm, setZoneForm] = useState(defaultZoneForm);
  const [rackForm, setRackForm] = useState(defaultRackForm);
  const [shelfForm, setShelfForm] = useState(defaultShelfForm);
  const [shelfEdit, setShelfEdit] = useState(defaultShelfForm);

  const warehousesQuery = useQuery({
    enabled: canManage,
    queryKey: warehouseKeys.warehouses,
    queryFn: listWarehouses,
  });

  const warehouses = useMemo(
    () => warehousesQuery.data ?? [],
    [warehousesQuery.data],
  );
  const selectedWarehouse = useMemo(
    () =>
      warehouses.find((warehouse) => warehouse.id === selectedWarehouseId) ??
      warehouses[0],
    [selectedWarehouseId, warehouses],
  );
  const activeWarehouseId = selectedWarehouse?.id ?? "";

  const zonesQuery = useQuery({
    enabled: canManage && Boolean(activeWarehouseId),
    queryFn: () => listZones(activeWarehouseId),
    queryKey: warehouseKeys.zones(activeWarehouseId),
  });
  const zones = useMemo(() => zonesQuery.data ?? [], [zonesQuery.data]);
  const selectedZone = useMemo(
    () => zones.find((zone) => zone.id === selectedZoneId) ?? zones[0],
    [selectedZoneId, zones],
  );
  const activeZoneId = selectedZone?.id ?? "";

  const racksQuery = useQuery({
    enabled: canManage && Boolean(activeZoneId),
    queryFn: () => listRacks(activeZoneId),
    queryKey: warehouseKeys.racks(activeZoneId),
  });
  const racks = useMemo(() => racksQuery.data ?? [], [racksQuery.data]);
  const selectedRack = useMemo(
    () => racks.find((rack) => rack.id === selectedRackId) ?? racks[0],
    [selectedRackId, racks],
  );
  const activeRackId = selectedRack?.id ?? "";

  const shelvesQuery = useQuery({
    enabled: canManage && Boolean(activeRackId),
    queryFn: () => listShelves(activeRackId),
    queryKey: warehouseKeys.shelves(activeRackId),
  });
  const shelves = shelvesQuery.data ?? [];

  const createWarehouseMutation = useMutation({
    mutationFn: () =>
      createWarehouse({
        address: requiredText(warehouseForm.address),
        isActive: warehouseForm.isActive,
        name: requiredText(warehouseForm.name),
      }),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: (warehouse) => {
      setWarehouseForm(defaultWarehouseForm);
      setSelectedWarehouseId(warehouse.id);
      void queryClient.invalidateQueries({ queryKey: warehouseKeys.warehouses });
      toast.success("Đã tạo kho");
    },
  });

  const updateWarehouseMutation = useMutation({
    mutationFn: (form: typeof defaultWarehouseForm) =>
      updateWarehouse(activeWarehouseId, {
        address: requiredText(form.address),
        isActive: form.isActive,
        name: requiredText(form.name),
      }),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: warehouseKeys.warehouses });
      toast.success("Đã cập nhật kho");
    },
  });

  const deleteWarehouseMutation = useMutation({
    mutationFn: () => deleteWarehouse(activeWarehouseId),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: () => {
      setSelectedWarehouseId("");
      setSelectedZoneId("");
      setSelectedRackId("");
      void queryClient.invalidateQueries({ queryKey: warehouseKeys.warehouses });
      toast.success("Đã xóa kho");
    },
  });

  const createZoneMutation = useMutation({
    mutationFn: () =>
      createZone({
        code: requiredText(zoneForm.code),
        name: requiredText(zoneForm.name),
        warehouseId: activeWarehouseId,
      }),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: (zone) => {
      setZoneForm(defaultZoneForm);
      setSelectedZoneId(zone.id);
      void queryClient.invalidateQueries({
        queryKey: warehouseKeys.zones(activeWarehouseId),
      });
      toast.success("Đã tạo khu vực");
    },
  });

  const updateZoneMutation = useMutation({
    mutationFn: (form: typeof defaultZoneForm) =>
      updateZone(activeZoneId, {
        code: requiredText(form.code),
        name: requiredText(form.name),
      }),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: warehouseKeys.zones(activeWarehouseId),
      });
      toast.success("Đã cập nhật khu vực");
    },
  });

  const deleteZoneMutation = useMutation({
    mutationFn: () => deleteZone(activeZoneId),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: () => {
      setSelectedZoneId("");
      setSelectedRackId("");
      void queryClient.invalidateQueries({
        queryKey: warehouseKeys.zones(activeWarehouseId),
      });
      toast.success("Đã xóa khu vực");
    },
  });

  const createRackMutation = useMutation({
    mutationFn: () =>
      createRack({
        code: requiredText(rackForm.code),
        name: requiredText(rackForm.name),
        zoneId: activeZoneId,
      }),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: (rack) => {
      setRackForm(defaultRackForm);
      setSelectedRackId(rack.id);
      void queryClient.invalidateQueries({
        queryKey: warehouseKeys.racks(activeZoneId),
      });
      toast.success("Đã tạo dãy kệ");
    },
  });

  const updateRackMutation = useMutation({
    mutationFn: (form: typeof defaultRackForm) =>
      updateRack(activeRackId, {
        code: requiredText(form.code),
        name: requiredText(form.name),
      }),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: warehouseKeys.racks(activeZoneId),
      });
      toast.success("Đã cập nhật dãy kệ");
    },
  });

  const deleteRackMutation = useMutation({
    mutationFn: () => deleteRack(activeRackId),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: () => {
      setSelectedRackId("");
      void queryClient.invalidateQueries({
        queryKey: warehouseKeys.racks(activeZoneId),
      });
      toast.success("Đã xóa dãy kệ");
    },
  });

  const createShelfMutation = useMutation({
    mutationFn: () =>
      createShelf({
        code: requiredText(shelfForm.code),
        fillFactor: optionalNumber(shelfForm.fillFactor),
        innerDepth: optionalNumber(shelfForm.innerDepth),
        innerHeight: optionalNumber(shelfForm.innerHeight),
        innerWidth: optionalNumber(shelfForm.innerWidth),
        isStaging: shelfForm.isStaging,
        level: positiveInteger(shelfForm.level),
        rackId: activeRackId,
      }),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: () => {
      setShelfForm(defaultShelfForm);
      void queryClient.invalidateQueries({
        queryKey: warehouseKeys.shelves(activeRackId),
      });
      toast.success("Đã tạo vị trí kệ");
    },
  });

  const updateShelfMutation = useMutation({
    mutationFn: ({ id, form }: { id: string; form: typeof defaultShelfForm }) =>
      updateShelf(id, {
        code: requiredText(form.code),
        fillFactor: optionalNumber(form.fillFactor),
        innerDepth: optionalNumber(form.innerDepth),
        innerHeight: optionalNumber(form.innerHeight),
        innerWidth: optionalNumber(form.innerWidth),
        isStaging: form.isStaging,
        level: positiveInteger(form.level),
      }),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: warehouseKeys.shelves(activeRackId),
      });
      toast.success("Đã cập nhật vị trí kệ");
    },
  });

  const deleteShelfMutation = useMutation({
    mutationFn: (shelfId: string) => deleteShelf(shelfId),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: warehouseKeys.shelves(activeRackId),
      });
      toast.success("Đã xóa vị trí kệ");
    },
  });

  function refreshAll() {
    void queryClient.invalidateQueries({ queryKey: ["warehouse-structure"] });
  }

  function handleCreateWarehouse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createWarehouseMutation.mutate();
  }

  function handleCreateZone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createZoneMutation.mutate();
  }

  function handleCreateRack(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createRackMutation.mutate();
  }

  function handleCreateShelf(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createShelfMutation.mutate();
  }

  const isFetching =
    warehousesQuery.isFetching ||
    zonesQuery.isFetching ||
    racksQuery.isFetching ||
    shelvesQuery.isFetching;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-normal">
            Kho
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Quản lý kho, khu vực, dãy kệ và mã vị trí.
          </p>
        </div>
        <Button
          disabled={!canManage}
          onClick={refreshAll}
          type="button"
          variant="outline"
        >
          {isFetching ? (
            <LoaderCircle className="animate-spin" data-icon="inline-start" />
          ) : (
            <RefreshCw data-icon="inline-start" />
          )}
          Làm mới
        </Button>
      </div>

      {!canManage ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Bạn cần quyền quản lý để chỉnh cấu trúc kho.
        </div>
      ) : null}

      {warehousesQuery.error ? <ErrorBanner error={warehousesQuery.error} /> : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <SectionTitle
            count={warehouses.length}
            icon={<Warehouse className="size-4 text-primary" />}
            subtitle="Danh sách kho"
            title="Kho"
          />
          <CardContent className="space-y-4 pt-4">
            <form className="grid gap-3 md:grid-cols-2" onSubmit={handleCreateWarehouse}>
              <div className="space-y-2">
                <Label htmlFor="warehouse-name">Tên kho</Label>
                <Input
                  id="warehouse-name"
                  required
                  value={warehouseForm.name}
                  onChange={(event) =>
                    setWarehouseForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="warehouse-address">Địa chỉ</Label>
                <Input
                  id="warehouse-address"
                  required
                  value={warehouseForm.address}
                  onChange={(event) =>
                    setWarehouseForm((current) => ({
                      ...current,
                      address: event.target.value,
                    }))
                  }
                />
              </div>
              <Label
                className="flex items-center gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm font-medium"
                htmlFor="warehouse-active"
              >
                <Checkbox
                  checked={warehouseForm.isActive}
                  id="warehouse-active"
                  onCheckedChange={(checked) =>
                    setWarehouseForm((current) => ({
                      ...current,
                      isActive: checked === true,
                    }))
                  }
                />
                Đang hoạt động
              </Label>
              <Button
                disabled={!canManage || createWarehouseMutation.isPending}
                type="submit"
              >
                {createWarehouseMutation.isPending ? (
                  <LoaderCircle className="animate-spin" data-icon="inline-start" />
                ) : (
                  <Plus data-icon="inline-start" />
                )}
                Tạo kho
              </Button>
            </form>

            <WarehouseTable
              selectedId={activeWarehouseId}
              warehouses={warehouses}
              onSelect={(warehouse) => {
                setSelectedWarehouseId(warehouse.id);
                setSelectedZoneId("");
                setSelectedRackId("");
              }}
            />

            {selectedWarehouse ? (
              <WarehouseEditForm
                canManage={canManage}
                deleteBusy={deleteWarehouseMutation.isPending}
                key={selectedWarehouse.id}
                saveBusy={updateWarehouseMutation.isPending}
                warehouse={selectedWarehouse}
                onDelete={() => deleteWarehouseMutation.mutate()}
                onSave={(form) => updateWarehouseMutation.mutate(form)}
              />
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <SectionTitle
            count={zones.length}
            icon={<Boxes className="size-4 text-primary" />}
            subtitle={selectedWarehouse?.name ?? "Chọn kho"}
            title="Khu vực"
          />
          <CardContent className="space-y-4 pt-4">
            {zonesQuery.error ? <ErrorBanner error={zonesQuery.error} /> : null}
            <form className="grid gap-3 md:grid-cols-3" onSubmit={handleCreateZone}>
              <TextField
                id="zone-name"
                label="Tên khu vực"
                value={zoneForm.name}
                onChange={(value) =>
                  setZoneForm((current) => ({ ...current, name: value }))
                }
              />
              <TextField
                id="zone-code"
                label="Mã khu vực"
                value={zoneForm.code}
                onChange={(value) =>
                  setZoneForm((current) => ({ ...current, code: value }))
                }
              />
              <Button
                className="self-end"
                disabled={!canManage || !activeWarehouseId || createZoneMutation.isPending}
                type="submit"
              >
                <Plus data-icon="inline-start" />
                Tạo khu vực
              </Button>
            </form>
            <ZoneTable
              selectedId={activeZoneId}
              zones={zones}
              onSelect={(zone) => {
                setSelectedZoneId(zone.id);
                setSelectedRackId("");
              }}
            />
            {selectedZone ? (
              <CodeEntityEditForm
                deleteBusy={deleteZoneMutation.isPending}
                disabled={!canManage}
                entity={selectedZone}
                key={selectedZone.id}
                prefix="zone"
                saveBusy={updateZoneMutation.isPending}
                onDelete={() => deleteZoneMutation.mutate()}
                onSave={(form) => updateZoneMutation.mutate(form)}
              />
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <SectionTitle
            count={racks.length}
            icon={<Boxes className="size-4 text-primary" />}
            subtitle={selectedZone?.name ?? "Chọn khu vực"}
            title="Dãy kệ"
          />
          <CardContent className="space-y-4 pt-4">
            {racksQuery.error ? <ErrorBanner error={racksQuery.error} /> : null}
            <form className="grid gap-3 md:grid-cols-3" onSubmit={handleCreateRack}>
              <TextField
                id="rack-name"
                label="Tên dãy kệ"
                value={rackForm.name}
                onChange={(value) =>
                  setRackForm((current) => ({ ...current, name: value }))
                }
              />
              <TextField
                id="rack-code"
                label="Mã dãy kệ"
                value={rackForm.code}
                onChange={(value) =>
                  setRackForm((current) => ({ ...current, code: value }))
                }
              />
              <Button
                className="self-end"
                disabled={!canManage || !activeZoneId || createRackMutation.isPending}
                type="submit"
              >
                <Plus data-icon="inline-start" />
                Tạo dãy kệ
              </Button>
            </form>
            <RackTable
              racks={racks}
              selectedId={activeRackId}
              onSelect={(rack) => setSelectedRackId(rack.id)}
            />
            {selectedRack ? (
              <CodeEntityEditForm
                deleteBusy={deleteRackMutation.isPending}
                disabled={!canManage}
                entity={selectedRack}
                key={selectedRack.id}
                prefix="rack"
                saveBusy={updateRackMutation.isPending}
                onDelete={() => deleteRackMutation.mutate()}
                onSave={(form) => updateRackMutation.mutate(form)}
              />
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <SectionTitle
            count={shelves.length}
            icon={<CheckCircle2 className="size-4 text-primary" />}
            subtitle={selectedRack?.name ?? "Chọn dãy kệ"}
            title="Vị trí kệ"
          />
          <CardContent className="space-y-4 pt-4">
            {shelvesQuery.error ? <ErrorBanner error={shelvesQuery.error} /> : null}
            <ShelfForm
              busy={createShelfMutation.isPending}
              disabled={!canManage || !activeRackId}
              form={shelfForm}
              submitLabel="Tạo vị trí"
              onChange={setShelfForm}
              onSubmit={handleCreateShelf}
            />
            <ShelfTable
              busyId={
                deleteShelfMutation.isPending
                  ? deleteShelfMutation.variables
                  : undefined
              }
              canManage={canManage}
              shelves={shelves}
              shelfEdit={shelfEdit}
              updateBusy={updateShelfMutation.isPending}
              onDelete={(shelfId) => deleteShelfMutation.mutate(shelfId)}
              onEditChange={setShelfEdit}
              onEditStart={(shelf) =>
                setShelfEdit({
                  code: shelf.code,
                  fillFactor: shelf.fillFactor?.toString() ?? "",
                  innerDepth: shelf.innerDepth?.toString() ?? "",
                  innerHeight: shelf.innerHeight?.toString() ?? "",
                  innerWidth: shelf.innerWidth?.toString() ?? "",
                  isStaging: shelf.isStaging,
                  level: shelf.level.toString(),
                })
              }
              onUpdate={(shelfId) =>
                updateShelfMutation.mutate({ form: shelfEdit, id: shelfId })
              }
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TextField({
  id,
  label,
  onChange,
  required = true,
  value,
}: {
  id: string;
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  value: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function ActionButtons({
  deleteBusy,
  disabled,
  onDelete,
  saveBusy,
}: {
  deleteBusy: boolean;
  disabled: boolean;
  onDelete: () => void;
  saveBusy: boolean;
}) {
  return (
    <div className="flex items-end gap-2">
      <Button disabled={disabled || saveBusy} type="submit">
        {saveBusy ? (
          <LoaderCircle className="animate-spin" data-icon="inline-start" />
        ) : (
          <Save data-icon="inline-start" />
        )}
        Lưu
      </Button>
      <Button
        disabled={disabled || deleteBusy}
        onClick={onDelete}
        type="button"
        variant="destructive"
      >
        <Trash2 data-icon="inline-start" />
        Xóa
      </Button>
    </div>
  );
}

function WarehouseEditForm({
  canManage,
  deleteBusy,
  onDelete,
  onSave,
  saveBusy,
  warehouse,
}: {
  canManage: boolean;
  deleteBusy: boolean;
  onDelete: () => void;
  onSave: (form: typeof defaultWarehouseForm) => void;
  saveBusy: boolean;
  warehouse: WarehouseStructureWarehouse;
}) {
  const [form, setForm] = useState({
    address: warehouse.address,
    isActive: warehouse.isActive,
    name: warehouse.name,
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(form);
  }

  return (
    <form
      className="grid gap-3 rounded-lg border border-border/70 bg-muted/20 p-3 md:grid-cols-2"
      onSubmit={handleSubmit}
    >
      <div className="space-y-2">
        <Label htmlFor="warehouse-edit-name">Tên kho</Label>
        <Input
          id="warehouse-edit-name"
          required
          value={form.name}
          onChange={(event) =>
            setForm((current) => ({ ...current, name: event.target.value }))
          }
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="warehouse-edit-address">Địa chỉ</Label>
        <Input
          id="warehouse-edit-address"
          required
          value={form.address}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              address: event.target.value,
            }))
          }
        />
      </div>
      <Label
        className="flex items-center gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm font-medium"
        htmlFor="warehouse-edit-active"
      >
        <Checkbox
          checked={form.isActive}
          id="warehouse-edit-active"
          onCheckedChange={(checked) =>
            setForm((current) => ({
              ...current,
              isActive: checked === true,
            }))
          }
        />
        Đang hoạt động
      </Label>
      <div className="flex gap-2">
        <Button disabled={!canManage || saveBusy} type="submit">
          {saveBusy ? (
            <LoaderCircle className="animate-spin" data-icon="inline-start" />
          ) : (
            <Save data-icon="inline-start" />
          )}
          Lưu
        </Button>
        <Button
          disabled={!canManage || deleteBusy}
          onClick={onDelete}
          type="button"
          variant="destructive"
        >
          <Trash2 data-icon="inline-start" />
          Xóa
        </Button>
      </div>
    </form>
  );
}

function CodeEntityEditForm({
  deleteBusy,
  disabled,
  entity,
  onDelete,
  onSave,
  prefix,
  saveBusy,
}: {
  deleteBusy: boolean;
  disabled: boolean;
  entity: { code: string; id: string; name: string };
  onDelete: () => void;
  onSave: (form: typeof defaultZoneForm) => void;
  prefix: string;
  saveBusy: boolean;
}) {
  const [form, setForm] = useState({
    code: entity.code,
    name: entity.name,
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(form);
  }

  return (
    <form
      className="grid gap-3 rounded-lg border border-border/70 bg-muted/20 p-3 md:grid-cols-3"
      onSubmit={handleSubmit}
    >
      <TextField
        id={`${prefix}-edit-name`}
        label="Tên"
        value={form.name}
        onChange={(value) => setForm((current) => ({ ...current, name: value }))}
      />
      <TextField
        id={`${prefix}-edit-code`}
        label="Mã"
        value={form.code}
        onChange={(value) => setForm((current) => ({ ...current, code: value }))}
      />
      <ActionButtons
        deleteBusy={deleteBusy}
        disabled={disabled}
        saveBusy={saveBusy}
        onDelete={onDelete}
      />
    </form>
  );
}

function WarehouseTable({
  onSelect,
  selectedId,
  warehouses,
}: {
  onSelect: (warehouse: WarehouseStructureWarehouse) => void;
  selectedId: string;
  warehouses: WarehouseStructureWarehouse[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tên kho</TableHead>
          <TableHead>Địa chỉ</TableHead>
          <TableHead>Trạng thái</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {warehouses.length === 0 ? (
          <EmptyRow colSpan={3} label="Chưa có kho." />
        ) : (
          warehouses.map((warehouse) => (
            <TableRow
              className={cn(
                "cursor-pointer",
                selectedId === warehouse.id && "bg-primary/5",
              )}
              key={warehouse.id}
              onClick={() => onSelect(warehouse)}
            >
              <TableCell className="font-medium">{warehouse.name}</TableCell>
              <TableCell>{warehouse.address}</TableCell>
              <TableCell>
                <StatusBadge active={warehouse.isActive} />
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

function ZoneTable({
  onSelect,
  selectedId,
  zones,
}: {
  onSelect: (zone: WarehouseStructureZone) => void;
  selectedId: string;
  zones: WarehouseStructureZone[];
}) {
  return (
    <SimpleCodeTable
      emptyLabel="Chưa có khu vực."
      rows={zones}
      selectedId={selectedId}
      onSelect={onSelect}
    />
  );
}

function RackTable({
  onSelect,
  racks,
  selectedId,
}: {
  onSelect: (rack: WarehouseStructureRack) => void;
  racks: WarehouseStructureRack[];
  selectedId: string;
}) {
  return (
    <SimpleCodeTable
      emptyLabel="Chưa có dãy kệ."
      rows={racks}
      selectedId={selectedId}
      onSelect={onSelect}
    />
  );
}

function SimpleCodeTable<T extends { code: string; id: string; name: string }>({
  emptyLabel,
  onSelect,
  rows,
  selectedId,
}: {
  emptyLabel: string;
  onSelect: (row: T) => void;
  rows: T[];
  selectedId: string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Mã</TableHead>
          <TableHead>Tên</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <EmptyRow colSpan={2} label={emptyLabel} />
        ) : (
          rows.map((row) => (
            <TableRow
              className={cn(
                "cursor-pointer",
                selectedId === row.id && "bg-primary/5",
              )}
              key={row.id}
              onClick={() => onSelect(row)}
            >
              <TableCell className="font-medium">{row.code}</TableCell>
              <TableCell>{row.name}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

function ShelfForm({
  busy,
  disabled,
  form,
  onChange,
  onSubmit,
  submitLabel,
}: {
  busy: boolean;
  disabled: boolean;
  form: typeof defaultShelfForm;
  onChange: (form: typeof defaultShelfForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitLabel: string;
}) {
  return (
    <form className="grid gap-3 md:grid-cols-4" onSubmit={onSubmit}>
      <TextField
        id="shelf-code"
        label="Mã vị trí"
        value={form.code}
        onChange={(value) => onChange({ ...form, code: value })}
      />
      <TextField
        id="shelf-level"
        label="Tầng"
        value={form.level}
        onChange={(value) => onChange({ ...form, level: value })}
      />
      <TextField
        id="shelf-width"
        label="Rộng cm"
        required={false}
        value={form.innerWidth}
        onChange={(value) => onChange({ ...form, innerWidth: value })}
      />
      <TextField
        id="shelf-depth"
        label="Sâu cm"
        required={false}
        value={form.innerDepth}
        onChange={(value) => onChange({ ...form, innerDepth: value })}
      />
      <TextField
        id="shelf-height"
        label="Cao cm"
        required={false}
        value={form.innerHeight}
        onChange={(value) => onChange({ ...form, innerHeight: value })}
      />
      <TextField
        id="shelf-fill-factor"
        label="Mức chứa"
        required={false}
        value={form.fillFactor}
        onChange={(value) => onChange({ ...form, fillFactor: value })}
      />
      <Label
        className="flex items-center gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm font-medium md:self-end"
        htmlFor="shelf-staging"
      >
        <Checkbox
          checked={form.isStaging}
          id="shelf-staging"
          onCheckedChange={(checked) =>
            onChange({ ...form, isStaging: checked === true })
          }
        />
        Khu trung chuyển
      </Label>
      <Button className="self-end" disabled={disabled || busy} type="submit">
        {busy ? (
          <LoaderCircle className="animate-spin" data-icon="inline-start" />
        ) : (
          <Plus data-icon="inline-start" />
        )}
        {submitLabel}
      </Button>
    </form>
  );
}

function ShelfTable({
  busyId,
  canManage,
  onDelete,
  onEditChange,
  onEditStart,
  onUpdate,
  shelfEdit,
  shelves,
  updateBusy,
}: {
  busyId?: string;
  canManage: boolean;
  onDelete: (shelfId: string) => void;
  onEditChange: (form: typeof defaultShelfForm) => void;
  onEditStart: (shelf: WarehouseStructureShelf) => void;
  onUpdate: (shelfId: string) => void;
  shelfEdit: typeof defaultShelfForm;
  shelves: WarehouseStructureShelf[];
  updateBusy: boolean;
}) {
  const [editingShelfId, setEditingShelfId] = useState("");

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Mã</TableHead>
          <TableHead>Tầng</TableHead>
          <TableHead>Kích thước</TableHead>
          <TableHead>Trạng thái</TableHead>
          <TableHead className="w-36"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {shelves.length === 0 ? (
          <EmptyRow colSpan={5} label="Chưa có vị trí kệ." />
        ) : (
          shelves.map((shelf) => {
            const isEditing = editingShelfId === shelf.id;

            return (
              <TableRow key={shelf.id}>
                <TableCell className="font-medium">
                  {isEditing ? (
                    <Input
                      required
                      value={shelfEdit.code}
                      onChange={(event) =>
                        onEditChange({ ...shelfEdit, code: event.target.value })
                      }
                    />
                  ) : (
                    shelf.code
                  )}
                </TableCell>
                <TableCell>
                  {isEditing ? (
                    <Input
                      required
                      value={shelfEdit.level}
                      onChange={(event) =>
                        onEditChange({ ...shelfEdit, level: event.target.value })
                      }
                    />
                  ) : (
                    shelf.level
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {isEditing ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input
                        placeholder="Rộng"
                        value={shelfEdit.innerWidth}
                        onChange={(event) =>
                          onEditChange({
                            ...shelfEdit,
                            innerWidth: event.target.value,
                          })
                        }
                      />
                      <Input
                        placeholder="Sâu"
                        value={shelfEdit.innerDepth}
                        onChange={(event) =>
                          onEditChange({
                            ...shelfEdit,
                            innerDepth: event.target.value,
                          })
                        }
                      />
                      <Input
                        placeholder="Cao"
                        value={shelfEdit.innerHeight}
                        onChange={(event) =>
                          onEditChange({
                            ...shelfEdit,
                            innerHeight: event.target.value,
                          })
                        }
                      />
                      <Input
                        placeholder="Fill"
                        value={shelfEdit.fillFactor}
                        onChange={(event) =>
                          onEditChange({
                            ...shelfEdit,
                            fillFactor: event.target.value,
                          })
                        }
                      />
                    </div>
                  ) : (
                    [
                      shelf.innerWidth,
                      shelf.innerDepth,
                      shelf.innerHeight,
                    ]
                      .filter((value) => value !== undefined)
                      .join(" x ") || "Chưa nhập"
                  )}
                </TableCell>
                <TableCell>
                  {isEditing ? (
                    <Label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={shelfEdit.isStaging}
                        onCheckedChange={(checked) =>
                          onEditChange({
                            ...shelfEdit,
                            isStaging: checked === true,
                          })
                        }
                      />
                      Khu trung chuyển
                    </Label>
                  ) : shelf.isStaging ? (
                    <Badge>Trung chuyển</Badge>
                  ) : (
                    <Badge variant="outline">Lưu kho</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <Button
                        disabled={!canManage || updateBusy}
                        onClick={() => onUpdate(shelf.id)}
                        size="sm"
                        type="button"
                      >
                        <Save data-icon="inline-start" />
                        Lưu
                      </Button>
                      <Button
                        onClick={() => setEditingShelfId("")}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        Hủy
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          onEditStart(shelf);
                          setEditingShelfId(shelf.id);
                        }}
                        size="icon-sm"
                        type="button"
                        variant="outline"
                      >
                        <Save />
                        <span className="sr-only">Sửa vị trí kệ</span>
                      </Button>
                      <Button
                        disabled={!canManage || busyId === shelf.id}
                        onClick={() => onDelete(shelf.id)}
                        size="icon-sm"
                        type="button"
                        variant="destructive"
                      >
                        <Trash2 />
                        <span className="sr-only">Xóa vị trí kệ</span>
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
