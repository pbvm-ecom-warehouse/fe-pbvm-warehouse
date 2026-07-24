"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Plus, Save, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getApiErrorMessage } from "@/lib/api-contract";

import {
  ATTRIBUTE_LABELS,
  filterAttributeOptions,
  type AttributeOptionStatus,
} from "../lib/attribute-option-filter";
import {
  CREATABLE_WAREHOUSE_ITEM_TYPES,
  createAttributeOption,
  getSkuTemplate,
  listAttributeOptions,
  suggestAttributeOptionCode,
  updateAttributeOption,
  type AttributeKey,
  type AttributeOption,
  type CreatableWarehouseItemType,
} from "../services/warehouse-items.service";

type OptionDraft = Pick<AttributeOption, "name" | "isActive" | "sortOrder">;

const ITEM_TYPE_ATTRIBUTE_KEYS: Record<
  CreatableWarehouseItemType,
  AttributeKey[]
> = {
  CUP_BLANK: ["CUP_STYLE", "MATERIAL", "CAPACITY", "COLOR"],
  MATERIAL: ["MATERIAL_CATEGORY", "MATERIAL_TYPE", "FLAVOR", "SPEC"],
  PACKAGING: [
    "PACKAGING_CATEGORY",
    "PACKAGING_STYLE",
    "COMPATIBILITY",
    "DIAMETER",
    "LENGTH",
    "SIZE",
    "MATERIAL",
    "COLOR",
  ],
};

const CATEGORY_KEYS: Set<AttributeKey> = new Set([
  "MATERIAL_CATEGORY",
  "PACKAGING_CATEGORY",
]);

function formatError(error: unknown) {
  return getApiErrorMessage(error) ?? "Không kết nối được WMS.";
}

export function AttributeOptionsAdminPanel() {
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] =
    useState<CreatableWarehouseItemType>("CUP_BLANK");
  const [selectedKey, setSelectedKey] = useState<AttributeKey | "">("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AttributeOptionStatus>("ALL");
  const [drafts, setDrafts] = useState<Record<string, OptionDraft>>({});

  const rootQueries = useQueries({
    queries: CREATABLE_WAREHOUSE_ITEM_TYPES.map((type) => ({
      queryFn: () => getSkuTemplate(type),
      queryKey: ["stock-sku-template", type, "root"],
    })),
  });

  const categoryLookups = useMemo(
    () =>
      rootQueries.flatMap((query, index) => {
        const root = query.data;
        if (root?.kind !== "category-options") return [];
        return root.options.map((option) => ({
          categoryOptionId: option.id,
          type: CREATABLE_WAREHOUSE_ITEM_TYPES[index],
        }));
      }),
    [rootQueries],
  );

  const childQueries = useQueries({
    queries: categoryLookups.map((lookup) => ({
      queryFn: () => getSkuTemplate(lookup.type, lookup.categoryOptionId),
      queryKey: [
        "stock-sku-template",
        lookup.type,
        "category",
        lookup.categoryOptionId,
      ],
    })),
  });

  const keysByType = useMemo(() => {
    const result = new Map<CreatableWarehouseItemType, Set<AttributeKey>>();
    CREATABLE_WAREHOUSE_ITEM_TYPES.forEach((type) => {
      result.set(type, new Set<AttributeKey>(ITEM_TYPE_ATTRIBUTE_KEYS[type]));
    });
    rootQueries.forEach((query, index) => {
      const type = CREATABLE_WAREHOUSE_ITEM_TYPES[index];
      const keys = result.get(type)!;
      if (query.data?.kind === "category-options") {
        keys.add(query.data.categoryKey);
      } else if (query.data?.kind === "template") {
        query.data.fields.forEach((field) => keys.add(field.key));
      }
    });
    childQueries.forEach((query, index) => {
      const lookup = categoryLookups[index];
      if (query.data?.kind === "template") {
        const keys = result.get(lookup.type)!;
        query.data.fields.forEach((field) => keys.add(field.key));
      }
    });

    return result;
  }, [categoryLookups, childQueries, rootQueries]);

  const availableKeys = useMemo(
    () =>
      Array.from(keysByType.get(selectedType) ?? []).sort((left, right) =>
        ATTRIBUTE_LABELS[left].localeCompare(ATTRIBUTE_LABELS[right], "vi"),
      ),
    [keysByType, selectedType],
  );
  const allAvailableKeys = useMemo(() => {
    const keys = new Set<AttributeKey>();
    keysByType.forEach((typeKeys) => {
      typeKeys.forEach((key) => keys.add(key));
    });
    return Array.from(keys).sort((left, right) =>
      ATTRIBUTE_LABELS[left].localeCompare(ATTRIBUTE_LABELS[right], "vi"),
    );
  }, [keysByType]);

  const effectiveSelectedKey =
    selectedKey && availableKeys.includes(selectedKey)
      ? selectedKey
      : availableKeys[0] || "";
  const optionQueries = useQueries({
    queries: allAvailableKeys.map((key) => ({
      queryFn: () => listAttributeOptions(key, true),
      queryKey: ["stock-attribute-options", key, true],
    })),
  });
  const allOptions = useMemo(
    () => optionQueries.flatMap((query) => query.data ?? []),
    [optionQueries],
  );
  const filteredOptions = useMemo(
    () => filterAttributeOptions(allOptions, search, status),
    [allOptions, search, status],
  );

  const metadataLoading =
    rootQueries.some((query) => query.isLoading) ||
    childQueries.some((query) => query.isLoading);
  const optionsLoading = optionQueries.some((query) => query.isLoading);
  const optionsError = optionQueries.find((query) => query.error)?.error;

  const suggestMutation = useMutation({
    mutationFn: () =>
      suggestAttributeOptionCode({
        key: effectiveSelectedKey as AttributeKey,
        name: name.trim(),
      }),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: (result) => setCode(result.code),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createAttributeOption({
        code: code.trim().toUpperCase(),
        key: effectiveSelectedKey as AttributeKey,
        name: name.trim(),
      }),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: async () => {
      setCode("");
      setName("");

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["stock-attribute-options"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["stock-sku-template"],
        }),
      ]);
      toast.success("Đã thêm giá trị thuộc tính");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: OptionDraft }) =>
      updateAttributeOption(id, input),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: async (_, variables) => {
      setDrafts((current) => {
        const next = { ...current };
        delete next[variables.id];
        return next;
      });
      await queryClient.invalidateQueries({
        queryKey: ["stock-attribute-options"],
      });
      toast.success("Đã cập nhật giá trị thuộc tính");
    },
  });

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (effectiveSelectedKey && name.trim() && code.trim()) {
      createMutation.mutate();
    }
  }

  const itemTypeField = (
    <div className="space-y-2">
      <Label htmlFor="attribute-item-type">Loại mặt hàng</Label>
      <Select
        value={selectedType}
        onValueChange={(value) => {
          setSelectedType(value as CreatableWarehouseItemType);
          setSelectedKey("");
          setCode("");
          setName("");
        }}
      >
        <SelectTrigger
          id="attribute-item-type"
          aria-label="Loại mặt hàng"
          className="w-full"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="CUP_BLANK">Ly chưa in</SelectItem>
          <SelectItem value="MATERIAL">Nguyên liệu</SelectItem>
          <SelectItem value="PACKAGING">Bao bì</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  const attributeGroupField = (
    <div className="space-y-2">
      <Label htmlFor="attribute-group">Nhóm thuộc tính</Label>
      <Select
        value={effectiveSelectedKey}
        onValueChange={(value) => {
          setSelectedKey(value as AttributeKey);
          setCode("");
          setName("");
        }}
      >
        <SelectTrigger
          id="attribute-group"
          aria-label="Nhóm thuộc tính"
          className="w-full"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {availableKeys.map((key) => (
            <SelectItem key={key} value={key}>
              {ATTRIBUTE_LABELS[key]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <section
      className="rounded-lg border bg-card p-4 shadow-sm"
      aria-labelledby="sku-option-title"
    >
      <header className="mb-5">
        <h2 id="sku-option-title" className="text-base font-semibold">
          Giá trị thuộc tính SKU
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Quản lý tên, mã ghép SKU và trạng thái sử dụng.
        </p>
      </header>

      {metadataLoading ? (
        <div className="flex min-h-32 items-center justify-center text-muted-foreground">
          <LoaderCircle className="mr-2 size-4 animate-spin" /> Đang tải cấu
          hình
        </div>
      ) : (
        <div className="space-y-5">
          <form
            className="grid gap-3 border-y py-4 md:grid-cols-2 xl:grid-cols-[minmax(130px,0.7fr)_minmax(145px,0.8fr)_minmax(180px,1.4fr)_minmax(160px,0.9fr)_auto]"
            onSubmit={handleCreate}
          >
            {itemTypeField}
            {attributeGroupField}
            {CATEGORY_KEYS.has(effectiveSelectedKey as AttributeKey) ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-900 md:col-span-3 xl:col-span-3">
                <div>
                  <span className="font-semibold">Danh mục hệ thống:</span> Danh
                  mục (Category) được quản lý theo cấu hình registry template
                  của BE. Không thể thêm danh mục mới từ giao diện.
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="attribute-option-name">Tên giá trị</Label>
                  <Input
                    id="attribute-option-name"
                    value={name}
                    onBlur={() => {
                      if (
                        name.trim() &&
                        !code.trim() &&
                        !suggestMutation.isPending
                      ) {
                        suggestMutation.mutate();
                      }
                    }}
                    onChange={(event) => {
                      setName(event.target.value);
                      setCode("");
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="attribute-option-code">Mã SKU</Label>
                  <div className="flex gap-2">
                    <Input
                      id="attribute-option-code"
                      className="font-mono uppercase"
                      maxLength={6}
                      value={code}
                      onChange={(event) =>
                        setCode(event.target.value.toUpperCase())
                      }
                    />
                    <Button
                      aria-label="Gợi ý mã SKU"
                      disabled={!name.trim() || suggestMutation.isPending}
                      size="icon"
                      type="button"
                      variant="outline"
                      onClick={() => suggestMutation.mutate()}
                    >
                      {suggestMutation.isPending ? (
                        <LoaderCircle className="animate-spin" />
                      ) : (
                        <Sparkles />
                      )}
                    </Button>
                  </div>
                </div>
                <Button
                  className="self-end"
                  disabled={
                    !name.trim() || !code.trim() || createMutation.isPending
                  }
                  type="submit"
                >
                  {createMutation.isPending ? (
                    <LoaderCircle
                      className="animate-spin"
                      data-icon="inline-start"
                    />
                  ) : (
                    <Plus data-icon="inline-start" />
                  )}
                  Thêm giá trị
                </Button>
              </>
            )}
          </form>

          <div className="grid gap-3 md:grid-cols-[minmax(280px,1fr)_220px]">
            <div className="space-y-2">
              <Label htmlFor="attribute-option-search">Tìm kiếm</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="attribute-option-search"
                  className="pl-9"
                  placeholder="Tên, mã SKU hoặc nhóm thuộc tính"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="attribute-option-status">Trạng thái</Label>
              <Select
                value={status}
                onValueChange={(value) =>
                  setStatus(value as AttributeOptionStatus)
                }
              >
                <SelectTrigger id="attribute-option-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tất cả</SelectItem>
                  <SelectItem value="ACTIVE">Đang dùng</SelectItem>
                  <SelectItem value="INACTIVE">Ngừng dùng</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {optionsError ? (
            <div
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
            >
              {formatError(optionsError)}
            </div>
          ) : optionsLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Đang tải danh sách...
            </div>
          ) : filteredOptions.length ? (
            <Table scrollable aria-label="Danh sách giá trị thuộc tính SKU">
              <TableHeader>
                <TableRow>
                  <TableHead>Nhóm</TableHead>
                  <TableHead>Tên</TableHead>
                  <TableHead>Mã SKU</TableHead>
                  <TableHead>Thứ tự</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOptions.map((option) => {
                  const draft = drafts[option.id] ?? option;
                  return (
                    <TableRow key={option.id}>
                      <TableCell className="font-medium">
                        {ATTRIBUTE_LABELS[option.key]}
                      </TableCell>
                      <TableCell className="min-w-64">
                        <Input
                          aria-label={`Tên ${option.name}`}
                          value={draft.name}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [option.id]: {
                                ...draft,
                                name: event.target.value,
                              },
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <span className="font-mono font-semibold">
                          {option.code}
                        </span>
                      </TableCell>
                      <TableCell className="w-28">
                        <Input
                          aria-label={`Thứ tự ${option.name}`}
                          min="0"
                          type="number"
                          value={draft.sortOrder}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [option.id]: {
                                ...draft,
                                sortOrder: Number(event.target.value),
                              },
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={draft.isActive}
                            aria-label={`Trạng thái ${option.name}`}
                            onCheckedChange={(isActive) =>
                              setDrafts((current) => ({
                                ...current,
                                [option.id]: { ...draft, isActive },
                              }))
                            }
                          />
                          <span>
                            {draft.isActive ? "Đang dùng" : "Ngừng dùng"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          aria-label={`Lưu ${option.name}`}
                          disabled={
                            updateMutation.isPending || !draft.name.trim()
                          }
                          size="icon-sm"
                          type="button"
                          onClick={() =>
                            updateMutation.mutate({
                              id: option.id,
                              input: draft,
                            })
                          }
                        >
                          {updateMutation.isPending ? (
                            <LoaderCircle className="animate-spin" />
                          ) : (
                            <Save />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
              Không có giá trị phù hợp.
            </div>
          )}
        </div>
      )}
    </section>
  );
}
