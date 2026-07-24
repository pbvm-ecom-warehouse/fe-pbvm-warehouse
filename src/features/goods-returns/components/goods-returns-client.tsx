"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ClipboardCheck,
  Eye,
  LoaderCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import {
  EvidenceImageGallery,
  EvidenceImagePicker,
} from "@/components/evidence-images";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import {
  PageHeader,
  PermissionNotice,
  StatusBadge,
  TablePanel,
  TableSkeleton,
} from "@/features/admin-shell/components/operations-ui";
import {
  listWarehouseItems,
  type WarehouseItem,
} from "@/features/products/services/warehouse-items.service";
import { useSessionUser } from "@/hooks/use-session-user";
import { getApiErrorMessage } from "@/lib/api-contract";
import { hasAnyRole } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { statusLabel, statusTone } from "@/lib/wms-ui-labels";

import {
  cancelGoodsReturn,
  confirmGoodsReturn,
  createGoodsReturn,
  GOODS_RETURN_ITEM_CONDITIONS,
  GOODS_RETURN_STATUSES,
  getGoodsReturn,
  inspectGoodsReturn,
  listGoodsReturns,
  type GoodsReturn,
  type GoodsReturnItem,
  type GoodsReturnItemCondition,
  type GoodsReturnStatus,
  type InspectGoodsReturnItemInput,
} from "../services/goods-return.service";

const PAGE_SIZE = 20;

const goodsReturnKeys = {
  detail: (goodsReturnId: string) =>
    ["goods-returns", "detail", goodsReturnId] as const,
  list: (params: {
    orderId: string;
    page: number;
    status: GoodsReturnStatus | "ALL";
  }) => ["goods-returns", "list", params] as const,
};

const defaultCreateForm = {
  itemId: "",
  note: "",
  orderId: "",
  quantity: "1",
};

type InspectLineForm = {
  condition: GoodsReturnItemCondition;
  lotId: string;
  shelfId: string;
};

function formatError(error: unknown) {
  return getApiErrorMessage(error) ?? "Không kết nối được WMS.";
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function parsePositiveInteger(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function formatDate(value: string | undefined) {
  if (!value) return "Chưa có";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("vi-VN").format(date);
}

function toInspectForm(items: GoodsReturnItem[]) {
  return items.reduce<Record<string, InspectLineForm>>((acc, item) => {
    acc[item.itemId] = {
      condition: item.condition ?? "GOOD",
      lotId: item.lotId ?? "",
      shelfId: item.shelfId ?? "",
    };
    return acc;
  }, {});
}

function itemLabel(item: WarehouseItem) {
  return `${item.sku} - ${item.name}`;
}

export function GoodsReturnsClient() {
  const user = useSessionUser();
  const queryClient = useQueryClient();
  const canView = hasAnyRole(user?.roles, ["ADMIN", "MANAGER", "RECEIVER"]);
  const canMutate = hasAnyRole(user?.roles, ["ADMIN", "RECEIVER"]);
  const [statusFilter, setStatusFilter] = useState<GoodsReturnStatus | "ALL">(
    "ALL",
  );
  const [orderFilter, setOrderFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selectedReturnId, setSelectedReturnId] = useState("");
  const [createForm, setCreateForm] = useState(defaultCreateForm);
  const [inspectLines, setInspectLines] = useState<
    Record<string, InspectLineForm>
  >({});
  const [inspectImages, setInspectImages] = useState<Record<string, File[]>>(
    {},
  );

  const returnsQuery = useQuery({
    enabled: canView,
    queryFn: () =>
      listGoodsReturns({
        limit: PAGE_SIZE,
        orderId: orderFilter,
        page,
        status: statusFilter,
      }),
    queryKey: goodsReturnKeys.list({
      orderId: orderFilter,
      page,
      status: statusFilter,
    }),
  });

  const returns = useMemo(
    () => returnsQuery.data?.data ?? [],
    [returnsQuery.data],
  );
  const selectedReturn =
    returns.find((item) => item.id === selectedReturnId) ?? returns[0];
  const activeReturnId = selectedReturn?.id ?? "";
  const total = returnsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const detailQuery = useQuery({
    enabled: canView && Boolean(activeReturnId),
    queryFn: () => getGoodsReturn(activeReturnId),
    queryKey: goodsReturnKeys.detail(activeReturnId),
  });
  const detail = detailQuery.data ?? selectedReturn;

  const stockItemsQuery = useQuery({
    enabled: canMutate,
    queryFn: () => listWarehouseItems({ isActive: true, limit: 100, page: 1 }),
    queryKey: ["goods-returns", "stock-items"],
  });
  const stockItems = stockItemsQuery.data?.data ?? [];

  const createMutation = useMutation({
    mutationFn: () =>
      createGoodsReturn({
        items: [
          {
            itemId: createForm.itemId,
            quantity: parsePositiveInteger(createForm.quantity),
          },
        ],
        note: optionalText(createForm.note),
        orderId: optionalText(createForm.orderId),
      }),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: (created) => {
      setCreateForm(defaultCreateForm);
      setSelectedReturnId(created.id);
      void queryClient.invalidateQueries({ queryKey: ["goods-returns"] });
      toast.success("Đã tạo phiếu hoàn hàng");
    },
  });

  const inspectMutation = useMutation({
    mutationFn: () =>
      inspectGoodsReturn(activeReturnId, {
        items:
          detail?.items.map((item) =>
            toInspectInput(item, inspectLines[item.itemId]),
          ) ?? [],
        itemImages:
          detail?.items.map((item) => inspectImages[item.itemId] ?? []) ?? [],
      }),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: (updated) => {
      setInspectLines(toInspectForm(updated.items));
      setInspectImages({});
      void queryClient.invalidateQueries({ queryKey: ["goods-returns"] });
      toast.success("Đã ghi nhận phân loại hàng hoàn");
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () => confirmGoodsReturn(activeReturnId),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["goods-returns"] });
      toast.success("Đã xác nhận nhập lại hàng hoàn");
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelGoodsReturn(activeReturnId),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["goods-returns"] });
      toast.success("Đã hủy phiếu hoàn hàng");
    },
  });

  function handleFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
  }

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!createForm.itemId) {
      toast.error("Cần chọn mặt hàng hoàn.");
      return;
    }

    createMutation.mutate();
  }

  function handleInspect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!detail || !activeReturnId) {
      return;
    }

    const missingShelf = detail.items.some(
      (item) => !inspectLines[item.itemId]?.shelfId.trim(),
    );

    if (missingShelf) {
      toast.error("Mỗi dòng cần có vị trí nhập lại.");
      return;
    }

    inspectMutation.mutate();
  }

  function selectReturn(goodsReturn: GoodsReturn) {
    setSelectedReturnId(goodsReturn.id);
    setInspectLines(toInspectForm(goodsReturn.items));
    setInspectImages({});
  }

  function updateInspectLine(itemId: string, patch: Partial<InspectLineForm>) {
    const defaults: InspectLineForm = {
      condition: "GOOD",
      lotId: "",
      shelfId: "",
    };

    setInspectLines((current) => ({
      ...current,
      [itemId]: {
        ...defaults,
        ...current[itemId],
        ...patch,
      },
    }));
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Hàng hoàn"
        actions={
          <Button
            disabled={!canView}
            onClick={() =>
              void queryClient.invalidateQueries({
                queryKey: ["goods-returns"],
              })
            }
            type="button"
            variant="outline"
          >
            {returnsQuery.isFetching || detailQuery.isFetching ? (
              <LoaderCircle className="animate-spin" data-icon="inline-start" />
            ) : (
              <RefreshCw data-icon="inline-start" />
            )}
            Làm mới
          </Button>
        }
      />

      {!canView ? (
        <PermissionNotice>
          Bạn cần quyền phù hợp để xem phiếu hoàn hàng.
        </PermissionNotice>
      ) : null}

      {returnsQuery.error ? <ErrorBanner error={returnsQuery.error} /> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <TablePanel
            count={`${total} bản ghi`}
            title={
              <span className="flex items-center gap-2">
                <RotateCcw className="size-4 text-primary" />
                Phiếu hoàn hàng
              </span>
            }
          >
            <form
              className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)_180px_auto]"
              onSubmit={handleFilter}
            >
              <div className="space-y-2">
                <Label>Trạng thái</Label>
                <Select
                  value={statusFilter}
                  onValueChange={(value) => {
                    setPage(1);
                    setStatusFilter(value as GoodsReturnStatus | "ALL");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tất cả</SelectItem>
                    {GOODS_RETURN_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {statusLabel(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <TextField
                id="goods-return-order-filter"
                label="Mã đơn hàng"
                required={false}
                value={orderFilter}
                onChange={setOrderFilter}
              />
              <Button className="self-end" disabled={!canView} type="submit">
                <Search data-icon="inline-start" />
                Lọc
              </Button>
            </form>

            {returnsQuery.isLoading ? (
              <TableSkeleton columns={5} />
            ) : (
              <GoodsReturnTable
                goodsReturns={returns}
                selectedId={activeReturnId}
                onSelect={selectReturn}
              />
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

          {detail ? (
            <GoodsReturnDetail
              detail={detail}
              onSelect={() => setInspectLines(toInspectForm(detail.items))}
            />
          ) : null}
        </div>

        <aside className="space-y-4">
          {canMutate ? (
            <CreateGoodsReturnCard
              busy={createMutation.isPending}
              form={createForm}
              items={stockItems}
              loadingItems={stockItemsQuery.isLoading}
              onChange={setCreateForm}
              onSubmit={handleCreate}
            />
          ) : (
            <PermissionNotice>
              Bạn chỉ có quyền xem phiếu hoàn hàng.
            </PermissionNotice>
          )}

          {detail ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ClipboardCheck className="size-4 text-primary" />
                  Xử lý phiếu
                </CardTitle>
                <CardDescription>
                  {detail.id} · {statusLabel(detail.status)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form className="space-y-3" onSubmit={handleInspect}>
                  <div className="space-y-3">
                    {detail.items.map((item) => (
                      <InspectLineEditor
                        key={item.itemId}
                        item={item}
                        files={inspectImages[item.itemId] ?? []}
                        disabled={!canMutate || detail.status === "RESTOCKED"}
                        value={
                          inspectLines[item.itemId] ?? {
                            condition: item.condition ?? "GOOD",
                            lotId: item.lotId ?? "",
                            shelfId: item.shelfId ?? "",
                          }
                        }
                        onChange={(patch) =>
                          updateInspectLine(item.itemId, patch)
                        }
                        onFilesChange={(files) =>
                          setInspectImages((current) => ({
                            ...current,
                            [item.itemId]: files,
                          }))
                        }
                      />
                    ))}
                  </div>

                  <Button
                    className="w-full"
                    disabled={
                      !canMutate ||
                      !activeReturnId ||
                      detail.status === "RESTOCKED" ||
                      inspectMutation.isPending
                    }
                    type="submit"
                  >
                    {inspectMutation.isPending ? (
                      <LoaderCircle
                        className="animate-spin"
                        data-icon="inline-start"
                      />
                    ) : (
                      <ClipboardCheck data-icon="inline-start" />
                    )}
                    Ghi nhận phân loại
                  </Button>
                </form>

                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    disabled={
                      !canMutate ||
                      detail.status !== "INSPECTED" ||
                      confirmMutation.isPending
                    }
                    onClick={() => confirmMutation.mutate()}
                    type="button"
                  >
                    {confirmMutation.isPending ? (
                      <LoaderCircle
                        className="animate-spin"
                        data-icon="inline-start"
                      />
                    ) : (
                      <CheckCircle2 data-icon="inline-start" />
                    )}
                    Xác nhận
                  </Button>
                  <Button
                    disabled={
                      !canMutate ||
                      !["DRAFT", "INSPECTED"].includes(detail.status) ||
                      cancelMutation.isPending
                    }
                    onClick={() => cancelMutation.mutate()}
                    type="button"
                    variant="outline"
                  >
                    {cancelMutation.isPending ? (
                      <LoaderCircle
                        className="animate-spin"
                        data-icon="inline-start"
                      />
                    ) : (
                      <XCircle data-icon="inline-start" />
                    )}
                    Hủy phiếu
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function toInspectInput(
  item: GoodsReturnItem,
  form: InspectLineForm | undefined,
): InspectGoodsReturnItemInput {
  return {
    condition: form?.condition ?? item.condition ?? "GOOD",
    itemId: item.itemId,
    lotId: optionalText(form?.lotId ?? ""),
    shelfId: form?.shelfId.trim() ?? "",
  };
}

function ErrorBanner({ error }: { error: unknown }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
      {formatError(error)}
    </div>
  );
}

function GoodsReturnTable({
  goodsReturns,
  onSelect,
  selectedId,
}: {
  goodsReturns: GoodsReturn[];
  onSelect: (goodsReturn: GoodsReturn) => void;
  selectedId: string;
}) {
  return (
    <Table scrollable>
      <TableHeader>
        <TableRow>
          <TableHead>Mã phiếu</TableHead>
          <TableHead>Mã đơn hàng</TableHead>
          <TableHead>Trạng thái</TableHead>
          <TableHead>Số dòng</TableHead>
          <TableHead>Ngày tạo</TableHead>
          <TableHead className="text-right">Thao tác</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {goodsReturns.length === 0 ? (
          <EmptyRow colSpan={6} label="Chưa có phiếu hoàn hàng." />
        ) : (
          goodsReturns.map((goodsReturn) => (
            <TableRow
              className={cn(
                "cursor-pointer",
                selectedId === goodsReturn.id && "bg-primary/5",
              )}
              key={goodsReturn.id}
              onClick={() => onSelect(goodsReturn)}
            >
              <TableCell className="font-mono font-semibold">
                {goodsReturn.id}
              </TableCell>
              <TableCell>{goodsReturn.orderId ?? "Không gắn đơn"}</TableCell>
              <TableCell>
                <StatusBadge tone={statusTone(goodsReturn.status)}>
                  {statusLabel(goodsReturn.status)}
                </StatusBadge>
              </TableCell>
              <TableCell>{goodsReturn.items.length}</TableCell>
              <TableCell>{formatDate(goodsReturn.createdAt)}</TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(goodsReturn);
                  }}
                >
                  <Eye data-icon="inline-start" /> Xem chi tiết
                </Button>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

function GoodsReturnDetail({
  detail,
  onSelect,
}: {
  detail: GoodsReturn;
  onSelect: () => void;
}) {
  return (
    <Card onClick={onSelect}>
      <CardHeader className="border-b bg-muted/20">
        <CardTitle className="text-base">
          {detail.orderId ?? "Phiếu hoàn không gắn đơn"}
        </CardTitle>
        <CardDescription>{statusLabel(detail.status)}</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <Table scrollable>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Số lượng</TableHead>
              <TableHead>Phân loại</TableHead>
              <TableHead>Vị trí</TableHead>
              <TableHead>Ghi nhận hủy</TableHead>
              <TableHead>Ảnh minh chứng</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {detail.items.length === 0 ? (
              <EmptyRow colSpan={6} label="Phiếu chưa có dòng hàng." />
            ) : (
              detail.items.map((item) => (
                <TableRow key={item.itemId}>
                  <TableCell className="font-mono font-semibold">
                    {item.sku}
                  </TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>
                    {item.condition
                      ? statusLabel(item.condition)
                      : "Chưa phân loại"}
                  </TableCell>
                  <TableCell>{item.shelfId ?? "Chưa chọn"}</TableCell>
                  <TableCell>{item.scrapNoteId ?? "Không có"}</TableCell>
                  <TableCell className="min-w-48">
                    <EvidenceImageGallery
                      emptyLabel="Không có ảnh"
                      images={item.images}
                      label={`${item.images?.length ?? 0} ảnh`}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function CreateGoodsReturnCard({
  busy,
  form,
  items,
  loadingItems,
  onChange,
  onSubmit,
}: {
  busy: boolean;
  form: typeof defaultCreateForm;
  items: WarehouseItem[];
  loadingItems: boolean;
  onChange: (form: typeof defaultCreateForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Plus className="size-4 text-primary" />
          Tạo phiếu hoàn
        </CardTitle>
        <CardDescription>Ghi nhận hàng trả trực tiếp tại kho.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={onSubmit}>
          <TextField
            id="goods-return-order"
            label="Mã đơn hàng"
            required={false}
            value={form.orderId}
            onChange={(orderId) => onChange({ ...form, orderId })}
          />
          <div className="space-y-2">
            <Label>Mặt hàng hoàn</Label>
            <Select
              disabled={loadingItems}
              value={form.itemId}
              onValueChange={(itemId) => onChange({ ...form, itemId })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Chọn mặt hàng" />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {itemLabel(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <TextField
            id="goods-return-quantity"
            label="Số lượng"
            type="number"
            value={form.quantity}
            onChange={(quantity) => onChange({ ...form, quantity })}
          />
          <div className="space-y-2">
            <Label htmlFor="goods-return-note">Ghi chú</Label>
            <Textarea
              id="goods-return-note"
              value={form.note}
              onChange={(event) =>
                onChange({ ...form, note: event.target.value })
              }
            />
          </div>
          <Button className="w-full" disabled={busy} type="submit">
            {busy ? (
              <LoaderCircle className="animate-spin" data-icon="inline-start" />
            ) : (
              <Plus data-icon="inline-start" />
            )}
            Tạo phiếu
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function InspectLineEditor({
  disabled,
  files,
  item,
  onChange,
  onFilesChange,
  value,
}: {
  disabled: boolean;
  files: File[];
  item: GoodsReturnItem;
  onChange: (patch: Partial<InspectLineForm>) => void;
  onFilesChange: (files: File[]) => void;
  value: InspectLineForm;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-border/70 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="font-mono text-sm font-semibold">{item.sku}</div>
        <span className="text-sm text-muted-foreground">
          {item.quantity.toLocaleString("vi-VN")}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Phân loại</Label>
          <Select
            disabled={disabled}
            value={value.condition}
            onValueChange={(condition) =>
              onChange({ condition: condition as GoodsReturnItemCondition })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GOODS_RETURN_ITEM_CONDITIONS.map((condition) => (
                <SelectItem key={condition} value={condition}>
                  {statusLabel(condition)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <TextField
          id={`goods-return-shelf-${item.itemId}`}
          disabled={disabled}
          label="Vị trí nhập lại"
          value={value.shelfId}
          onChange={(shelfId) => onChange({ shelfId })}
        />
      </div>
      <TextField
        id={`goods-return-lot-${item.itemId}`}
        disabled={disabled}
        label="Mã lô"
        required={false}
        value={value.lotId}
        onChange={(lotId) => onChange({ lotId })}
      />
      <EvidenceImagePicker
        disabled={disabled}
        files={files}
        id={`goods-return-images-${item.itemId}`}
        onChange={onFilesChange}
      />
    </div>
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

function TextField({
  disabled = false,
  id,
  label,
  onChange,
  required = true,
  type = "text",
  value,
}: {
  disabled?: boolean;
  id: string;
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  value: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        disabled={disabled}
        id={id}
        required={required}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
