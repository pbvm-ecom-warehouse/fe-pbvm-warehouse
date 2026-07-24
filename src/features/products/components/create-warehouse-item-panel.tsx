"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQueries, useQuery } from "@tanstack/react-query";
import {
  Check,
  CheckCircle2,
  ChevronsUpDown,
  Copy,
  LoaderCircle,
  PackagePlus,
  Plus,
  Printer,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { EvidenceImagePicker } from "@/components/evidence-images";
import { Barcode } from "@/components/barcode";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebounce } from "@/hooks/use-debounce";
import { getApiErrorCode, getApiErrorMessage } from "@/lib/api-contract";

import {
  CREATABLE_WAREHOUSE_ITEM_TYPES,
  createWarehouseItem,
  getSkuTemplate,
  listAttributeOptions,
  previewWarehouseItemSku,
  type AttributeKey,
  type AttributeOption,
  type CreatableWarehouseItemType,
  type WarehouseItem,
  type WarehouseItemAltUnit,
} from "../services/warehouse-items.service";

const WAREHOUSE_UNITS = ["cái", "thùng", "hộp", "kg", "g", "lít", "ml", "m"];

export const ATTRIBUTE_LABELS: Record<AttributeKey, string> = {
  CAPACITY: "Dung tích",
  COLOR: "Màu sắc",
  COMPATIBILITY: "Kích thước tương thích",
  CUP_STYLE: "Kiểu ly",
  DIAMETER: "Đường kính",
  FLAVOR: "Hương vị",
  LENGTH: "Chiều dài",
  MATERIAL: "Chất liệu",
  MATERIAL_CATEGORY: "Nhóm nguyên liệu",
  MATERIAL_TYPE: "Loại nguyên liệu",
  PACKAGING_CATEGORY: "Nhóm bao bì",
  PACKAGING_STYLE: "Kiểu bao bì",
  SIZE: "Kích thước",
  SPEC: "Quy cách tồn",
};

const TYPE_LABELS: Record<CreatableWarehouseItemType, string> = {
  CUP_BLANK: "Ly chưa in",
  MATERIAL: "Nguyên liệu",
  PACKAGING: "Bao bì",
};

type AltUnitForm = { factor: string; unit: string };
type NumericField =
  | "depth"
  | "height"
  | "minQuantity"
  | "nearExpiryDays"
  | "width";

type CreateForm = {
  type: CreatableWarehouseItemType;
  name: string;
  unit: string;
  categoryOptionId: string;
  selections: Partial<Record<AttributeKey, string>>;
  altUnits: AltUnitForm[];
  isPerishable: boolean;
  depth: string;
  width: string;
  height: string;
  minQuantity: string;
  nearExpiryDays: string;
};

function initialForm(): CreateForm {
  return {
    altUnits: [],
    categoryOptionId: "",
    depth: "",
    height: "",
    isPerishable: false,
    minQuantity: "",
    name: "",
    nearExpiryDays: "",
    selections: {},
    type: "CUP_BLANK",
    unit: "cái",
    width: "",
  };
}

function optionalNumber(value: string) {
  const parsed = Number(value);
  return value.trim() && Number.isFinite(parsed) ? parsed : undefined;
}

function toAltUnits(rows: AltUnitForm[]): WarehouseItemAltUnit[] | undefined {
  const units = rows
    .map((row) => ({ factor: Number(row.factor), unit: row.unit.trim() }))
    .filter((row) => row.unit && Number.isFinite(row.factor) && row.factor > 0);
  return units.length ? units : undefined;
}

function formatError(error: unknown) {
  const code = getApiErrorCode(error);
  const messages: Partial<Record<string, string>> = {
    STOCK_ATTRIBUTE_OPTION_INACTIVE:
      "Một lựa chọn vừa ngưng sử dụng. Hãy chọn lại thuộc tính.",
    STOCK_ATTRIBUTE_OPTION_NOT_FOUND:
      "Không tìm thấy lựa chọn thuộc tính. Hãy tải lại cấu hình.",
    STOCK_ITEM_SKU_CONFLICT:
      "Tổ hợp thuộc tính này đã có mặt hàng. Hãy chọn cấu hình khác.",
    STOCK_SKU_TEMPLATE_MISMATCH:
      "Cấu hình SKU đã thay đổi. Hãy chọn lại loại mặt hàng.",
    STOCK_SKU_TEMPLATE_NOT_FOUND:
      "Chưa có cấu hình SKU phù hợp cho lựa chọn này.",
  };
  return (
    (code && messages[code]) ||
    getApiErrorMessage(error) ||
    "Không kết nối được WMS."
  );
}

export function CreateWarehouseItemPanel({
  canManage,
  layout = "panel",
  onCreated,
}: {
  canManage: boolean;
  layout?: "dialog" | "panel";
  onCreated: (item: WarehouseItem) => void;
}) {
  const [form, setForm] = useState<CreateForm>(initialForm);
  const [images, setImages] = useState<File[]>([]);
  const [createdItem, setCreatedItem] = useState<WarehouseItem | null>(null);

  const rootTemplateQuery = useQuery({
    enabled: canManage && !createdItem,
    queryFn: () => getSkuTemplate(form.type),
    queryKey: ["stock-sku-template", form.type, "root"],
  });

  const rootTemplate = rootTemplateQuery.data;
  const needsCategory = rootTemplate?.kind === "category-options";

  const childTemplateQuery = useQuery({
    enabled:
      canManage &&
      !createdItem &&
      needsCategory &&
      Boolean(form.categoryOptionId),
    queryFn: () => getSkuTemplate(form.type, form.categoryOptionId),
    queryKey: [
      "stock-sku-template",
      form.type,
      "category",
      form.categoryOptionId,
    ],
  });

  const resolvedTemplate =
    rootTemplate?.kind === "template"
      ? rootTemplate
      : childTemplateQuery.data?.kind === "template"
        ? childTemplateQuery.data
        : undefined;
  const templateFields = useMemo(
    () => resolvedTemplate?.fields ?? [],
    [resolvedTemplate],
  );
  const fieldKeys = useMemo(
    () => templateFields.map((field) => field.key),
    [templateFields],
  );
  const requiredFieldKeys = useMemo(
    () =>
      templateFields
        .filter((field) => field.required !== false)
        .map((field) => field.key),
    [templateFields],
  );

  const optionQueries = useQueries({
    queries: fieldKeys.map((key) => ({
      enabled: canManage && !createdItem,
      queryFn: () => listAttributeOptions(key),
      queryKey: ["stock-attribute-options", key, false],
    })),
  });

  const optionsByKey = useMemo(() => {
    const result = new Map<AttributeKey, AttributeOption[]>();
    fieldKeys.forEach((key, index) => {
      result.set(key, optionQueries[index]?.data ?? []);
    });
    return result;
  }, [fieldKeys, optionQueries]);

  const selectedFieldOptionIds = useMemo(
    () =>
      fieldKeys.flatMap((key) => {
        const optionId = form.selections[key];
        return optionId ? [optionId] : [];
      }),
    [fieldKeys, form.selections],
  );
  const selectedOptionIds = useMemo(
    () => [
      ...(needsCategory && form.categoryOptionId
        ? [form.categoryOptionId]
        : []),
      ...selectedFieldOptionIds,
    ],
    [form.categoryOptionId, needsCategory, selectedFieldOptionIds],
  );
  const selectionComplete =
    Boolean(resolvedTemplate) &&
    requiredFieldKeys.length > 0 &&
    requiredFieldKeys.every((key) => Boolean(form.selections[key]));
  const selectedIdsKey = selectedOptionIds.join("|");
  const debouncedIdsKey = useDebounce(selectedIdsKey, 400);

  const localSku = useMemo(() => {
    if (!resolvedTemplate?.prefix || !selectionComplete) return "";
    const codes = fieldKeys.flatMap((key) => {
      const optionId = form.selections[key];
      const code = optionsByKey
        .get(key)
        ?.find((option) => option.id === optionId)?.code;
      return code ? [code] : [];
    });
    return codes.length ? [resolvedTemplate.prefix, ...codes].join("-") : "";
  }, [
    fieldKeys,
    form.selections,
    optionsByKey,
    resolvedTemplate,
    selectionComplete,
  ]);

  const previewQuery = useQuery({
    enabled:
      canManage &&
      !createdItem &&
      selectionComplete &&
      debouncedIdsKey === selectedIdsKey,
    queryFn: () =>
      previewWarehouseItemSku({
        attributeOptionIds: selectedOptionIds,
        templateId: resolvedTemplate!.templateId,
        type: form.type,
      }),
    queryKey: [
      "stock-sku-preview",
      form.type,
      resolvedTemplate?.templateId,
      debouncedIdsKey,
    ],
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createWarehouseItem({
        altUnits: toAltUnits(form.altUnits),
        attributeOptionIds: selectedOptionIds,
        depth: optionalNumber(form.depth),
        height: optionalNumber(form.height),
        images,
        isPerishable: form.isPerishable,
        minQuantity: optionalNumber(form.minQuantity),
        name: form.name.trim(),
        nearExpiryDays: form.isPerishable
          ? optionalNumber(form.nearExpiryDays)
          : undefined,
        templateId: resolvedTemplate!.templateId,
        type: form.type,
        unit: form.unit,
        width: optionalNumber(form.width),
      }),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: (item) => {
      setCreatedItem(item);
      onCreated(item);
      toast.success("Đã tạo mặt hàng");
    },
  });

  const optionsLoading = optionQueries.some((query) => query.isLoading);
  const optionsError = optionQueries.find((query) => query.error)?.error;
  const templateBusy =
    rootTemplateQuery.isLoading || childTemplateQuery.isLoading;
  const currentPreviewReady =
    Boolean(previewQuery.data?.sku) &&
    debouncedIdsKey === selectedIdsKey &&
    !previewQuery.isFetching;
  const canSubmit =
    canManage &&
    form.name.trim().length > 0 &&
    form.unit.length > 0 &&
    selectionComplete &&
    currentPreviewReady &&
    !createMutation.isPending;

  function reset(nextType: CreatableWarehouseItemType = "CUP_BLANK") {
    setForm({ ...initialForm(), type: nextType });
    setImages([]);
    setCreatedItem(null);
    createMutation.reset();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canSubmit) createMutation.mutate();
  }

  if (createdItem) {
    return (
      <section
        className={
          layout === "dialog"
            ? "space-y-5"
            : "space-y-5 rounded-lg border bg-card p-4 shadow-sm"
        }
        aria-labelledby="created-item-title"
      >
        <header>
          <h2 id="created-item-title" className="text-base font-semibold">
            Đã tạo mặt hàng
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            SKU và mã vạch dưới đây do hệ thống cấp chính thức.
          </p>
        </header>
        <CreateResult item={createdItem} onReset={() => reset(form.type)} />
      </section>
    );
  }

  return (
    <section
      className={
        layout === "dialog"
          ? "space-y-5"
          : "rounded-lg border bg-card p-4 shadow-sm"
      }
      aria-label={layout === "dialog" ? "Biểu mẫu tạo mặt hàng" : undefined}
      aria-labelledby={layout === "panel" ? "create-item-title" : undefined}
    >
      {layout === "panel" ? (
        <header className="mb-5">
          <h2 id="create-item-title" className="text-base font-semibold">
            Tạo mặt hàng
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Nhập thông tin mặt hàng và chọn cấu hình để hệ thống cấp SKU.
          </p>
        </header>
      ) : null}
      <form className="space-y-5" onSubmit={handleSubmit}>
        <section
          className="space-y-3"
          aria-labelledby="basic-information-title"
        >
          <h3 id="basic-information-title" className="text-sm font-semibold">
            Thông tin cơ bản
          </h3>
          <div className="grid gap-3 md:grid-cols-3">
            <SelectField
              label="Loại mặt hàng"
              value={form.type}
              onChange={(value) => reset(value as CreatableWarehouseItemType)}
            >
              {CREATABLE_WAREHOUSE_ITEM_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectField>
            <TextField
              id="create-item-name"
              label="Tên nội bộ"
              value={form.name}
              onChange={(name) => setForm((current) => ({ ...current, name }))}
            />
            <SelectField
              label="Đơn vị cơ sở"
              value={form.unit}
              onChange={(unit) => setForm((current) => ({ ...current, unit }))}
            >
              {WAREHOUSE_UNITS.map((unit) => (
                <SelectItem key={unit} value={unit}>
                  {unit}
                </SelectItem>
              ))}
            </SelectField>
          </div>
        </section>

        <section
          className="space-y-3 border-t pt-4"
          aria-labelledby="sku-config-title"
        >
          <div className="flex items-center justify-between gap-3">
            <h3 id="sku-config-title" className="text-sm font-semibold">
              Cấu hình SKU
            </h3>
            {templateBusy ? (
              <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
            ) : null}
          </div>

          {rootTemplateQuery.error ? (
            <InlineError error={rootTemplateQuery.error} />
          ) : null}

          {needsCategory ? (
            <SelectField
              label={ATTRIBUTE_LABELS[rootTemplate.categoryKey]}
              placeholder="Chọn nhóm"
              value={form.categoryOptionId}
              onChange={(categoryOptionId) =>
                setForm((current) => ({
                  ...current,
                  categoryOptionId,
                  selections: {},
                }))
              }
            >
              {rootTemplate.options.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name} ({option.code})
                </SelectItem>
              ))}
            </SelectField>
          ) : null}

          {childTemplateQuery.error ? (
            <InlineError error={childTemplateQuery.error} />
          ) : null}
          {optionsError ? <InlineError error={optionsError} /> : null}

          {resolvedTemplate ? (
            <div className="grid gap-3 md:grid-cols-4">
              {templateFields.map((field) => (
                <AttributeOptionCombobox
                  key={field.key}
                  disabled={optionsLoading}
                  label={ATTRIBUTE_LABELS[field.key]}
                  options={optionsByKey.get(field.key) ?? []}
                  placeholder={optionsLoading ? "Đang tải..." : "Chọn giá trị"}
                  required={field.required !== false}
                  value={form.selections[field.key] ?? ""}
                  onChange={(optionId) =>
                    setForm((current) => ({
                      ...current,
                      selections: {
                        ...current.selections,
                        [field.key]: optionId,
                      },
                    }))
                  }
                />
              ))}
            </div>
          ) : null}

          <div className="rounded-lg border bg-muted/25 p-3" aria-live="polite">
            <div className="text-xs font-medium text-muted-foreground">
              SKU được tạo
            </div>
            <div className="mt-1 flex min-h-7 flex-wrap items-center justify-between gap-2">
              <span className="break-all font-mono text-sm font-semibold">
                {previewQuery.data?.sku || localSku || "Chọn đủ thuộc tính để xem SKU"}
              </span>
              {previewQuery.isFetching ||
              (selectionComplete && debouncedIdsKey !== selectedIdsKey) ? (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <LoaderCircle className="size-3.5 animate-spin" /> Đang kiểm
                  tra
                </span>
              ) : currentPreviewReady ? (
                <span className="flex items-center gap-1 text-xs text-emerald-700">
                  <CheckCircle2 className="size-3.5" /> Đã xác nhận cấu hình
                </span>
              ) : null}
            </div>
            {previewQuery.error ? (
              <div className="mt-2">
                <InlineError error={previewQuery.error} />
              </div>
            ) : null}
          </div>
        </section>

        <section
          className="space-y-3 border-t pt-4"
          aria-labelledby="stock-settings-title"
        >
          <h3 id="stock-settings-title" className="text-sm font-semibold">
            Thiết lập tồn kho
          </h3>
          <div className="grid gap-3 md:grid-cols-4">
            <NumericField
              id="create-min-quantity"
              label="Mức tồn tối thiểu"
              value={form.minQuantity}
              onChange={(value) => updateNumeric(setForm, "minQuantity", value)}
            />
            <NumericField
              id="create-depth"
              label="Chiều sâu"
              value={form.depth}
              onChange={(value) => updateNumeric(setForm, "depth", value)}
            />
            <NumericField
              id="create-width"
              label="Chiều rộng"
              value={form.width}
              onChange={(value) => updateNumeric(setForm, "width", value)}
            />
            <NumericField
              id="create-height"
              label="Chiều cao"
              value={form.height}
              onChange={(value) => updateNumeric(setForm, "height", value)}
            />
          </div>
          <label
            className="flex w-fit items-center gap-2 text-sm font-medium"
            htmlFor="create-perishable"
          >
            <Checkbox
              checked={form.isPerishable}
              id="create-perishable"
              onCheckedChange={(checked) =>
                setForm((current) => ({
                  ...current,
                  isPerishable: checked === true,
                  nearExpiryDays:
                    checked === true ? current.nearExpiryDays : "",
                }))
              }
            />
            Có hạn sử dụng
          </label>
          {form.isPerishable ? (
            <NumericField
              id="create-near-expiry"
              label="Cảnh báo trước hạn (ngày)"
              value={form.nearExpiryDays}
              onChange={(value) =>
                updateNumeric(setForm, "nearExpiryDays", value)
              }
            />
          ) : null}
          <EvidenceImagePicker
            files={images}
            id="create-item-images"
            label="Ảnh mặt hàng"
            onChange={setImages}
          />
          <AltUnitsEditor
            value={form.altUnits}
            onChange={(altUnits) =>
              setForm((current) => ({ ...current, altUnits }))
            }
          />
        </section>

        {createMutation.error ? (
          <InlineError error={createMutation.error} />
        ) : null}

        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
          <Button
            disabled={createMutation.isPending}
            type="button"
            variant="outline"
            onClick={() => reset(form.type)}
          >
            <RotateCcw data-icon="inline-start" />
            Đặt lại
          </Button>
          <Button disabled={!canSubmit} type="submit">
            {createMutation.isPending ? (
              <LoaderCircle className="animate-spin" data-icon="inline-start" />
            ) : (
              <PackagePlus data-icon="inline-start" />
            )}
            Tạo mặt hàng
          </Button>
        </div>
      </form>
    </section>
  );
}

function updateNumeric(
  setForm: React.Dispatch<React.SetStateAction<CreateForm>>,
  field: NumericField,
  value: string,
) {
  setForm((current) => ({ ...current, [field]: value }));
}

function CreateResult({
  item,
  onReset,
}: {
  item: WarehouseItem;
  onReset: () => void;
}) {
  async function copy(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    toast.success(`Đã sao chép ${label}`);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-lg border bg-muted/25 p-4">
        <ResultRow label="Tên mặt hàng" value={item.name} />
        <ResultRow
          label="SKU"
          value={item.sku}
          action={
            <Button
              aria-label="Sao chép SKU"
              size="icon-sm"
              type="button"
              variant="ghost"
              onClick={() => void copy(item.sku, "SKU")}
            >
              <Copy />
            </Button>
          }
        />
        <div className="grid gap-2 sm:grid-cols-[160px_1fr_auto] sm:items-center">
          <span className="text-sm text-muted-foreground">Mã vạch nội bộ</span>
          {item.barcode ? (
            <Barcode value={item.barcode} />
          ) : (
            <span className="text-sm font-semibold">Chưa được cấp</span>
          )}
          {item.barcode ? (
            <Button
              aria-label="Sao chép mã vạch"
              size="icon-sm"
              type="button"
              variant="ghost"
              onClick={() => void copy(item.barcode!, "mã vạch")}
            >
              <Copy />
            </Button>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={onReset}>
          <RotateCcw data-icon="inline-start" /> Tạo mặt hàng tiếp
        </Button>
        <Button
          disabled
          title="Chưa có chức năng in tem"
          type="button"
          variant="outline"
        >
          <Printer data-icon="inline-start" /> In tem
        </Button>
      </div>
    </div>
  );
}

function ResultRow({
  action,
  label,
  value,
}: {
  action?: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="grid gap-1 sm:grid-cols-[160px_1fr_auto] sm:items-center">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="break-all font-mono text-sm font-semibold">{value}</span>
      {action}
    </div>
  );
}

function AttributeOptionCombobox({
  disabled,
  label,
  onChange,
  options,
  placeholder = "Chọn giá trị",
  required = false,
  value,
}: {
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  options: AttributeOption[];
  placeholder?: string;
  required?: boolean;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((option) => option.id === value);

  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            aria-label={label}
            className="w-full justify-between font-normal"
            disabled={disabled}
            role="combobox"
            type="button"
            variant="outline"
          >
            <span className={selectedOption ? "truncate" : "text-muted-foreground"}>
              {selectedOption
                ? `${selectedOption.name} (${selectedOption.code})`
                : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-1">
          <Command>
            <CommandInput autoFocus placeholder="Tìm tên hoặc mã SKU" />
            <CommandList>
              <CommandEmpty>Không tìm thấy giá trị phù hợp.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.id}
                    value={`${option.name} ${option.code}`}
                    onSelect={() => {
                      onChange(option.id);
                      setOpen(false);
                    }}
                  >
                    <span>{option.name} ({option.code})</span>
                    {value === option.id ? <Check className="ml-auto" /> : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
function SelectField({
  children,
  disabled,
  label,
  onChange,
  placeholder,
  value,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select disabled={disabled} value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label} className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  );
}

function TextField({
  id,
  label,
  onChange,
  value,
}: {
  id: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function NumericField({
  id,
  label,
  onChange,
  value,
}: {
  id: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="max-w-xs space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        min="0"
        step="any"
        type="number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function AltUnitsEditor({
  onChange,
  value,
}: {
  onChange: (value: AltUnitForm[]) => void;
  value: AltUnitForm[];
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label>Đơn vị phụ</Label>
        <Button
          size="sm"
          type="button"
          variant="outline"
          onClick={() => onChange([...value, { factor: "", unit: "thùng" }])}
        >
          <Plus data-icon="inline-start" /> Thêm đơn vị
        </Button>
      </div>
      {value.map((row, index) => (
        <div className="grid gap-2 md:grid-cols-[1fr_160px_auto]" key={index}>
          <SelectField
            label="Đơn vị"
            value={row.unit}
            onChange={(unit) =>
              onChange(
                value.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, unit } : item,
                ),
              )
            }
          >
            {WAREHOUSE_UNITS.map((unit) => (
              <SelectItem key={unit} value={unit}>
                {unit}
              </SelectItem>
            ))}
          </SelectField>
          <NumericField
            id={`create-alt-factor-${index}`}
            label="Hệ số quy đổi"
            value={row.factor}
            onChange={(factor) =>
              onChange(
                value.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, factor } : item,
                ),
              )
            }
          />
          <Button
            aria-label="Xóa đơn vị phụ"
            className="self-end"
            size="icon-sm"
            type="button"
            variant="destructive"
            onClick={() =>
              onChange(value.filter((_, itemIndex) => itemIndex !== index))
            }
          >
            <Trash2 />
          </Button>
        </div>
      ))}
    </div>
  );
}

function InlineError({ error }: { error: unknown }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
    >
      {formatError(error)}
    </div>
  );
}
