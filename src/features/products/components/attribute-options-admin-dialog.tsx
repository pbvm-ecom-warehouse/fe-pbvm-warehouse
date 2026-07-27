"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Plus, Save, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  PACKAGING: ["PACKAGING_CATEGORY", "SIZE", "COLOR"],
};

function formatError(error: unknown) {
  return getApiErrorMessage(error) ?? "Không kết nối được WMS.";
}

export function AttributeOptionsAdminPanel() {
  const queryClient = useQueryClient();
  const [filterType, setFilterType] =
    useState<CreatableWarehouseItemType>("CUP_BLANK");
  const [filterKey, setFilterKey] = useState<AttributeKey | "">("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AttributeOptionStatus>("ALL");
  const [drafts, setDrafts] = useState<Record<string, OptionDraft>>({});
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createType, setCreateType] =
    useState<CreatableWarehouseItemType>("CUP_BLANK");
  const [createKey, setCreateKey] = useState<AttributeKey | "">("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const filterTemplateQuery = useQuery({
    queryFn: () => getSkuTemplate(filterType),
    queryKey: ["stock-sku-template", "attribute-admin", filterType],
    staleTime: 60_000,
  });

  const availableFilterKeys = useMemo(() => {
    if (filterTemplateQuery.data?.kind === "template") {
      return Array.from(
        new Set(filterTemplateQuery.data.fields.map((field) => field.key)),
      );
    }

    return [...ITEM_TYPE_ATTRIBUTE_KEYS[filterType]].sort((left, right) =>
      ATTRIBUTE_LABELS[left].localeCompare(ATTRIBUTE_LABELS[right], "vi"),
    );
  }, [filterType, filterTemplateQuery.data]);

  const effectiveFilterKey =
    filterKey && availableFilterKeys.includes(filterKey)
      ? filterKey
      : availableFilterKeys[0] || "";
  const optionQuery = useQuery({
    enabled: Boolean(effectiveFilterKey),
    queryFn: () =>
      listAttributeOptions(effectiveFilterKey as AttributeKey, true),
    queryKey: ["stock-attribute-options", effectiveFilterKey, true],
  });
  const filteredOptions = useMemo(
    () => filterAttributeOptions(optionQuery.data ?? [], search, status),
    [optionQuery.data, search, status],
  );

  const metadataLoading =
    filterTemplateQuery.isLoading && !filterTemplateQuery.data;
  const optionsLoading = optionQuery.isLoading;
  const optionsError = optionQuery.error;

  const createTemplateQuery = useQuery({
    queryFn: () => getSkuTemplate(createType),
    queryKey: ["stock-sku-template", "attribute-admin", createType],
    staleTime: 60_000,
  });

  const availableCreateKeys = useMemo(() => {
    if (createTemplateQuery.data?.kind === "template") {
      return Array.from(
        new Set(createTemplateQuery.data.fields.map((field) => field.key)),
      );
    }

    return [...ITEM_TYPE_ATTRIBUTE_KEYS[createType]].sort((left, right) =>
      ATTRIBUTE_LABELS[left].localeCompare(ATTRIBUTE_LABELS[right], "vi"),
    );
  }, [createType, createTemplateQuery.data]);

  const effectiveCreateKey =
    createKey && availableCreateKeys.includes(createKey)
      ? createKey
      : availableCreateKeys[0] || "";

  const suggestMutation = useMutation({
    mutationFn: () =>
      suggestAttributeOptionCode({
        key: effectiveCreateKey as AttributeKey,
        name: name.trim(),
      }),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: (result) => setCode(result.code),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createAttributeOption({
        code: code.trim().toUpperCase(),
        key: effectiveCreateKey as AttributeKey,
        name: name.trim(),
      }),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: async () => {
      setCode("");
      setName("");
      setCreateDialogOpen(false);

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
    if (effectiveCreateKey && name.trim() && code.trim()) {
      createMutation.mutate();
    }
  }

  const filterItemTypeField = (
    <div className="space-y-2">
      <Label htmlFor="attribute-filter-item-type">Loại mặt hàng</Label>
      <Select
        value={filterType}
        onValueChange={(value) => {
          setFilterType(value as CreatableWarehouseItemType);
          setFilterKey("");
        }}
      >
        <SelectTrigger
          id="attribute-filter-item-type"
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

  const filterGroupField = (
    <div className="space-y-2">
      <Label htmlFor="attribute-filter-group">Nhóm thuộc tính</Label>
      <Select
        value={effectiveFilterKey}
        onValueChange={(value) => setFilterKey(value as AttributeKey)}
      >
        <SelectTrigger
          id="attribute-filter-group"
          aria-label="Nhóm thuộc tính"
          className="w-full"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {availableFilterKeys.map((key) => (
            <SelectItem key={key} value={key}>
              {ATTRIBUTE_LABELS[key]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const createItemTypeField = (
    <div className="space-y-2">
      <Label htmlFor="attribute-create-item-type">Loại mặt hàng</Label>
      <Select
        value={createType}
        onValueChange={(value) => {
          setCreateType(value as CreatableWarehouseItemType);
          setCreateKey("");
          setCode("");
          setName("");
        }}
      >
        <SelectTrigger
          id="attribute-create-item-type"
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

  const createGroupField = (
    <div className="space-y-2">
      <Label htmlFor="attribute-create-group">Nhóm thuộc tính</Label>
      <Select
        value={effectiveCreateKey}
        onValueChange={(value) => {
          setCreateKey(value as AttributeKey);
          setCode("");
          setName("");
        }}
      >
        <SelectTrigger
          id="attribute-create-group"
          aria-label="Nhóm thuộc tính"
          className="w-full"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {availableCreateKeys.map((key) => (
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
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 id="sku-option-title" className="text-base font-semibold">
            Giá trị thuộc tính SKU
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Quản lý tên, mã ghép SKU và trạng thái sử dụng.
          </p>
        </div>

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button
              type="button"
              onClick={() => {
                setCreateType(filterType);
                setCreateKey(effectiveFilterKey);
                setName("");
                setCode("");
              }}
            >
              <Plus data-icon="inline-start" />
              Tạo giá trị thuộc tính
            </Button>
          </DialogTrigger>
          <DialogContent size="lg">
            <DialogHeader>
              <DialogTitle>Tạo giá trị thuộc tính SKU</DialogTitle>
              <DialogDescription>
                Chọn loại mặt hàng và nhóm thuộc tính, sau đó đặt tên và mã
                ghép SKU.
              </DialogDescription>
            </DialogHeader>
            <form className="space-y-4" onSubmit={handleCreate}>
              <div className="grid gap-3 sm:grid-cols-2">
                {createItemTypeField}
                {createGroupField}
              </div>
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
                className="w-full"
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
            </form>
          </DialogContent>
        </Dialog>
      </header>

      {metadataLoading ? (
        <div className="flex min-h-32 items-center justify-center text-muted-foreground">
          <LoaderCircle className="mr-2 size-4 animate-spin" /> Đang tải cấu
          hình
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[220px_220px_minmax(220px,1fr)_180px]">
            {filterItemTypeField}
            {filterGroupField}
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
