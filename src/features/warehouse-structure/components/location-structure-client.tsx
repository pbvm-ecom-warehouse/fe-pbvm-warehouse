"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  EmptyState,
  PageHeader,
  TablePanel,
  TableSkeleton,
} from "@/features/admin-shell/components/operations-ui";
import {
  createRack,
  createShelf,
  createZone,
  deleteRack,
  deleteShelf,
  deleteZone,
  listRacks,
  listShelves,
  listZones,
  updateRack,
  updateShelf,
  updateZone,
  type WarehouseStructureRack,
  type WarehouseStructureShelf,
  type WarehouseStructureZone,
} from "@/features/warehouse-structure/services/warehouse-structure.service";
import { getApiErrorMessage } from "@/lib/api-contract";

const keys = {
  zones: ["locations", "zones"] as const,
  racks: (zoneId: string) => ["locations", "racks", zoneId] as const,
  shelves: (rackId: string) => ["locations", "shelves", rackId] as const,
};

function errorMessage(error: unknown) {
  return getApiErrorMessage(error) ?? "Không thể cập nhật vị trí kho.";
}

function text(value: string) {
  return value.trim();
}

type Editor =
  | { kind: "zone"; value?: WarehouseStructureZone }
  | { kind: "rack"; value?: WarehouseStructureRack }
  | { kind: "shelf"; value?: WarehouseStructureShelf }
  | null;

export function LocationStructureClient() {
  const queryClient = useQueryClient();
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [selectedRackId, setSelectedRackId] = useState("");
  const [editor, setEditor] = useState<Editor>(null);
  const [deleteTarget, setDeleteTarget] = useState<Editor>(null);

  const zonesQuery = useQuery({ queryKey: keys.zones, queryFn: listZones });
  const zones = useMemo(() => zonesQuery.data ?? [], [zonesQuery.data]);
  const activeZoneId = zones.some((zone) => zone.id === selectedZoneId)
    ? selectedZoneId
    : (zones[0]?.id ?? "");

  const racksQuery = useQuery({
    enabled: Boolean(activeZoneId),
    queryKey: keys.racks(activeZoneId),
    queryFn: () => listRacks(activeZoneId),
  });
  const racks = useMemo(() => racksQuery.data ?? [], [racksQuery.data]);
  const activeRackId = racks.some((rack) => rack.id === selectedRackId)
    ? selectedRackId
    : (racks[0]?.id ?? "");

  const shelvesQuery = useQuery({
    enabled: Boolean(activeRackId),
    queryKey: keys.shelves(activeRackId),
    queryFn: () => listShelves(activeRackId),
  });
  const shelves = shelvesQuery.data ?? [];

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["locations"] });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Vị trí kho"
        actions={
          <Button onClick={refresh} type="button" variant="outline">
            {zonesQuery.isFetching ||
            racksQuery.isFetching ||
            shelvesQuery.isFetching ? (
              <LoaderCircle className="animate-spin" data-icon="inline-start" />
            ) : (
              <RefreshCw data-icon="inline-start" />
            )}
            Làm mới
          </Button>
        }
      />

      <div className="grid min-h-0 gap-4 xl:grid-cols-3">
        <LocationPanel
          addLabel="Thêm khu vực"
          count={zones.length}
          loading={zonesQuery.isLoading}
          title="Khu vực"
          onAdd={() => setEditor({ kind: "zone" })}
        >
          <SimpleTable
            empty="Chưa có khu vực"
            headers={["Mã", "Tên"]}
            rows={zones.map((zone) => ({
              id: zone.id,
              active: zone.id === activeZoneId,
              cells: [zone.code, zone.name],
              onDelete: () => setDeleteTarget({ kind: "zone", value: zone }),
              onEdit: () => setEditor({ kind: "zone", value: zone }),
              onSelect: () => {
                setSelectedZoneId(zone.id);
                setSelectedRackId("");
              },
            }))}
          />
        </LocationPanel>

        <LocationPanel
          addLabel="Thêm kệ"
          count={racks.length}
          disabled={!activeZoneId}
          loading={racksQuery.isLoading}
          title="Kệ"
          onAdd={() => setEditor({ kind: "rack" })}
        >
          <SimpleTable
            empty={activeZoneId ? "Chưa có kệ" : "Chọn khu vực trước"}
            headers={["Mã", "Tên"]}
            rows={racks.map((rack) => ({
              id: rack.id,
              active: rack.id === activeRackId,
              cells: [rack.code, rack.name],
              onDelete: () => setDeleteTarget({ kind: "rack", value: rack }),
              onEdit: () => setEditor({ kind: "rack", value: rack }),
              onSelect: () => setSelectedRackId(rack.id),
            }))}
          />
        </LocationPanel>

        <LocationPanel
          addLabel="Thêm tầng kệ"
          count={shelves.length}
          disabled={!activeRackId}
          loading={shelvesQuery.isLoading}
          title="Tầng kệ"
          onAdd={() => setEditor({ kind: "shelf" })}
        >
          <SimpleTable
            empty={activeRackId ? "Chưa có tầng kệ" : "Chọn kệ trước"}
            headers={["Mã", "Tầng"]}
            rows={shelves.map((shelf) => ({
              id: shelf.id,
              cells: [shelf.code, String(shelf.level)],
              onDelete: () => setDeleteTarget({ kind: "shelf", value: shelf }),
              onEdit: () => setEditor({ kind: "shelf", value: shelf }),
              onSelect: () => undefined,
            }))}
          />
        </LocationPanel>
      </div>

      <LocationEditor
        key={editor ? `${editor.kind}-${editor.value?.id ?? "new"}` : "closed"}
        editor={editor}
        rackId={activeRackId}
        zoneId={activeZoneId}
        onClose={() => setEditor(null)}
        onSaved={(kind, id) => {
          setEditor(null);
          if (kind === "zone") setSelectedZoneId(id);
          if (kind === "rack") setSelectedRackId(id);
          refresh();
        }}
      />
      <DeleteLocationDialog
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={() => {
          setDeleteTarget(null);
          refresh();
        }}
      />
    </div>
  );
}

function LocationPanel({
  addLabel,
  children,
  count,
  disabled,
  loading,
  onAdd,
  title,
}: {
  addLabel: string;
  children: React.ReactNode;
  count: number;
  disabled?: boolean;
  loading: boolean;
  onAdd: () => void;
  title: string;
}) {
  return (
    <TablePanel
      count={`${count} mục`}
      title={title}
      action={
        <Button disabled={disabled} onClick={onAdd} size="sm" type="button">
          <Plus data-icon="inline-start" />
          {addLabel}
        </Button>
      }
    >
      {loading ? <TableSkeleton columns={3} rows={5} /> : children}
    </TablePanel>
  );
}

type Row = {
  id: string;
  active?: boolean;
  cells: string[];
  onDelete: () => void;
  onEdit: () => void;
  onSelect: () => void;
};

function SimpleTable({
  empty,
  headers,
  rows,
}: {
  empty: string;
  headers: string[];
  rows: Row[];
}) {
  if (!rows.length) return <EmptyState title={empty} />;
  return (
    <Table scrollable>
      <TableHeader>
        <TableRow>
          {headers.map((header) => (
            <TableHead key={header}>{header}</TableHead>
          ))}
          <TableHead className="w-24 text-right">Thao tác</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow
            className={row.active ? "bg-primary/5" : "cursor-pointer"}
            key={row.id}
            onClick={row.onSelect}
          >
            {row.cells.map((cell, index) => (
              <TableCell
                className={index === 0 ? "font-mono text-xs" : undefined}
                key={`${row.id}-${index}`}
              >
                {cell}
              </TableCell>
            ))}
            <TableCell>
              <div className="flex justify-end gap-1">
                <Button
                  aria-label="Sửa"
                  onClick={(event) => {
                    event.stopPropagation();
                    row.onEdit();
                  }}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <Pencil />
                </Button>
                <Button
                  aria-label="Xóa"
                  onClick={(event) => {
                    event.stopPropagation();
                    row.onDelete();
                  }}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <Trash2 className="text-destructive" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function LocationEditor({
  editor,
  onClose,
  onSaved,
  rackId,
  zoneId,
}: {
  editor: Editor;
  onClose: () => void;
  onSaved: (kind: "zone" | "rack" | "shelf", id: string) => void;
  rackId: string;
  zoneId: string;
}) {
  const [name, setName] = useState(
    editor?.kind !== "shelf" ? (editor?.value?.name ?? "") : "",
  );
  const [code, setCode] = useState(editor?.value?.code ?? "");
  const [level, setLevel] = useState(
    editor?.kind === "shelf" ? String(editor.value?.level ?? 1) : "1",
  );
  const [isStaging, setIsStaging] = useState(
    editor?.kind === "shelf" ? Boolean(editor.value?.isStaging) : false,
  );

  const mutation = useMutation({
    mutationFn: async () => {
      if (!editor) throw new Error("Thiếu dữ liệu vị trí");
      if (editor.kind === "zone") {
        const input = { code: text(code), name: text(name) };
        return editor.value
          ? updateZone(editor.value.id, input)
          : createZone(input);
      }
      if (editor.kind === "rack") {
        const input = { code: text(code), name: text(name), zoneId };
        return editor.value
          ? updateRack(editor.value.id, input)
          : createRack(input);
      }
      const input = {
        code: text(code),
        isStaging,
        level: Number(level),
        rackId,
      };
      return editor.value
        ? updateShelf(editor.value.id, input)
        : createShelf(input);
    },
    onError: (error) => toast.error(errorMessage(error)),
    onSuccess: (value) => {
      if (!editor) return;
      toast.success(editor.value ? "Đã cập nhật vị trí" : "Đã thêm vị trí");
      onSaved(editor.kind, value.id);
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }

  const title =
    editor?.kind === "zone"
      ? "khu vực"
      : editor?.kind === "rack"
        ? "kệ"
        : "tầng kệ";
  return (
    <Dialog open={Boolean(editor)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form className="space-y-4" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>
              {editor?.value ? "Sửa" : "Thêm"} {title}
            </DialogTitle>
            <DialogDescription>
              Dữ liệu được dùng trực tiếp trong luồng nhập, cất và xuất hàng.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="location-code">Mã</Label>
              <Input
                id="location-code"
                required
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </div>
            {editor?.kind === "shelf" ? (
              <div className="space-y-2">
                <Label htmlFor="location-level">Tầng</Label>
                <Input
                  id="location-level"
                  min={1}
                  required
                  type="number"
                  value={level}
                  onChange={(event) => setLevel(event.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="location-name">Tên</Label>
                <Input
                  id="location-name"
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
            )}
          </div>
          {editor?.kind === "shelf" ? (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={isStaging}
                onCheckedChange={(value) => setIsStaging(value === true)}
              />
              Khu tạm nhận hàng
            </label>
          ) : null}
          <DialogFooter>
            <Button onClick={onClose} type="button" variant="outline">
              Hủy
            </Button>
            <Button disabled={mutation.isPending} type="submit">
              Lưu
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteLocationDialog({
  onClose,
  onDeleted,
  target,
}: {
  target: Editor;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const mutation = useMutation({
    mutationFn: async () => {
      if (!target?.value) return;
      if (target.kind === "zone") return deleteZone(target.value.id);
      if (target.kind === "rack") return deleteRack(target.value.id);
      return deleteShelf(target.value.id);
    },
    onError: (error) => toast.error(errorMessage(error)),
    onSuccess: () => {
      toast.success("Đã xóa vị trí");
      onDeleted();
    },
  });
  return (
    <Dialog open={Boolean(target)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Xóa vị trí?</DialogTitle>
          <DialogDescription>
            Vị trí sẽ được ngưng sử dụng. Chỉ xóa khi không còn dữ liệu vận hành
            phụ thuộc.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onClose} type="button" variant="outline">
            Hủy
          </Button>
          <Button
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
            type="button"
            variant="destructive"
          >
            Xóa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
