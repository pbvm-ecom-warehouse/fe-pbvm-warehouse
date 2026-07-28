"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  Pencil,
  ImageOff,
  LoaderCircle,
  Minus,
  PackageSearch,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Barcode } from "@/components/barcode";
import { EvidenceImageGallery } from "@/components/evidence-images";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { getApiErrorCode, getApiErrorMessage } from "@/lib/api-contract";
import { hasAnyRole } from "@/lib/rbac";
import { useSessionUser } from "@/hooks/use-session-user";

import { CreateWarehouseItemPanel } from "./create-warehouse-item-panel";
import {
  deleteWarehouseItem,
  listWarehouseItems,
  updateWarehouseItem,
  WAREHOUSE_ITEM_TYPES,
  type UpdateWarehouseItemInput,
  type WarehouseItemAltUnit,
  type WarehouseItem,
  type WarehouseItemType,
} from "../services/warehouse-items.service";

const PAGE_SIZE = 20;
const WAREHOUSE_UNITS = ["cái", "thùng", "hộp", "kg", "g", "lít", "ml", "m"];

type AltUnitForm = {
  factor: string;
  unit: string;
};

type ItemForm = {
  name: string;
  unit: string;
  altUnits: AltUnitForm[];
  isPerishable: boolean;
  nearExpiryDays: string;
  depth: string;
  width: string;
  height: string;
};

const productKeys = {
  list: (params: {
    isActive: boolean | "ALL";
    page: number;
    search: string;
    type: WarehouseItemType | "ALL";
  }) => ["stock-items", "list", params] as const,
};

function formatError(error: unknown) {
  const code = getApiErrorCode(error);
  const messages: Partial<Record<string, string>> = {
    STOCK_ITEM_DIMENSIONS_LOCKED:
      "Kích thước đã bị khoá vì mặt hàng đã có đơn đặt hàng — không thể sửa.",
  };
  return (
    (code && messages[code]) ||
    getApiErrorMessage(error) ||
    "Không kết nối được WMS."
  );
}

function optionalNumber(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function optionalPositiveNumber(value: string) {
  const parsed = optionalNumber(value);
  return parsed && parsed > 0 ? parsed : undefined;
}

function stringValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function altUnitToForm(unit: WarehouseItemAltUnit): AltUnitForm | null {
  const unitName = stringValue(unit.unit).trim();
  const factor = stringValue(unit.factor ?? unit.quantity).trim();

  if (!unitName && !factor) {
    return null;
  }

  return {
    factor,
    unit: unitName,
  };
}

function normalizeAltUnits(units: WarehouseItemAltUnit[] | undefined) {
  const first = (units ?? [])[0];
  const row = first ? altUnitToForm(first) : null;
  return row ? [row] : [{ factor: "", unit: "cái" }];
}

function altUnitsToPayload(units: AltUnitForm[]): WarehouseItemAltUnit[] {
  const row = units[0];
  const factor = row ? optionalPositiveNumber(row.factor) : undefined;
  const unitName = row?.unit.trim();
  return factor && unitName ? [{ factor, unit: unitName }] : [];
}

function isAltUnitValid(row: AltUnitForm | undefined) {
  if (!row) return false;
  return Boolean(optionalPositiveNumber(row.factor)) && Boolean(row.unit.trim());
}

function itemToForm(item: WarehouseItem): ItemForm {
  return {
    altUnits: normalizeAltUnits(item.altUnits),
    depth: item.depth?.toString() ?? "",
    height: item.height?.toString() ?? "",
    isPerishable: item.isPerishable,
    name: item.name,
    nearExpiryDays: item.nearExpiryDays?.toString() ?? "",
    unit: item.unit,
    width: item.width?.toString() ?? "",
  };
}

function formToUpdatePayload(form: ItemForm): UpdateWarehouseItemInput {
  return {
    altUnits: altUnitsToPayload(form.altUnits),
    depth: optionalNumber(form.depth),
    height: optionalNumber(form.height),
    isPerishable: form.isPerishable,
    name: form.name.trim(),
    nearExpiryDays: optionalNumber(form.nearExpiryDays),
    unit: "thùng",
    width: optionalNumber(form.width),
  };
}

function typeLabel(type: WarehouseItemType) {
  const labels: Record<WarehouseItemType, string> = {
    CUP_BLANK: "Ly chưa in",
    CUP_PRINTED: "Ly đã in",
    MATERIAL: "Nguyên liệu",
    PACKAGING: "Bao bì",
  };

  return labels[type];
}

function ErrorBanner({ error }: { error: unknown }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
      {formatError(error)}
    </div>
  );
}

export function WarehouseItemsClient() {
  const user = useSessionUser();
  const queryClient = useQueryClient();
  const canManage = hasAnyRole(user?.roles, ["ADMIN", "MANAGER"]);
  const canAdministerOptions = hasAnyRole(user?.roles, ["ADMIN"]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<WarehouseItemType | "ALL">(
    "ALL",
  );
  const [activeFilter, setActiveFilter] = useState<boolean | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [viewingItem, setViewingItem] = useState<WarehouseItem | null>(null);
  const [editingItem, setEditingItem] = useState<WarehouseItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<WarehouseItem | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const itemsQuery = useQuery({
    queryFn: () =>
      listWarehouseItems({
        isActive: activeFilter,
        limit: PAGE_SIZE,
        page,
        search,
        type: typeFilter,
      }),
    queryKey: productKeys.list({
      isActive: activeFilter,
      page,
      search,
      type: typeFilter,
    }),
  });

  const items = useMemo(() => itemsQuery.data?.data ?? [], [itemsQuery.data]);
  const total = itemsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const updateMutation = useMutation({
    mutationFn: ({ form, itemId }: { form: ItemForm; itemId: string }) =>
      updateWarehouseItem(itemId, formToUpdatePayload(form)),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: () => {
      setEditingItem(null);
      void queryClient.invalidateQueries({ queryKey: ["stock-items"] });
      toast.success("Đã cập nhật mặt hàng");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => deleteWarehouseItem(itemId),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: () => {
      setDeletingItem(null);
      void queryClient.invalidateQueries({ queryKey: ["stock-items"] });
      toast.success("Đã ngưng dùng mặt hàng");
    },
  });

  function handleFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sản phẩm"
        actions={
          <>
            <Button
              onClick={() =>
                void queryClient.invalidateQueries({
                  queryKey: ["stock-items"],
                })
              }
              type="button"
              variant="outline"
            >
              {itemsQuery.isFetching ? (
                <LoaderCircle
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : (
                <RefreshCw data-icon="inline-start" />
              )}
              Làm mới
            </Button>
            {canAdministerOptions ? (
              <Button asChild variant="outline">
                <Link href="/products/attributes">
                  <PackageSearch data-icon="inline-start" />
                  Quản lý thuộc tính
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <div className="space-y-4">
        {!canManage ? (
          <PermissionNotice>
            Bạn có thể xem danh sách mặt hàng. Quyền tạo và sửa dành cho quản lý
            kho.
          </PermissionNotice>
        ) : null}

        {itemsQuery.error ? <ErrorBanner error={itemsQuery.error} /> : null}

        {canManage ? (
          <div className="flex justify-end">
            <Button type="button" onClick={() => setCreateDialogOpen(true)}>
              <Plus data-icon="inline-start" />
              Tạo mặt hàng
            </Button>
          </div>
        ) : null}

        <TablePanel
          count={`${total} bản ghi · trang ${page}/${totalPages}`}
          title={
            <span className="flex items-center gap-2">
              <PackageSearch className="size-4 text-primary" />
              Mặt hàng kho
            </span>
          }
        >
          <form
            className="grid gap-3 md:grid-cols-[1fr_180px_160px_auto]"
            onSubmit={handleFilter}
          >
            <div className="space-y-2">
              <Label htmlFor="product-search">Tìm kiếm</Label>
              <Input
                id="product-search"
                placeholder="SKU, tên hoặc mã vạch"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <SelectFilter
              label="Loại"
              value={typeFilter}
              onChange={(value) =>
                setTypeFilter(value as WarehouseItemType | "ALL")
              }
            >
              <SelectItem value="ALL">Tất cả</SelectItem>
              {WAREHOUSE_ITEM_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {typeLabel(type)}
                </SelectItem>
              ))}
            </SelectFilter>
            <SelectFilter
              label="Trạng thái"
              value={String(activeFilter)}
              onChange={(value) =>
                setActiveFilter(value === "ALL" ? "ALL" : value === "true")
              }
            >
              <SelectItem value="ALL">Tất cả</SelectItem>
              <SelectItem value="true">Đang dùng</SelectItem>
              <SelectItem value="false">Ngưng dùng</SelectItem>
            </SelectFilter>
            <Button className="self-end" type="submit">
              <Search data-icon="inline-start" />
              Lọc
            </Button>
          </form>

          {itemsQuery.isLoading ? (
            <TableSkeleton columns={7} />
          ) : items.length === 0 ? (
            <EmptyState title="Chưa có mặt hàng" />
          ) : (
            <Table scrollable>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Ảnh</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Tên</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead>Đơn vị</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id} className="focus-within:bg-primary/5">
                    <TableCell>
                      {item.images?.[0] ? (
                        <button
                          aria-label={`Xem ảnh ${item.name}`}
                          className="size-10 overflow-hidden rounded-md border bg-muted"
                          onClick={() => {
                            setPreviewImage(item.images![0]);
                          }}
                          type="button"
                        >
                          <span
                            className="block size-full bg-cover bg-center"
                            style={{
                              backgroundImage: `url("${item.images[0]}")`,
                            }}
                          />
                        </button>
                      ) : (
                        <div
                          aria-label="Chưa có ảnh"
                          className="flex size-10 items-center justify-center rounded-md border bg-muted/50 text-muted-foreground"
                        >
                          <ImageOff className="size-4" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono font-semibold">
                      {item.sku}
                    </TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{typeLabel(item.type)}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell>
                      <StatusBadge tone={item.isActive ? "success" : "neutral"}>
                        {item.isActive ? "Đang dùng" : "Ngưng dùng"}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() => setViewingItem(item)}
                        >
                          <Eye data-icon="inline-start" />
                          Xem chi tiết
                        </Button>
                        <Button
                          disabled={!canManage}
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() => setEditingItem(item)}
                        >
                          <Pencil data-icon="inline-start" />
                          Sửa
                        </Button>
                        <Button
                          disabled={!canManage || !item.isActive}
                          size="sm"
                          type="button"
                          variant="destructive"
                          onClick={() => setDeletingItem(item)}
                        >
                          <Trash2 data-icon="inline-start" />
                          Ngưng dùng
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="flex items-center justify-between gap-3">
            <Button
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              type="button"
              variant="outline"
            >
              Trang trước
            </Button>
            <span className="text-sm text-muted-foreground">
              {page}/{totalPages}
            </span>
            <Button
              disabled={page >= totalPages}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              type="button"
              variant="outline"
            >
              Trang sau
            </Button>
          </div>
        </TablePanel>
      </div>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent
          size="5xl"
          className="max-h-[90dvh] grid-rows-[auto_minmax(0,1fr)] overflow-hidden p-0"
        >
          <DialogHeader className="border-b px-6 py-4 pr-12">
            <DialogTitle>Tạo mặt hàng</DialogTitle>
            <DialogDescription>
              Nhập thông tin mặt hàng và chọn cấu hình để hệ thống cấp SKU.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto px-6 py-4">
            {createDialogOpen ? (
              <CreateWarehouseItemPanel
                canManage={canManage}
                layout="dialog"
                onCreated={() => {
                  void queryClient.invalidateQueries({
                    queryKey: ["stock-items"],
                  });
                }}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {viewingItem ? (
        <ItemDetailDialog
          canManage={canManage}
          item={viewingItem}
          key={viewingItem.id}
          onPreviewImage={setPreviewImage}
          onEdit={() => {
            setViewingItem(null);
            setEditingItem(viewingItem);
          }}
          onOpenChange={(open) => {
            if (!open) {
              setViewingItem(null);
            }
          }}
        />
      ) : null}

      {editingItem ? (
        <ItemEditDialog
          busy={updateMutation.isPending}
          canManage={canManage}
          item={editingItem}
          key={editingItem.id}
          onPreviewImage={setPreviewImage}
          onOpenChange={(open) => {
            if (!open) {
              setEditingItem(null);
            }
          }}
          onSave={(form) =>
            updateMutation.mutate({ form, itemId: editingItem.id })
          }
        />
      ) : null}

      {previewImage ? (
        <WarehouseItemImageViewer
          imageUrl={previewImage}
          onClose={() => setPreviewImage(null)}
        />
      ) : null}

      <DeleteItemDialog
        busy={deleteMutation.isPending}
        item={deletingItem}
        onDelete={() => {
          if (deletingItem) {
            deleteMutation.mutate(deletingItem.id);
          }
        }}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingItem(null);
          }
        }}
      />
    </div>
  );
}

function WarehouseItemImageViewer({
  imageUrl,
  onClose,
}: {
  imageUrl: string;
  onClose: () => void;
}) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const dragOrigin = useRef<{ x: number; y: number } | null>(null);

  function updateScale(nextScale: number) {
    setScale(Math.min(3, Math.max(1, nextScale)));
    if (nextScale <= 1) {
      setOffset({ x: 0, y: 0 });
    }
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm">
      <button
        aria-label="Đóng xem ảnh"
        className="absolute inset-0 cursor-zoom-out"
        type="button"
        onClick={onClose}
      />
      <Button
        aria-label="Đóng xem ảnh"
        className="fixed right-4 top-4 z-[101]"
        onClick={onClose}
        size="icon-sm"
        type="button"
        variant="secondary"
      >
        <X />
      </Button>
      <div className="fixed bottom-4 left-1/2 z-[101] flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/65 px-2 py-2 backdrop-blur">
        <Button
          aria-label="Thu nhỏ ảnh"
          onClick={() => updateScale(scale - 0.25)}
          size="icon-sm"
          type="button"
          variant="secondary"
        >
          <Minus />
        </Button>
        <span className="min-w-12 text-center text-sm font-medium text-white">
          {Math.round(scale * 100)}%
        </span>
        <Button
          aria-label="Phóng to ảnh"
          onClick={() => updateScale(scale + 0.25)}
          size="icon-sm"
          type="button"
          variant="secondary"
        >
          <Plus />
        </Button>
      </div>
      <img
        alt="Ảnh mặt hàng phóng to"
        className={`relative z-[101] max-h-[96dvh] max-w-[96vw] select-none object-contain shadow-2xl ${scale > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"}`}
        draggable={false}
        src={imageUrl}
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
        }}
        onPointerDown={(event) => {
          if (scale <= 1) return;
          dragOrigin.current = {
            x: event.clientX - offset.x,
            y: event.clientY - offset.y,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const origin = dragOrigin.current;
          if (origin)
            setOffset({
              x: event.clientX - origin.x,
              y: event.clientY - origin.y,
            });
        }}
        onPointerUp={() => {
          dragOrigin.current = null;
        }}
        onPointerCancel={() => {
          dragOrigin.current = null;
        }}
        onClick={() => {
          updateScale(scale === 1 ? 2 : 1);
        }}
        onWheel={(event) => {
          event.preventDefault();
          updateScale(scale + (event.deltaY < 0 ? 0.1 : -0.1));
        }}
      />
    </div>
  );
}
function SelectFilter({
  children,
  label,
  onChange,
  value,
}: {
  children: React.ReactNode;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  );
}

function ItemFormFields({
  busy,
  canManage,
  form,
  onChange,
  onSubmit,
  submitLabel,
}: {
  busy: boolean;
  canManage: boolean;
  form: ItemForm;
  onChange: (form: ItemForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitLabel: string;
}) {
  const canSubmit = canManage && !busy && isAltUnitValid(form.altUnits[0]);

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="grid gap-3 md:grid-cols-2">
        <TextField
          id="item-name"
          label="Tên mặt hàng"
          value={form.name}
          onChange={(name) => onChange({ ...form, name })}
        />
        <div className="space-y-2">
          <Label>Đơn vị cơ sở</Label>
          <Input
            className="bg-muted/50 text-muted-foreground"
            readOnly
            value="thùng"
          />
        </div>
        <AltUnitsField
          value={form.altUnits}
          onChange={(altUnits) => onChange({ ...form, altUnits })}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <TextField
          id="item-depth"
          label="Sâu (1 thùng)"
          required={false}
          type="number"
          value={form.depth}
          onChange={(depth) => onChange({ ...form, depth })}
        />
        <TextField
          id="item-width"
          label="Rộng (1 thùng)"
          required={false}
          type="number"
          value={form.width}
          onChange={(width) => onChange({ ...form, width })}
        />
        <TextField
          id="item-height"
          label="Cao (1 thùng)"
          required={false}
          type="number"
          value={form.height}
          onChange={(height) => onChange({ ...form, height })}
        />
        <TextField
          id="item-near-expiry"
          label="Cảnh báo HSD"
          required={false}
          type="number"
          value={form.nearExpiryDays}
          onChange={(nearExpiryDays) => onChange({ ...form, nearExpiryDays })}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Label
          className="flex items-center gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm font-medium"
          htmlFor="item-perishable"
        >
          <Checkbox
            checked={form.isPerishable}
            id="item-perishable"
            onCheckedChange={(checked) =>
              onChange({ ...form, isPerishable: checked === true })
            }
          />
          Có hạn sử dụng
        </Label>
      </div>

      <Button disabled={!canSubmit} type="submit">
        {busy ? (
          <LoaderCircle className="animate-spin" data-icon="inline-start" />
        ) : (
          <Save data-icon="inline-start" />
        )}
        {submitLabel}
      </Button>
    </form>
  );
}
function TextField({
  id,
  label,
  onChange,
  readOnly = false,
  required = true,
  type = "text",
  value,
}: {
  id: string;
  label: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  required?: boolean;
  type?: string;
  value: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        className={readOnly ? "bg-muted/50 text-muted-foreground" : undefined}
        readOnly={readOnly}
        required={required}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function UnitSelectField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {WAREHOUSE_UNITS.filter((unit) => unit !== "thùng").map((unit) => (
            <SelectItem key={unit} value={unit}>
              {unit}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function AltUnitsField({
  onChange,
  value,
}: {
  onChange: (value: AltUnitForm[]) => void;
  value: AltUnitForm[];
}) {
  const row = value[0] ?? { factor: "", unit: "cái" };

  function updateRow(next: Partial<AltUnitForm>) {
    onChange([{ ...row, ...next }]);
  }

  return (
    <div className="space-y-2 md:col-span-2">
      <Label>Đơn vị phụ (chỉ tham khảo hiển thị, không dùng để tính số lượng)</Label>
      <div className="grid gap-2 rounded-lg border border-border/70 bg-muted/20 p-2 md:grid-cols-[1fr_140px]">
        <UnitSelectField
          label="Đơn vị"
          value={row.unit}
          onChange={(unit) => updateRow({ unit })}
        />
        <TextField
          id="item-alt-unit-factor"
          label="Hệ số"
          required={false}
          type="number"
          value={row.factor}
          onChange={(factor) => updateRow({ factor })}
        />
      </div>
    </div>
  );
}

function ItemDetailDialog({
  canManage,
  item,
  onEdit,
  onOpenChange,
  onPreviewImage,
}: {
  canManage: boolean;
  item: WarehouseItem;
  onEdit: () => void;
  onOpenChange: (open: boolean) => void;
  onPreviewImage: (imageUrl: string) => void;
}) {
  const dimensions = [item.depth, item.width, item.height]
    .map((value) => value ?? "-")
    .join(" × ");

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent size="2xl" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Chi tiết mặt hàng</DialogTitle>
          <DialogDescription>{item.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <section className="space-y-3" aria-labelledby="item-info-title">
            <h3
              id="item-info-title"
              className="text-sm font-semibold text-foreground"
            >
              Thông tin chung
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailCard label="Tên" value={item.name} />
              <DetailCard label="Loại" value={typeLabel(item.type)} />
              <DetailCard label="Đơn vị cơ sở" value={item.unit} />
              <div className="flex items-center justify-between rounded-lg border bg-muted/20 p-3">
                <span className="text-sm text-muted-foreground">
                  Trạng thái
                </span>
                <StatusBadge tone={item.isActive ? "success" : "neutral"}>
                  {item.isActive ? "Đang dùng" : "Ngưng dùng"}
                </StatusBadge>
              </div>
            </div>
          </section>

          <section
            className="space-y-3 border-t pt-4"
            aria-labelledby="item-barcode-title"
          >
            <h3
              id="item-barcode-title"
              className="text-sm font-semibold text-foreground"
            >
              Mã vạch nội bộ
            </h3>
            <div className="rounded-lg border bg-muted/20 p-3">
              {item.barcode ? (
                <Barcode value={item.barcode} />
              ) : (
                <div className="text-sm text-muted-foreground">Chưa có</div>
              )}
            </div>
          </section>

          <section
            className="space-y-3 border-t pt-4"
            aria-labelledby="item-specs-title"
          >
            <h3
              id="item-specs-title"
              className="text-sm font-semibold text-foreground"
            >
              Thông số kỹ thuật
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailCard
                label="Mức tồn tối thiểu"
                value={item.minQuantity?.toString() ?? "Chưa đặt"}
              />
              <DetailCard label="Kích thước S × R × C" value={dimensions} />
              <DetailCard
                label="Hạn sử dụng"
                value={
                  item.isPerishable
                    ? `Cảnh báo trước ${item.nearExpiryDays ?? 0} ngày`
                    : "Không theo dõi"
                }
              />
            </div>
          </section>

          <section
            className="space-y-3 border-t pt-4"
            aria-labelledby="item-images-title"
          >
            <h3
              id="item-images-title"
              className="text-center text-sm font-semibold text-foreground"
            >
              Ảnh mặt hàng
            </h3>
            <EvidenceImageGallery
              className="mx-auto flex w-72 max-w-full justify-center sm:w-96"
              emptyLabel="Chưa có ảnh mặt hàng."
              images={item.images}
              label=""
              onPreview={onPreviewImage}
            />
          </section>

          <section
            className="space-y-3 border-t pt-4"
            aria-labelledby="item-sku-title"
          >
            <h3
              id="item-sku-title"
              className="text-sm font-semibold text-foreground"
            >
              SKU được tạo
            </h3>
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="break-all font-mono text-sm font-semibold">
                {item.sku}
              </div>
              {item.attributes?.length ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {item.attributes.map((attribute, index) => (
                    <div
                      className="flex items-center justify-between gap-3 rounded-md bg-background px-3 py-2 text-sm"
                      key={attribute.optionId ?? `${attribute.code}-${index}`}
                    >
                      <span className="text-muted-foreground">
                        {attribute.name || attribute.key || "Thuộc tính"}
                      </span>
                      <span className="font-medium">
                        {attribute.value || "-"}
                        {attribute.code ? ` (${attribute.code})` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  Chưa có thông tin thuộc tính SKU.
                </p>
              )}
            </div>
          </section>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Đóng
            </Button>
          </DialogClose>
          <Button disabled={!canManage} type="button" onClick={onEdit}>
            <Pencil data-icon="inline-start" />
            Sửa mặt hàng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function ItemEditDialog({
  busy,
  canManage,
  item,
  onOpenChange,
  onSave,
  onPreviewImage,
}: {
  busy: boolean;
  canManage: boolean;
  item: WarehouseItem;
  onOpenChange: (open: boolean) => void;
  onSave: (form: ItemForm) => void;
  onPreviewImage: (imageUrl: string) => void;
}) {
  const [form, setForm] = useState(() => itemToForm(item));

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(form);
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent size="2xl" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item.sku}</DialogTitle>
          <DialogDescription>{item.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="grid gap-2 rounded-lg border border-border/70 bg-muted/20 p-3 text-sm">
            <InfoRow label="Loại" value={typeLabel(item.type)} />
            <InfoRow label="Đơn vị" value={item.unit} />
            <InfoRow
              label="Mã vạch chính"
              value={item.barcode || "Chưa khai báo"}
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Trạng thái</span>
              <StatusBadge tone={item.isActive ? "success" : "neutral"}>
                {item.isActive ? "Đang dùng" : "Ngưng dùng"}
              </StatusBadge>
            </div>
          </div>

          <section
            className="space-y-3 border-t pt-4"
            aria-labelledby="edit-item-barcode-title"
          >
            <h3
              id="edit-item-barcode-title"
              className="text-sm font-semibold text-foreground"
            >
              Mã vạch nội bộ
            </h3>
            <div className="rounded-lg border bg-muted/20 p-3">
              {item.barcode ? (
                <Barcode value={item.barcode} />
              ) : (
                <div className="text-sm text-muted-foreground">Chưa có</div>
              )}
            </div>
          </section>

          <section
            className="space-y-3 border-t pt-4"
            aria-labelledby="edit-item-images-title"
          >
            <h3
              id="edit-item-images-title"
              className="text-center text-sm font-semibold text-foreground"
            >
              Ảnh mặt hàng
            </h3>
            <EvidenceImageGallery
              className="mx-auto flex w-72 max-w-full justify-center sm:w-96"
              emptyLabel="Chưa có ảnh mặt hàng."
              images={item.images}
              label=""
              onPreview={onPreviewImage}
            />
          </section>

          <ItemFormFields
            busy={busy}
            canManage={canManage}
            form={form}
            submitLabel="Lưu mặt hàng"
            onChange={setForm}
            onSubmit={handleSubmit}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DeleteItemDialog({
  busy,
  item,
  onDelete,
  onOpenChange,
}: {
  busy: boolean;
  item: WarehouseItem | null;
  onDelete: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={Boolean(item)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ngưng dùng mặt hàng?</DialogTitle>
          <DialogDescription>
            {item
              ? `${item.sku} sẽ không còn dùng cho các thao tác mới. Dữ liệu cũ vẫn được giữ để đối chiếu.`
              : "Mặt hàng sẽ không còn dùng cho các thao tác mới."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Hủy
            </Button>
          </DialogClose>
          <Button
            disabled={busy || !item}
            onClick={onDelete}
            type="button"
            variant="destructive"
          >
            {busy ? (
              <LoaderCircle className="animate-spin" data-icon="inline-start" />
            ) : (
              <Trash2 data-icon="inline-start" />
            )}
            Ngưng dùng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate font-medium">{value}</span>
    </div>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}
