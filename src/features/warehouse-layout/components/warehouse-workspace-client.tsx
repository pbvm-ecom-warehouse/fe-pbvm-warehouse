"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Map,
  Warehouse,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
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
  PermissionNotice,
  StatusBadge,
  TablePanel,
  TableSkeleton,
} from "@/features/admin-shell/components/operations-ui";
import { WarehouseLayoutEditor } from "@/features/warehouse-layout/components/warehouse-layout-editor";
import {
  createWarehouse,
  deleteWarehouse,
  listWarehouses,
  updateWarehouse,
  type WarehouseStructureWarehouse,
} from "@/features/warehouse-structure/services/warehouse-structure.service";
import { useSessionUser } from "@/hooks/use-session-user";
import { getApiErrorMessage } from "@/lib/api-contract";
import { hasAnyRole } from "@/lib/rbac";
import { cn } from "@/lib/utils";

const warehouseWorkspaceKeys = {
  list: ["warehouse-workspace", "warehouses"] as const,
};

const defaultWarehouseForm = {
  address: "",
  isActive: true,
  name: "",
};

function formatError(error: unknown) {
  return getApiErrorMessage(error) ?? "Không kết nối được WMS.";
}

function requiredText(value: string) {
  return value.trim();
}

function toWarehouseForm(warehouse: WarehouseStructureWarehouse) {
  return {
    address: warehouse.address,
    isActive: warehouse.isActive,
    name: warehouse.name,
  };
}

function toWarehousePayload(form: typeof defaultWarehouseForm) {
  return {
    address: requiredText(form.address),
    isActive: form.isActive,
    name: requiredText(form.name),
  };
}

export function WarehouseWorkspaceClient() {
  const user = useSessionUser();
  const canManage = hasAnyRole(user?.roles, ["MANAGER"]);
  const queryClient = useQueryClient();
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(defaultWarehouseForm);
  const [editingWarehouse, setEditingWarehouse] =
    useState<WarehouseStructureWarehouse | null>(null);
  const [editForm, setEditForm] = useState(defaultWarehouseForm);
  const [deleteWarehouseTarget, setDeleteWarehouseTarget] =
    useState<WarehouseStructureWarehouse | null>(null);

  const warehousesQuery = useQuery({
    enabled: canManage,
    queryFn: listWarehouses,
    queryKey: warehouseWorkspaceKeys.list,
  });

  const warehouses = useMemo(
    () => warehousesQuery.data ?? [],
    [warehousesQuery.data],
  );

  const selectedWarehouse =
    warehouses.find((warehouse) => warehouse.id === selectedWarehouseId) ??
    warehouses.find((warehouse) => warehouse.id === user?.warehouseId) ??
    warehouses[0] ??
    null;
  const activeWarehouseId = selectedWarehouse?.id ?? "";

  const createWarehouseMutation = useMutation({
    mutationFn: () => createWarehouse(toWarehousePayload(createForm)),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: (warehouse) => {
      setCreateForm(defaultWarehouseForm);
      setCreateOpen(false);
      setSelectedWarehouseId(warehouse.id);
      void queryClient.invalidateQueries({
        queryKey: warehouseWorkspaceKeys.list,
      });
      toast.success("Đã tạo kho");
    },
  });

  const updateWarehouseMutation = useMutation({
    mutationFn: ({
      form,
      warehouseId,
    }: {
      form: typeof defaultWarehouseForm;
      warehouseId: string;
    }) => updateWarehouse(warehouseId, toWarehousePayload(form)),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: () => {
      setEditingWarehouse(null);
      void queryClient.invalidateQueries({
        queryKey: warehouseWorkspaceKeys.list,
      });
      toast.success("Đã cập nhật kho");
    },
  });

  const deleteWarehouseMutation = useMutation({
    mutationFn: (warehouseId: string) => deleteWarehouse(warehouseId),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: (_, warehouseId) => {
      if (selectedWarehouseId === warehouseId) {
        setSelectedWarehouseId("");
      }
      setDeleteWarehouseTarget(null);
      void queryClient.invalidateQueries({
        queryKey: warehouseWorkspaceKeys.list,
      });
      toast.success("Đã xóa kho");
    },
  });

  function refreshWarehouses() {
    void queryClient.invalidateQueries({ queryKey: warehouseWorkspaceKeys.list });
    void queryClient.invalidateQueries({ queryKey: ["warehouse-layout"] });
  }

  function openEditDialog(warehouse: WarehouseStructureWarehouse) {
    setEditingWarehouse(warehouse);
    setEditForm(toWarehouseForm(warehouse));
  }

  function handleCreateWarehouse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createWarehouseMutation.mutate();
  }

  function handleEditWarehouse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingWarehouse) {
      return;
    }

    updateWarehouseMutation.mutate({
      form: editForm,
      warehouseId: editingWarehouse.id,
    });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Kho"
        actions={
          <>
            <Button
              disabled={!canManage}
              onClick={refreshWarehouses}
              type="button"
              variant="outline"
            >
              {warehousesQuery.isFetching ? (
                <LoaderCircle className="animate-spin" data-icon="inline-start" />
              ) : (
                <RefreshCw data-icon="inline-start" />
              )}
              Làm mới
            </Button>
            <Button
              disabled={!canManage}
              onClick={() => setCreateOpen(true)}
              type="button"
            >
              <Plus data-icon="inline-start" />
              Tạo kho
            </Button>
          </>
        }
      />

      {!canManage ? (
        <PermissionNotice>
          Bạn cần quyền quản lý để chỉnh kho và sơ đồ kho.
        </PermissionNotice>
      ) : null}

      {warehousesQuery.error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {formatError(warehousesQuery.error)}
        </div>
      ) : null}

      <div className="space-y-4">
        <TablePanel
          count={`${warehouses.length} kho`}
          title={
            <span className="flex items-center gap-2">
              <Warehouse className="size-4 text-primary" />
              Danh sách kho
            </span>
          }
        >
          {warehousesQuery.isLoading ? (
            <TableSkeleton columns={5} rows={4} />
          ) : (
            <WarehouseList
              activeId={activeWarehouseId}
              canManage={canManage}
              warehouses={warehouses}
              onDelete={setDeleteWarehouseTarget}
              onEdit={openEditDialog}
              onSelect={(warehouse) => setSelectedWarehouseId(warehouse.id)}
            />
          )}
        </TablePanel>

        <section className="min-w-0">
          {selectedWarehouse ? (
            <WarehouseLayoutEditor
              key={selectedWarehouse.id}
              warehouseId={selectedWarehouse.id}
              warehouseName={selectedWarehouse.name}
            />
          ) : warehouses.length > 0 ? (
            <EmptyState
              title="Chọn kho để mở sơ đồ"
              description="Sơ đồ của kho được chọn sẽ hiển thị tại đây."
            />
          ) : null}
        </section>
      </div>

      <WarehouseFormDialog
        busy={createWarehouseMutation.isPending}
        form={createForm}
        open={createOpen}
        title="Tạo kho"
        submitLabel="Tạo kho"
        onChange={setCreateForm}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreateWarehouse}
      />

      <WarehouseFormDialog
        busy={updateWarehouseMutation.isPending}
        form={editForm}
        open={Boolean(editingWarehouse)}
        title="Sửa kho"
        submitLabel="Lưu kho"
        onChange={setEditForm}
        onOpenChange={(open) => !open && setEditingWarehouse(null)}
        onSubmit={handleEditWarehouse}
      />

      <Dialog
        open={Boolean(deleteWarehouseTarget)}
        onOpenChange={(open) => !open && setDeleteWarehouseTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa kho?</DialogTitle>
            <DialogDescription>
              Kho sẽ bị xóa khỏi danh sách quản lý. Chỉ thực hiện khi dữ liệu
              kho không còn dùng trong vận hành.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Hủy
              </Button>
            </DialogClose>
            <Button
              disabled={
                !deleteWarehouseTarget || deleteWarehouseMutation.isPending
              }
              onClick={() => {
                if (deleteWarehouseTarget) {
                  deleteWarehouseMutation.mutate(deleteWarehouseTarget.id);
                }
              }}
              type="button"
              variant="destructive"
            >
              <Trash2 data-icon="inline-start" />
              Xóa kho
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WarehouseList({
  activeId,
  canManage,
  onDelete,
  onEdit,
  onSelect,
  warehouses,
}: {
  activeId: string;
  canManage: boolean;
  onDelete: (warehouse: WarehouseStructureWarehouse) => void;
  onEdit: (warehouse: WarehouseStructureWarehouse) => void;
  onSelect: (warehouse: WarehouseStructureWarehouse) => void;
  warehouses: WarehouseStructureWarehouse[];
}) {
  if (!warehouses.length) {
    return (
      <EmptyState
        title="Chưa có kho"
        description="Tạo kho để bắt đầu bố trí sơ đồ."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border/70">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Kho</TableHead>
            <TableHead>Địa chỉ</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead className="w-56 text-right">Thao tác</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {warehouses.map((warehouse) => (
            <TableRow
              className={cn(
                "cursor-pointer transition-colors hover:bg-muted/45",
                activeId === warehouse.id && "bg-primary/5",
              )}
              key={warehouse.id}
              onClick={() => onSelect(warehouse)}
            >
              <TableCell>
                <div className="font-medium">{warehouse.name}</div>
                <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                  {warehouse.id}
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {warehouse.address || "Chưa nhập địa chỉ"}
              </TableCell>
              <TableCell>
                <StatusBadge tone={warehouse.isActive ? "success" : "neutral"}>
                  {warehouse.isActive ? "Đang dùng" : "Ngưng dùng"}
                </StatusBadge>
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  <Button
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect(warehouse);
                    }}
                    size="sm"
                    type="button"
                    variant={activeId === warehouse.id ? "default" : "outline"}
                  >
                    <Map data-icon="inline-start" />
                    Mở sơ đồ
                  </Button>
                  <Button
                    disabled={!canManage}
                    onClick={(event) => {
                      event.stopPropagation();
                      onEdit(warehouse);
                    }}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Pencil data-icon="inline-start" />
                    Sửa
                  </Button>
                  <Button
                    disabled={!canManage}
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(warehouse);
                    }}
                    size="sm"
                    type="button"
                    variant="destructive"
                  >
                    <Trash2 data-icon="inline-start" />
                    Xóa
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function WarehouseFormDialog({
  busy,
  form,
  onChange,
  onOpenChange,
  onSubmit,
  open,
  submitLabel,
  title,
}: {
  busy: boolean;
  form: typeof defaultWarehouseForm;
  onChange: (form: typeof defaultWarehouseForm) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  open: boolean;
  submitLabel: string;
  title: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Mỗi kho có danh sách vị trí và sơ đồ riêng.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor={`${submitLabel}-name`}>Tên kho</Label>
            <Input
              id={`${submitLabel}-name`}
              required
              value={form.name}
              onChange={(event) =>
                onChange({ ...form, name: event.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${submitLabel}-address`}>Địa chỉ</Label>
            <Input
              id={`${submitLabel}-address`}
              required
              value={form.address}
              onChange={(event) =>
                onChange({ ...form, address: event.target.value })
              }
            />
          </div>
          <Label
            className="flex items-center gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm font-medium"
            htmlFor={`${submitLabel}-active`}
          >
            <Checkbox
              checked={form.isActive}
              id={`${submitLabel}-active`}
              onCheckedChange={(checked) =>
                onChange({ ...form, isActive: checked === true })
              }
            />
            Đang dùng
          </Label>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Hủy
              </Button>
            </DialogClose>
            <Button disabled={busy} type="submit">
              {busy ? (
                <LoaderCircle className="animate-spin" data-icon="inline-start" />
              ) : (
                <Plus data-icon="inline-start" />
              )}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
