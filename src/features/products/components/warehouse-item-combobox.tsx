"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, LoaderCircle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import {
  getWarehouseItem,
  listWarehouseItems,
  type WarehouseItem,
} from "@/features/products/services/warehouse-items.service";

function useDebouncedValue(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timeout);
  }, [delay, value]);

  return debouncedValue;
}

export function WarehouseItemCombobox({
  disabled = false,
  id,
  label,
  onSelect,
  placeholder = "Chọn mặt hàng",
  selectedItemId,
  selectedSku = "",
}: {
  disabled?: boolean;
  id: string;
  label: string;
  onSelect: (item: WarehouseItem) => void;
  placeholder?: string;
  selectedItemId: string;
  selectedSku?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const itemsQuery = useQuery({
    enabled: open,
    queryFn: () =>
      listWarehouseItems({
        isActive: true,
        limit: 100,
        page: 1,
        search: debouncedSearch,
      }),
    queryKey: ["warehouse-items", "combobox", debouncedSearch],
  });
  const selectedItemQuery = useQuery({
    enabled: Boolean(selectedItemId),
    queryFn: () => getWarehouseItem(selectedItemId),
    queryKey: ["stock-items", "detail", selectedItemId],
  });
  const items = itemsQuery.data?.data ?? [];
  const selectedItem =
    items.find((item) => item.id === selectedItemId) ?? selectedItemQuery.data;

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          aria-expanded={open}
          aria-label={label}
          className="w-full justify-between bg-background font-normal"
          disabled={disabled}
          id={id}
          role="combobox"
          type="button"
          variant="outline"
        >
          <span className="min-w-0 truncate text-left">
            {selectedItem
              ? `${selectedItem.sku} - ${selectedItem.name}`
              : selectedSku || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={12}
        side="bottom"
        className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Tìm SKU hoặc tên mặt hàng"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-64 overflow-y-auto">
            {itemsQuery.isFetching ? (
              <div
                className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground"
                role="status"
              >
                <LoaderCircle className="size-4 animate-spin" />
                Đang tìm mặt hàng...
              </div>
            ) : null}
            {itemsQuery.error ? (
              <div className="space-y-2 px-3 py-4 text-sm text-destructive">
                Không tải được danh sách mặt hàng.
                <Button
                  className="mt-2"
                  onClick={() => void itemsQuery.refetch()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <RefreshCw data-icon="inline-start" />
                  Thử lại
                </Button>
              </div>
            ) : null}
            {!itemsQuery.isFetching && !itemsQuery.error ? (
              <CommandEmpty>Không có mặt hàng phù hợp.</CommandEmpty>
            ) : null}
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.id}
                  onSelect={() => {
                    onSelect(item);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Check
                    className={cn(
                      "size-4",
                      selectedItemId === item.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-mono font-medium">{item.sku}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      - {item.name}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {item.unit}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
