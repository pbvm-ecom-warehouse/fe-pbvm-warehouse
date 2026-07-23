"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { LoaderCircle, Plus, Save, Sparkles } from "lucide-react";
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
import { getApiErrorMessage } from "@/lib/api-contract";

import { ATTRIBUTE_LABELS } from "./create-warehouse-item-panel";
import {
  CREATABLE_WAREHOUSE_ITEM_TYPES,
  createAttributeOption,
  getSkuTemplate,
  listAttributeOptions,
  suggestAttributeOptionCode,
  updateAttributeOption,
  type AttributeKey,
  type AttributeOption,
} from "../services/warehouse-items.service";

type OptionDraft = Pick<AttributeOption, "name" | "isActive" | "sortOrder">;

function formatError(error: unknown) {
  return getApiErrorMessage(error) ?? "Không kết nối được WMS.";
}

export function AttributeOptionsAdminPanel() {
  const queryClient = useQueryClient();
  const [selectedKey, setSelectedKey] = useState<AttributeKey | "">("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
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

  const availableKeys = useMemo(() => {
    const keys = new Set<AttributeKey>();
    rootQueries.forEach((query) => {
      if (query.data?.kind === "category-options") {
        keys.add(query.data.categoryKey);
      } else if (query.data?.kind === "template") {
        query.data.fields.forEach((field) => keys.add(field.key));
      }
    });
    childQueries.forEach((query) => {
      if (query.data?.kind === "template") {
        query.data.fields.forEach((field) => keys.add(field.key));
      }
    });
    return Array.from(keys).sort((left, right) =>
      ATTRIBUTE_LABELS[left].localeCompare(ATTRIBUTE_LABELS[right], "vi"),
    );
  }, [childQueries, rootQueries]);

  const effectiveSelectedKey = selectedKey || availableKeys[0] || "";
  const optionsQuery = useQuery({
    enabled: Boolean(effectiveSelectedKey),
    queryFn: () =>
      listAttributeOptions(effectiveSelectedKey as AttributeKey, true),
    queryKey: ["stock-attribute-options", effectiveSelectedKey, true],
  });

  const isCategory = effectiveSelectedKey.endsWith("_CATEGORY");
  const metadataLoading =
    rootQueries.some((query) => query.isLoading) ||
    childQueries.some((query) => query.isLoading);

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
      await queryClient.invalidateQueries({
        queryKey: ["stock-attribute-options", effectiveSelectedKey],
      });
      toast.success("Đã thêm giá trị thuộc tính");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: OptionDraft }) =>
      updateAttributeOption(id, input),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["stock-attribute-options", effectiveSelectedKey],
      });
      toast.success("Đã cập nhật giá trị thuộc tính");
    },
  });

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isCategory && effectiveSelectedKey && name.trim() && code.trim()) {
      createMutation.mutate();
    }
  }

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
          <div className="max-w-sm space-y-2">
            <Label>Nhóm thuộc tính</Label>
            <Select
              value={effectiveSelectedKey}
              onValueChange={(value) => {
                setSelectedKey(value as AttributeKey);
                setCode("");
                setDrafts({});
                setName("");
              }}
            >
              <SelectTrigger aria-label="Nhóm thuộc tính" className="w-full">
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

          {!isCategory ? (
            <form
              className="grid gap-3 border-y py-4 md:grid-cols-[1fr_180px_auto]"
              onSubmit={handleCreate}
            >
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
            </form>
          ) : (
            <div className="border-y py-3 text-sm text-muted-foreground">
              Nhóm này đi cùng cấu hình SKU của hệ thống nên không thể thêm giá
              trị tại đây.
            </div>
          )}

          {optionsQuery.error ? (
            <div
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
            >
              {formatError(optionsQuery.error)}
            </div>
          ) : optionsQuery.isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Đang tải danh sách...
            </div>
          ) : optionsQuery.data?.length ? (
            <div className="space-y-2">
              {optionsQuery.data.map((option) => {
                const draft = drafts[option.id] ?? option;
                return (
                  <div
                    className="grid gap-3 rounded-lg border p-3 md:grid-cols-[1fr_130px_110px_90px_auto] md:items-end"
                    key={option.id}
                  >
                    <div className="space-y-2">
                      <Label htmlFor={`option-name-${option.id}`}>Tên</Label>
                      <Input
                        id={`option-name-${option.id}`}
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
                    </div>
                    <div className="space-y-2">
                      <Label>Mã SKU</Label>
                      <Input
                        className="font-mono"
                        readOnly
                        value={option.code}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`option-order-${option.id}`}>
                        Thứ tự
                      </Label>
                      <Input
                        id={`option-order-${option.id}`}
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
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`option-active-${option.id}`}>
                        Đang dùng
                      </Label>
                      <div className="flex h-8 items-center">
                        <Switch
                          checked={draft.isActive}
                          id={`option-active-${option.id}`}
                          onCheckedChange={(isActive) =>
                            setDrafts((current) => ({
                              ...current,
                              [option.id]: { ...draft, isActive },
                            }))
                          }
                        />
                      </div>
                    </div>
                    <Button
                      aria-label={`Lưu ${option.name}`}
                      disabled={updateMutation.isPending || !draft.name.trim()}
                      size="icon-sm"
                      type="button"
                      onClick={() =>
                        updateMutation.mutate({ id: option.id, input: draft })
                      }
                    >
                      {updateMutation.isPending ? (
                        <LoaderCircle className="animate-spin" />
                      ) : (
                        <Save />
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
              Chưa có giá trị thuộc tính.
            </div>
          )}
        </div>
      )}
    </section>
  );
}
