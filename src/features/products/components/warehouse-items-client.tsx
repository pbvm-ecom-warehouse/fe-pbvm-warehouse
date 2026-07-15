"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Pencil,
  LoaderCircle,
  PackageSearch,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
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
  DialogTrigger,
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
import { getApiErrorMessage } from "@/lib/api-contract";
import { hasAnyRole } from "@/lib/rbac";
import { useSessionUser } from "@/hooks/use-session-user";

import {
  createWarehouseItem,
  deleteWarehouseItem,
  listWarehouseItems,
  updateWarehouseItem,
  WAREHOUSE_ITEM_TYPES,
  type CreateWarehouseItemInput,
  type UpdateWarehouseItemInput,
  type WarehouseItemAltUnit,
  type WarehouseItemAttribute,
  type WarehouseItem,
  type WarehouseItemType,
} from "../services/warehouse-items.service";
import { formatWarehouseItemListValue } from "../utils/warehouse-item-format";

const PAGE_SIZE = 20;
const WAREHOUSE_UNITS = ["cái", "thùng", "hộp", "kg", "g", "lít", "ml", "m"];

type AltUnitForm = {
  factor: string;
  unit: string;
};

type AttributeForm = {
  code: string;
  name: string;
  value: string;
};

type ItemForm = {
  sku: string;
  barcode: string;
  name: string;
  type: WarehouseItemType;
  unit: string;
  altBarcodes: string;
  altUnits: AltUnitForm[];
  attributes: AttributeForm[];
  isPerishable: boolean;
  nearExpiryDays: string;
  depth: string;
  width: string;
  height: string;
};

const defaultItemForm: ItemForm = {
  altBarcodes: "",
  altUnits: [],
  attributes: [],
  barcode: "",
  depth: "",
  height: "",
  isPerishable: false,
  name: "",
  nearExpiryDays: "",
  sku: "",
  type: "MATERIAL",
  unit: "cái",
  width: "",
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
  return getApiErrorMessage(error) ?? "Không kết nối được WMS.";
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function splitList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
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

function attributeToForm(attribute: WarehouseItemAttribute): AttributeForm | null {
  const name = stringValue(attribute.name).trim();
  const value = stringValue(attribute.value).trim();
  const code = stringValue(attribute.code).trim();

  if (!name && !value && !code) {
    return null;
  }

  return { code, name, value };
}

function normalizeAltUnits(units: WarehouseItemAltUnit[] | undefined) {
  return (units ?? []).map(altUnitToForm).filter(Boolean) as AltUnitForm[];
}

function normalizeAttributes(attributes: WarehouseItemAttribute[] | undefined) {
  return (attributes ?? [])
    .map(attributeToForm)
    .filter(Boolean) as AttributeForm[];
}

function altUnitsToPayload(units: AltUnitForm[]): WarehouseItemAltUnit[] {
  const payload: WarehouseItemAltUnit[] = [];

  units.forEach((unit) => {
    const factor = optionalPositiveNumber(unit.factor);
    const unitName = unit.unit.trim();

    if (factor && unitName) {
      payload.push({ factor, unit: unitName });
    }
  });

  return payload;
}

function attributesToPayload(attributes: AttributeForm[]): WarehouseItemAttribute[] {
  return attributes
    .map((attribute) => ({
      code: optionalText(attribute.code),
      name: optionalText(attribute.name),
      value: optionalText(attribute.value),
    }))
    .filter((attribute) =>
      Boolean(attribute.code || attribute.name || attribute.value),
    );
}

function itemToForm(item: WarehouseItem): ItemForm {
  return {
    altBarcodes: formatWarehouseItemListValue(item.altBarcodes),
    altUnits: normalizeAltUnits(item.altUnits),
    attributes: normalizeAttributes(item.attributes),
    barcode: item.barcode ?? "",
    depth: item.depth?.toString() ?? "",
    height: item.height?.toString() ?? "",
    isPerishable: item.isPerishable,
    name: item.name,
    nearExpiryDays: item.nearExpiryDays?.toString() ?? "",
    sku: item.sku,
    type: item.type,
    unit: item.unit,
    width: item.width?.toString() ?? "",
  };
}

function formToCreatePayload(form: ItemForm): CreateWarehouseItemInput {
  return {
    altBarcodes: splitList(form.altBarcodes),
    altUnits: altUnitsToPayload(form.altUnits),
    attributes: attributesToPayload(form.attributes),
    barcode: optionalText(form.barcode),
    depth: optionalNumber(form.depth),
    height: optionalNumber(form.height),
    isPerishable: form.isPerishable,
    name: form.name.trim(),
    nearExpiryDays: optionalNumber(form.nearExpiryDays),
    sku: form.sku.trim(),
    type: form.type,
    unit: form.unit.trim(),
    width: optionalNumber(form.width),
  };
}

function formToUpdatePayload(form: ItemForm): UpdateWarehouseItemInput {
  const payload = formToCreatePayload(form);

  return {
    altBarcodes: payload.altBarcodes,
    altUnits: payload.altUnits,
    attributes: payload.attributes,
    barcode: payload.barcode,
    depth: payload.depth,
    height: payload.height,
    isPerishable: payload.isPerishable,
    name: payload.name,
    nearExpiryDays: payload.nearExpiryDays,
    type: payload.type,
    unit: payload.unit,
    width: payload.width,
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
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<WarehouseItemType | "ALL">(
    "ALL",
  );
  const [activeFilter, setActiveFilter] = useState<boolean | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [editingItem, setEditingItem] = useState<WarehouseItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<WarehouseItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState(defaultItemForm);

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

  const createMutation = useMutation({
    mutationFn: () => createWarehouseItem(formToCreatePayload(createForm)),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: () => {
      setCreateForm(defaultItemForm);
      setDialogOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["stock-items"] });
      toast.success("Đã tạo mặt hàng");
    },
  });

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

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createMutation.mutate();
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sản phẩm"
        actions={
          <>
            <Button
              onClick={() =>
                void queryClient.invalidateQueries({ queryKey: ["stock-items"] })
              }
              type="button"
              variant="outline"
            >
              {itemsQuery.isFetching ? (
                <LoaderCircle className="animate-spin" data-icon="inline-start" />
              ) : (
                <RefreshCw data-icon="inline-start" />
              )}
              Làm mới
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button disabled={!canManage}>
                  <Plus data-icon="inline-start" />
                  Tạo mặt hàng
                </Button>
              </DialogTrigger>
              <DialogContent size="2xl" className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Tạo mặt hàng kho</DialogTitle>
                  <DialogDescription>
                    Dùng để nhập hàng, cất hàng và xuất kho.
                  </DialogDescription>
                </DialogHeader>
                <ItemFormFields
                  busy={createMutation.isPending}
                  canManage={canManage}
                  form={createForm}
                  submitLabel="Tạo mặt hàng"
                  onChange={setCreateForm}
                  onSubmit={handleCreate}
                />
              </DialogContent>
            </Dialog>
          </>
        }
      />

      {!canManage ? (
        <PermissionNotice>
          Bạn có thể xem danh sách mặt hàng. Quyền tạo và sửa dành cho
          quản lý kho.
        </PermissionNotice>
      ) : null}

      {itemsQuery.error ? <ErrorBanner error={itemsQuery.error} /> : null}

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
            onChange={(value) => setTypeFilter(value as WarehouseItemType | "ALL")}
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
            <TableSkeleton columns={6} />
          ) : items.length === 0 ? (
            <EmptyState title="Chưa có mặt hàng" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
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
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            type="button"
            variant="outline"
          >
            Trang sau
          </Button>
        </div>
      </TablePanel>

      {editingItem ? (
        <ItemEditDialog
          busy={updateMutation.isPending}
          canManage={canManage}
          item={editingItem}
          key={editingItem.id}
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
  skuReadOnly = false,
  submitLabel,
}: {
  busy: boolean;
  canManage: boolean;
  form: ItemForm;
  onChange: (form: ItemForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  skuReadOnly?: boolean;
  submitLabel: string;
}) {
  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="grid gap-3 md:grid-cols-2">
        <TextField
          id="item-sku"
          label="SKU"
          readOnly={skuReadOnly}
          value={form.sku}
          onChange={(sku) => onChange({ ...form, sku })}
        />
        <TextField
          id="item-name"
          label="Tên mặt hàng"
          value={form.name}
          onChange={(name) => onChange({ ...form, name })}
        />
        <div className="space-y-2">
          <Label>Loại</Label>
          <Select
            value={form.type}
            onValueChange={(type) =>
              onChange({ ...form, type: type as WarehouseItemType })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WAREHOUSE_ITEM_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {typeLabel(type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <UnitSelectField
          label="Đơn vị"
          value={form.unit}
          onChange={(unit) => onChange({ ...form, unit })}
        />
        <TextField
          id="item-barcode"
          label="Mã vạch chính"
          required={false}
          value={form.barcode}
          onChange={(barcode) => onChange({ ...form, barcode })}
        />
        <TextField
          id="item-alt-barcodes"
          label="Mã vạch phụ"
          required={false}
          value={form.altBarcodes}
          onChange={(altBarcodes) => onChange({ ...form, altBarcodes })}
        />
        <AltUnitsField
          value={form.altUnits}
          onChange={(altUnits) => onChange({ ...form, altUnits })}
        />
        <AttributesField
          value={form.attributes}
          onChange={(attributes) => onChange({ ...form, attributes })}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <TextField
          id="item-depth"
          label="Sâu"
          required={false}
          type="number"
          value={form.depth}
          onChange={(depth) => onChange({ ...form, depth })}
        />
        <TextField
          id="item-width"
          label="Rộng"
          required={false}
          type="number"
          value={form.width}
          onChange={(width) => onChange({ ...form, width })}
        />
        <TextField
          id="item-height"
          label="Cao"
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

      <Button disabled={!canManage || busy} type="submit">
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
          {WAREHOUSE_UNITS.map((unit) => (
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
  function updateRow(index: number, next: AltUnitForm) {
    onChange(value.map((row, rowIndex) => (rowIndex === index ? next : row)));
  }

  return (
    <div className="space-y-2 md:col-span-2">
      <div className="flex items-center justify-between gap-3">
        <Label>Đơn vị phụ</Label>
        <Button
          size="sm"
          type="button"
          variant="outline"
          onClick={() => onChange([...value, { factor: "", unit: "thùng" }])}
        >
          <Plus data-icon="inline-start" />
          Thêm đơn vị
        </Button>
      </div>
      {value.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
          Chưa có đơn vị phụ.
        </div>
      ) : (
        <div className="space-y-2">
          {value.map((row, index) => (
            <div
              className="grid gap-2 rounded-lg border border-border/70 bg-muted/20 p-2 md:grid-cols-[1fr_140px_auto]"
              key={index}
            >
              <UnitSelectField
                label="Đơn vị"
                value={row.unit}
                onChange={(unit) => updateRow(index, { ...row, unit })}
              />
              <TextField
                id={`item-alt-unit-factor-${index}`}
                label="Hệ số"
                required={false}
                type="number"
                value={row.factor}
                onChange={(factor) => updateRow(index, { ...row, factor })}
              />
              <Button
                className="self-end"
                size="icon-sm"
                type="button"
                variant="destructive"
                onClick={() =>
                  onChange(value.filter((_, rowIndex) => rowIndex !== index))
                }
              >
                <Trash2 />
                <span className="sr-only">Xóa đơn vị phụ</span>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AttributesField({
  onChange,
  value,
}: {
  onChange: (value: AttributeForm[]) => void;
  value: AttributeForm[];
}) {
  function updateRow(index: number, next: AttributeForm) {
    onChange(value.map((row, rowIndex) => (rowIndex === index ? next : row)));
  }

  return (
    <div className="space-y-2 md:col-span-2">
      <div className="flex items-center justify-between gap-3">
        <Label>Thuộc tính</Label>
        <Button
          size="sm"
          type="button"
          variant="outline"
          onClick={() => onChange([...value, { code: "", name: "", value: "" }])}
        >
          <Plus data-icon="inline-start" />
          Thêm thuộc tính
        </Button>
      </div>
      {value.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
          Chưa có thuộc tính.
        </div>
      ) : (
        <div className="space-y-2">
          {value.map((row, index) => (
            <div
              className="grid gap-2 rounded-lg border border-border/70 bg-muted/20 p-2 md:grid-cols-[1fr_1fr_120px_auto]"
              key={index}
            >
              <TextField
                id={`item-attribute-name-${index}`}
                label="Tên"
                required={false}
                value={row.name}
                onChange={(name) => updateRow(index, { ...row, name })}
              />
              <TextField
                id={`item-attribute-value-${index}`}
                label="Giá trị"
                required={false}
                value={row.value}
                onChange={(attributeValue) =>
                  updateRow(index, { ...row, value: attributeValue })
                }
              />
              <TextField
                id={`item-attribute-code-${index}`}
                label="Mã"
                required={false}
                value={row.code}
                onChange={(code) => updateRow(index, { ...row, code })}
              />
              <Button
                className="self-end"
                size="icon-sm"
                type="button"
                variant="destructive"
                onClick={() =>
                  onChange(value.filter((_, rowIndex) => rowIndex !== index))
                }
              >
                <Trash2 />
                <span className="sr-only">Xóa thuộc tính</span>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ItemEditDialog({
  busy,
  canManage,
  item,
  onOpenChange,
  onSave,
}: {
  busy: boolean;
  canManage: boolean;
  item: WarehouseItem;
  onOpenChange: (open: boolean) => void;
  onSave: (form: ItemForm) => void;
}) {
  const [form, setForm] = useState(() => itemToForm(item));

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(form);
  }

  return (
    <Dialog
      open
      onOpenChange={onOpenChange}
    >
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

        <ItemFormFields
          busy={busy}
          canManage={canManage}
          form={form}
          skuReadOnly
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
