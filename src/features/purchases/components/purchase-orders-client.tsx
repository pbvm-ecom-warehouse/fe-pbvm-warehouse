"use client";

import { FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Eye,
  ClipboardCheck,
  LoaderCircle,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { EvidenceImagePicker } from "@/components/evidence-images";

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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  TableSkeleton,
} from "@/features/admin-shell/components/operations-ui";
import { createGoodsReceiptNoteFormSchema } from "@/features/purchases/schemas/goods-receipt-note.schema";
import {
  formatLotNumber,
  parseLotNumber,
  todayInHoChiMinh,
} from "@/features/purchases/utils/lot-number";
import { getApiErrorCode, getApiErrorMessage } from "@/lib/api-contract";
import { hasAnyRole } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { statusLabel, statusTone } from "@/lib/wms-ui-labels";
import { useSessionUser } from "@/hooks/use-session-user";
import {
  listSupplierItemsBySupplier,
  listSuppliers,
  type SupplierItem,
} from "@/features/suppliers/services/supplier.service";
import { WarehouseItemCombobox } from "@/features/products/components/warehouse-item-combobox";
import {
  getWarehouseItem,
  type WarehouseItem,
} from "@/features/products/services/warehouse-items.service";

import {
  createPurchaseOrder,
  getPurchaseOrder,
  listPurchaseOrders,
  listReceivingPurchaseOrders,
  PURCHASE_ORDER_STATUSES,
  type CreatePurchaseOrderItemInput,
  type PurchaseOrder,
  type PurchaseOrderStatus,
  type ReceivingPurchaseOrder,
} from "../services/purchase-order.service";
import {
  approveGoodsReceiptNote,
  confirmGoodsReceiptNote,
  rejectGoodsReceiptNote,
  createGoodsReceiptNote,
  listGoodsReceiptNotes,
  updateGoodsReceiptNoteItems,
  uploadGoodsReceiptNoteImage,
  type CreateGoodsReceiptNoteItemInput,
  type GoodsReceiptNote,
} from "../services/goods-receipt-note.service";

import {
  GoodsReceiptNoteDetailDialog,
  GoodsReceiptNotesList,
} from "./goods-receipt-notes-list";

const PAGE_SIZE = 20;
const purchaseKeys = {
  allGrns: ["goods-receipt-notes", "all"] as const,
  detail: (purchaseOrderId: string) =>
    ["purchase-orders", "detail", purchaseOrderId] as const,
  list: (params: { page: number; status: string; supplierId: string }) =>
    ["purchase-orders", "list", params] as const,

  supplierDetail: (supplierId: string) =>
    ["purchase-orders", "supplier-detail", supplierId] as const,
  supplierItems: (supplierId: string) =>
    ["purchase-orders", "supplier-items", supplierId] as const,
  suppliers: ["purchase-orders", "suppliers"] as const,
};

type PurchaseOrderItemForm = {
  expectedQty: string;
  itemId: string;
  itemDepth?: number;
  itemWidth?: number;
  itemHeight?: number;
  packageFactor: string;
  packageUnit: string;
  sku: string;
  unit: string;
  unitPrice: string;
};

type GoodsReceiptItemForm = {
  actualQty: string;
  expiryDate: string;
  isPerishable: boolean;
  itemId: string;
  itemName: string;
  lotNumber: string;
  lotSequence: string;
  manufacturedDate: string;
  note: string;
  itemDepth?: number;
  itemWidth?: number;
  itemHeight?: number;
  sku: string;
  unit: string;
};

const defaultItemForm: PurchaseOrderItemForm = {
  expectedQty: "1",
  itemId: "",
  packageFactor: "1",
  packageUnit: "cái",
  sku: "",
  unit: "thùng",
  unitPrice: "0",
};

const defaultCreateForm = {
  expectedDate: "",
  note: "",
  supplierId: "",
};

function formatError(error: unknown) {
  const code = getApiErrorCode(error);
  const messages: Partial<Record<string, string>> = {
    PO_UNIT_MUST_MATCH_ITEM:
      "Đơn vị đặt hàng phải khớp đơn vị cơ sở (thùng) của mặt hàng.",
    GRN_PACKAGE_SPEC_REQUIRED:
      "Mặt hàng chưa khai đủ kích thước thùng — không thể duyệt phiếu nhập.",
    GRN_PACKAGE_COUNT_REQUIRED: "Số thùng thực nhận phải lớn hơn 0.",
  };
  return (
    (code && messages[code]) ||
    getApiErrorMessage(error) ||
    "Không kết nối được WMS."
  );
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function parsePositiveNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parsePositiveInt(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function toSafeNumber(value: unknown, fallback = 0) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Chưa có";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("vi-VN").format(date);
}

// BE luôn gắn sẵn `supplier`/`supplierName` trong response (attachDisplayInfo) — không cần
// tra thêm getSupplier() theo supplierId ở FE nữa.
function getPurchaseOrderSupplierLabel(
  purchaseOrder: PurchaseOrder | ReceivingPurchaseOrder,
) {
  if ("supplier" in purchaseOrder) {
    return (
      purchaseOrder.supplier?.name ??
      purchaseOrder.supplierName ??
      "Chưa xác định"
    );
  }
  return purchaseOrder.supplierName ?? "Chưa xác định";
}

function getPurchaseOrderSelectLabel(purchaseOrder: ReceivingPurchaseOrder) {
  return [
    purchaseOrder.poNumber,
    getPurchaseOrderSupplierLabel(purchaseOrder),
  ].join(" · ");
}

function toPurchaseOrderItems(
  forms: PurchaseOrderItemForm[],
): CreatePurchaseOrderItemInput[] {
  // BE tự denormalize sku từ WarehouseItem theo itemId — không gửi sku lên
  // (ValidationPipe whitelist:true, forbidNonWhitelisted:true sẽ 400 nếu gửi thừa field).
  return forms
    .filter((form) => form.itemId.trim() && form.sku.trim())
    .map((form) => ({
      expectedQty: parsePositiveInt(form.expectedQty, 0),
      itemId: form.itemId.trim(),
      unit: "thùng",
      unitPrice: parsePositiveNumber(form.unitPrice, 0),
    }))
    .filter((item) => item.expectedQty > 0);
}

function toGoodsReceiptItems(
  forms: GoodsReceiptItemForm[],
): CreateGoodsReceiptNoteItemInput[] {
  // Tương tự PO — BE tự lấy sku từ PO item theo itemId, không gửi sku lên.
  return forms
    .filter((form) => form.itemId.trim() && form.sku.trim())
    .map((form) => ({
      actualQty: parsePositiveInt(form.actualQty, 0),
      expiryDate: optionalText(form.expiryDate),
      itemId: form.itemId.trim(),
      lotNumber: optionalText(form.lotNumber),
      note: optionalText(form.note),
    }))
    .filter((item) => item.actualQty > 0);
}

function buildGoodsReceiptForms(
  purchaseOrder: ReceivingPurchaseOrder | undefined,
  isPerishableByItemId: Map<string, boolean>,
): GoodsReceiptItemForm[] {
  // itemName/sku/remainingQty đã có sẵn trong ReceivingPurchaseOrderItem (BE trả) — chỉ còn
  // isPerishable là field cần tra riêng (WarehouseItem đầy đủ), dùng để bắt buộc mã lô/hạn dùng.
  return (
    purchaseOrder?.items?.map((item) => ({
      actualQty: String(
        item.remainingQty > 0 ? item.remainingQty : item.expectedQty,
      ),
      expiryDate: "",
      isPerishable: isPerishableByItemId.get(item.itemId) ?? false,
      itemId: item.itemId,
      itemName: item.itemName,
      lotNumber: "",
      lotSequence: "",
      manufacturedDate: "",
      note: "",
      itemDepth: item.itemDepth,
      itemWidth: item.itemWidth,
      itemHeight: item.itemHeight,
      sku: item.sku,
      unit: item.unit,
    })) ?? []
  );
}
function ErrorBanner({ error }: { error: unknown }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
      {formatError(error)}
    </div>
  );
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <TableRow>
      <TableCell
        className="h-24 text-center text-sm text-muted-foreground"
        colSpan={colSpan}
      >
        {label}
      </TableCell>
    </TableRow>
  );
}

export function PurchaseOrdersClient({
  mode = "all",
}: {
  mode?: "all" | "purchase-orders" | "goods-receipts";
}) {
  const user = useSessionUser();
  const queryClient = useQueryClient();
  const canReadPurchaseOrders = hasAnyRole(user?.roles, [
    "ADMIN",
    "MANAGER",
    "RECEIVER",
  ]);
  const canCreatePurchaseOrder = hasAnyRole(user?.roles, ["ADMIN", "MANAGER"]);
  const canReadGoodsReceiptNotes = hasAnyRole(user?.roles, [
    "ADMIN",
    "MANAGER",
    "RECEIVER",
  ]);
  const canCreateGoodsReceiptNote = hasAnyRole(user?.roles, [
    "ADMIN",
    "RECEIVER",
  ]);
  const canConfirmGoodsReceiptNote = hasAnyRole(user?.roles, [
    "ADMIN",
    "RECEIVER",
  ]);
  const canApproveGoodsReceiptNote = hasAnyRole(user?.roles, [
    "ADMIN",
    "MANAGER",
  ]);
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus | "ALL">(
    "ALL",
  );
  const [supplierFilter, setSupplierFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selectedPurchaseOrderId, setSelectedPurchaseOrderId] = useState("");
  const [purchaseDetailOpen, setPurchaseDetailOpen] = useState(false);
  const [selectedGoodsReceiptNote, setSelectedGoodsReceiptNote] =
    useState<GoodsReceiptNote>();
  const [activeTab, setActiveTab] = useState(
    mode === "goods-receipts" ? "goods-receipts" : "purchase-orders",
  );

  const [createForm, setCreateForm] = useState(defaultCreateForm);
  const [itemForms, setItemForms] = useState<PurchaseOrderItemForm[]>([
    defaultItemForm,
  ]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [grnDialogOpen, setGrnDialogOpen] = useState(false);
  const [grnPurchaseOrderId, setGrnPurchaseOrderId] = useState("");
  const [grnItemForms, setGrnItemForms] = useState<GoodsReceiptItemForm[]>([]);
  const [grnImages, setGrnImages] = useState<File[]>([]);
  const [grnEditTarget, setGrnEditTarget] = useState<GoodsReceiptNote>();

  const purchaseOrdersQuery = useQuery({
    enabled: canReadPurchaseOrders,
    queryFn: () =>
      listPurchaseOrders({
        limit: PAGE_SIZE,
        page,
        status: statusFilter,
        supplierId: supplierFilter,
      }),
    queryKey: purchaseKeys.list({
      page,
      status: statusFilter,
      supplierId: supplierFilter,
    }),
  });

  // Chỉ tải danh sách PO có thể nhận sau khi người dùng mở dialog tạo GRN.
  const receivingPurchaseOrdersQuery = useQuery({
    enabled: canCreateGoodsReceiptNote && grnDialogOpen,
    queryFn: () => listReceivingPurchaseOrders({ limit: 100, page: 1 }),
    queryKey: ["purchase-orders", "receiving"],
  });
  const suppliersQuery = useQuery({
    enabled:
      (canReadPurchaseOrders && activeTab === "purchase-orders") ||
      (canCreatePurchaseOrder && dialogOpen),
    queryFn: () => listSuppliers({ limit: 100, page: 1, status: "ACTIVE" }),
    queryKey: purchaseKeys.suppliers,
  });
  const supplierItemsQuery = useQuery({
    enabled:
      canCreatePurchaseOrder && dialogOpen && Boolean(createForm.supplierId),
    queryFn: () => listSupplierItemsBySupplier(createForm.supplierId),
    queryKey: purchaseKeys.supplierItems(createForm.supplierId),
  });
  const activeSupplierItems = useMemo(
    () =>
      (supplierItemsQuery.data ?? []).filter(
        (supplierItem) => supplierItem.isActive,
      ),
    [supplierItemsQuery.data],
  );
  const supplierWarehouseItemQueries = useQueries({
    queries: activeSupplierItems.map((supplierItem) => ({
      enabled: canCreatePurchaseOrder && dialogOpen,
      queryFn: () => getWarehouseItem(supplierItem.itemId),
      queryKey: ["stock-items", "detail", supplierItem.itemId],
    })),
  });
  const supplierWarehouseItems = useMemo(
    () =>
      supplierWarehouseItemQueries
        .map((query) => query.data)
        .filter((item): item is WarehouseItem => Boolean(item?.isActive)),
    [supplierWarehouseItemQueries],
  );
  const supplierItemByItemId = useMemo(
    () =>
      new Map<string, SupplierItem>(
        activeSupplierItems.map((supplierItem) => [
          supplierItem.itemId,
          supplierItem,
        ]),
      ),
    [activeSupplierItems],
  );
  const supplierWarehouseItemsLoading =
    supplierItemsQuery.isFetching ||
    supplierWarehouseItemQueries.some((query) => query.isFetching);
  const supplierWarehouseItemsError =
    supplierItemsQuery.error ??
    supplierWarehouseItemQueries.find((query) => query.error)?.error;

  const purchaseOrders = useMemo(
    () => purchaseOrdersQuery.data?.data ?? [],
    [purchaseOrdersQuery.data?.data],
  );
  const receivingPurchaseOrders = useMemo<ReceivingPurchaseOrder[]>(
    () => receivingPurchaseOrdersQuery.data?.data ?? [],
    [receivingPurchaseOrdersQuery.data?.data],
  );
  const suppliers = useMemo(
    () => suppliersQuery.data?.data ?? [],
    [suppliersQuery.data?.data],
  );

  const total = purchaseOrdersQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selectedPurchaseOrder = purchaseOrders.find(
    (po) => po.id === selectedPurchaseOrderId,
  );
  const activePurchaseOrderId = selectedPurchaseOrder?.id ?? "";

  const detailQuery = useQuery({
    enabled: canReadPurchaseOrders && Boolean(activePurchaseOrderId),
    queryFn: () => getPurchaseOrder(activePurchaseOrderId),
    queryKey: purchaseKeys.detail(activePurchaseOrderId),
  });
  const detail = detailQuery.data ?? selectedPurchaseOrder;
  const grnPurchaseOrder = receivingPurchaseOrders.find(
    (purchaseOrder) => purchaseOrder.id === grnPurchaseOrderId,
  );
  const allGrnsQuery = useQuery({
    enabled: canReadGoodsReceiptNotes && activeTab === "goods-receipts",
    queryFn: () => listGoodsReceiptNotes({ limit: 100, page: 1 }),
    queryKey: purchaseKeys.allGrns,
  });
  const allGoodsReceiptNotes = useMemo(
    () => allGrnsQuery.data?.data ?? [],
    [allGrnsQuery.data?.data],
  );
  // isPerishable không có sẵn trong ReceivingPurchaseOrderItem (chỉ WarehouseItem đầy đủ mới
  // có) — tra riêng, CHỈ cho item của PO đang chọn để tạo GRN (không phải toàn bộ PO/GRN đang
  // hiển thị), giảm mạnh số lượng call so với trước.
  const grnCandidateItemIds = Array.from(
    new Set(
      receivingPurchaseOrders.flatMap((po) =>
        po.items.map((item) => item.itemId),
      ),
    ),
  );
  const grnCandidateItemQueries = useQueries({
    queries: grnCandidateItemIds.map((itemId) => ({
      enabled: canCreateGoodsReceiptNote && grnDialogOpen,
      queryFn: () => getWarehouseItem(itemId),
      queryKey: ["stock-items", "detail", itemId],
    })),
  });
  // useQueries trả mảng object MỚI mỗi render dù data không đổi — dùng chuỗi khóa ổn định
  // (id:isPerishable) làm dependency thay vì mảng query, tránh useMemo/effect phụ thuộc nó
  // chạy lại vô hạn (Map mới mỗi render → effect luôn thấy "đổi" → setState vô tận).
  const isPerishableCacheKey = grnCandidateItemQueries
    .map((q) => (q.data ? `${q.data.id}:${q.data.isPerishable}` : ""))
    .join("|");
  const isPerishableByItemId = useMemo(() => {
    const entries = grnCandidateItemQueries
      .map((query) => query.data)
      .filter((item): item is WarehouseItem => Boolean(item))
      .map((item) => [item.id, item.isPerishable] as const);

    return new Map(entries);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPerishableCacheKey]);

  const grnPurchaseOrderSupplierLabel = grnPurchaseOrder
    ? getPurchaseOrderSupplierLabel(grnPurchaseOrder)
    : "";

  const createMutation = useMutation({
    mutationFn: () =>
      createPurchaseOrder({
        expectedDate: optionalText(createForm.expectedDate),
        items: toPurchaseOrderItems(itemForms),
        note: optionalText(createForm.note),
        supplierId: createForm.supplierId,
      }),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: (purchaseOrder) => {
      setCreateForm(defaultCreateForm);
      setItemForms([defaultItemForm]);
      setSelectedPurchaseOrderId(purchaseOrder.id);
      void queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      setDialogOpen(false);
      toast.success("Đã tạo đơn mua");
    },
  });

  const createGrnMutation = useMutation({
    mutationFn: async () => {
      const items = toGoodsReceiptItems(grnItemForms);
      let goodsReceiptNote = grnEditTarget
        ? await updateGoodsReceiptNoteItems(grnEditTarget.id, items)
        : await createGoodsReceiptNote({
            items,
            purchaseOrderId: grnPurchaseOrderId,
          });

      for (const image of grnImages) {
        goodsReceiptNote = await uploadGoodsReceiptNoteImage(
          goodsReceiptNote.id,
          image,
        );
      }

      return goodsReceiptNote;
    },
    onError: (error) => toast.error(formatError(error)),
    onSuccess: () => {
      setGrnItemForms([]);
      setGrnPurchaseOrderId("");
      setGrnImages([]);
      setGrnEditTarget(undefined);
      setGrnDialogOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["goods-receipt-notes"] });
      void queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast.success(
        grnEditTarget ? "Đã cập nhật phiếu nhập" : "Đã tạo phiếu nhập",
      );
    },
  });
  const confirmGrnMutation = useMutation({
    mutationFn: (goodsReceiptNoteId: string) =>
      confirmGoodsReceiptNote(goodsReceiptNoteId),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["goods-receipt-notes"] });
      void queryClient.invalidateQueries({ queryKey: ["putaway-tasks"] });
      toast.success("Đã xác nhận nhận hàng");
    },
  });

  const rejectGrnMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      rejectGoodsReceiptNote(id, reason),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["goods-receipt-notes"] });
      toast.success("Đã từ chối phiếu nhập và gửi lý do cho Receiver");
    },
  });
  const approveGrnMutation = useMutation({
    mutationFn: (goodsReceiptNoteId: string) =>
      approveGoodsReceiptNote(goodsReceiptNoteId),
    onError: (error) => toast.error(formatError(error)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["goods-receipt-notes"] });
      void queryClient.invalidateQueries({ queryKey: ["putaway-tasks"] });
      toast.success("Đã duyệt phiếu nhập");
    },
  });

  function handleFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
  }

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const items = toPurchaseOrderItems(itemForms);
    if (items.length === 0) {
      toast.error("Đơn mua cần ít nhất một dòng hàng hợp lệ.");
      return;
    }

    createMutation.mutate();
  }

  function handleCreateGrn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = createGoodsReceiptNoteFormSchema.safeParse({
      items: grnItemForms,
      purchaseOrderId: grnPurchaseOrderId,
    });

    if (!parsed.success) {
      toast.error(
        parsed.error.issues[0]?.message ?? "Thông tin phiếu nhập chưa hợp lệ",
      );
      return;
    }

    createGrnMutation.mutate();
  }

  async function openGrnDialog() {
    setGrnImages([]);
    setGrnEditTarget(undefined);
    setGrnDialogOpen(true);

    const result = await receivingPurchaseOrdersQuery.refetch();
    const purchaseOrder = result.data?.data?.[0] ?? receivingPurchaseOrders[0];
    setGrnPurchaseOrderId(purchaseOrder?.id ?? "");
    setGrnItemForms(
      buildGoodsReceiptForms(purchaseOrder, isPerishableByItemId),
    );
  }

  function openEditGrnDialog(grn: GoodsReceiptNote) {
    setGrnEditTarget(grn);
    setGrnPurchaseOrderId(grn.purchaseOrderId);
    setGrnItemForms(
      grn.items.map((item) => {
        const parsedLot = parseLotNumber(item.lotNumber ?? "");
        return {
          actualQty: String(item.actualQty),
          expiryDate: item.expiryDate ?? "",
          isPerishable: item.isPerishable ?? false,
          itemId: item.itemId,
          itemName: item.itemName ?? item.sku,
          lotNumber: item.lotNumber ?? "",
          lotSequence: parsedLot?.lotSequence ?? "",
          manufacturedDate:
            item.manufacturedDate ?? parsedLot?.manufacturedDate ?? "",
          note: item.note ?? "",
          itemDepth: item.itemDepth,
          itemWidth: item.itemWidth,
          itemHeight: item.itemHeight,
          sku: item.sku,
          unit: "thùng",
        };
      }),
    );
    setGrnImages([]);
    setGrnDialogOpen(true);
  }

  // receivingPurchaseOrders duoc nap bat dong bo sau khi mo dialog; khi danh sach tra ve ma
  // selection hien tai khong con hop le thi can tu dong bo sang PO dau tien hop le. Day la
  // sync tu external query cache vao local form state, nen chap nhan setState trong effect.
  useEffect(() => {
    if (grnDialogOpen && !grnEditTarget && receivingPurchaseOrders.length > 0) {
      const exists = receivingPurchaseOrders.some(
        (po) => po.id === grnPurchaseOrderId,
      );
      if (!exists) {
        const defaultPo = receivingPurchaseOrders[0];
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setGrnPurchaseOrderId(defaultPo.id);
        setGrnItemForms(
          buildGoodsReceiptForms(defaultPo, isPerishableByItemId),
        );
      }
    }
  }, [
    grnDialogOpen,
    grnEditTarget,
    grnPurchaseOrderId,
    receivingPurchaseOrders,
    isPerishableByItemId,
  ]);

  // getWarehouseItem (isPerishableByItemId) chỉ bắt đầu SAU khi dialog mở (enabled: grnDialogOpen)
  // nên form ban đầu luôn có isPerishable=false — vá lại field này khi query resolve xong,
  // KHÔNG rebuild toàn bộ form (tránh xóa lotNumber/expiryDate/note user đã gõ tay). Đây là
  // effect hợp lệ theo React docs (subscribe cập nhật từ external cache/query, không phải state
  // suy diễn thuần) — cùng pattern với effect phía trên, chấp nhận cảnh báo set-state-in-effect.
  useEffect(() => {
    if (!grnDialogOpen || isPerishableByItemId.size === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGrnItemForms((current) =>
      current.map((item) => ({
        ...item,
        isPerishable:
          isPerishableByItemId.get(item.itemId) ?? item.isPerishable,
      })),
    );
  }, [grnDialogOpen, isPerishableByItemId]);

  function handleGrnPurchaseOrderChange(purchaseOrderId: string) {
    const purchaseOrder = receivingPurchaseOrders.find(
      (candidate) => candidate.id === purchaseOrderId,
    );
    setGrnPurchaseOrderId(purchaseOrderId);
    setGrnItemForms(
      buildGoodsReceiptForms(purchaseOrder, isPerishableByItemId),
    );
  }

  function updateItemForm(index: number, next: PurchaseOrderItemForm) {
    setItemForms((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? next : item)),
    );
  }

  function addItemRow() {
    setItemForms((current) => [...current, defaultItemForm]);
  }

  function removeItemRow(index: number) {
    setItemForms((current) =>
      current.length === 1
        ? [defaultItemForm]
        : current.filter((_, itemIndex) => itemIndex !== index),
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={mode === "purchase-orders" ? "Đặt Nhập hàng" : "Nhận hàng"}
        actions={
          <Button
            disabled={!canReadPurchaseOrders && !canReadGoodsReceiptNotes}
            onClick={() =>
              void queryClient.invalidateQueries({
                queryKey: ["purchase-orders"],
              })
            }
            type="button"
            variant="outline"
          >
            {purchaseOrdersQuery.isFetching ? (
              <LoaderCircle className="animate-spin" data-icon="inline-start" />
            ) : (
              <RefreshCw data-icon="inline-start" />
            )}
            Làm mới
          </Button>
        }
      />

      {!canReadPurchaseOrders && !canReadGoodsReceiptNotes ? (
        <PermissionNotice>
          Bạn cần quyền phù hợp để tạo và chỉnh sửa đơn mua.
        </PermissionNotice>
      ) : null}

      {purchaseOrdersQuery.error ? (
        <ErrorBanner error={purchaseOrdersQuery.error} />
      ) : null}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {mode === "all" ? (
          <TabsList className="h-9 rounded-lg border bg-card p-1">
            <TabsTrigger value="purchase-orders">
              <ShoppingCart data-icon="inline-start" />
              Đơn mua
            </TabsTrigger>
            <TabsTrigger value="goods-receipts">
              <ClipboardCheck data-icon="inline-start" />
              Phiếu nhập
            </TabsTrigger>
          </TabsList>
        ) : null}
        <TabsContent value="purchase-orders">
          <div className="grid gap-4">
            <Card>
              <CardHeader className="border-b bg-muted/20">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ShoppingCart className="size-4 text-primary" />
                      Đơn mua
                    </CardTitle>
                    <CardDescription>
                      {total} bản ghi · trang {page}/{totalPages}
                    </CardDescription>
                  </div>
                  {canCreatePurchaseOrder ? (
                    <Button onClick={() => setDialogOpen(true)} type="button">
                      <Plus data-icon="inline-start" />
                      Tạo đơn mua
                    </Button>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <form
                  className="grid gap-3 md:grid-cols-[180px_1fr_auto]"
                  onSubmit={handleFilter}
                >
                  <div className="space-y-2">
                    <Label>Trạng thái</Label>
                    <Select
                      value={statusFilter}
                      onValueChange={(value) => {
                        setPage(1);
                        setStatusFilter(value as PurchaseOrderStatus | "ALL");
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Tất cả</SelectItem>
                        {PURCHASE_ORDER_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {statusLabel(status)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Nhà cung cấp</Label>
                    <Select
                      value={supplierFilter || "ALL"}
                      onValueChange={(value) => {
                        setPage(1);
                        setSupplierFilter(value === "ALL" ? "" : value);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Tất cả</SelectItem>
                        {suppliers.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    className="self-end"
                    disabled={!canReadPurchaseOrders}
                    type="submit"
                  >
                    <Search data-icon="inline-start" />
                    Lọc
                  </Button>
                </form>

                {purchaseOrdersQuery.isLoading ? (
                  <TableSkeleton columns={6} />
                ) : (
                  <PurchaseOrderTable
                    purchaseOrders={purchaseOrders}
                    selectedId={activePurchaseOrderId}
                    onSelect={(purchaseOrder) => {
                      setSelectedPurchaseOrderId(purchaseOrder.id);
                      setPurchaseDetailOpen(true);
                    }}
                  />
                )}

                <div className="flex items-center justify-between gap-3">
                  <Button
                    disabled={page <= 1}
                    onClick={() =>
                      setPage((current) => Math.max(1, current - 1))
                    }
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
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="goods-receipts">
          <GoodsReceiptNotesList
            approveBusyId={
              approveGrnMutation.isPending
                ? approveGrnMutation.variables
                : undefined
            }
            canApprove={canApproveGoodsReceiptNote}
            canConfirm={canConfirmGoodsReceiptNote}
            canCreate={canCreateGoodsReceiptNote}
            confirmBusyId={
              confirmGrnMutation.isPending
                ? confirmGrnMutation.variables
                : undefined
            }
            grns={allGoodsReceiptNotes}
            loading={allGrnsQuery.isLoading}
            onApprove={(goodsReceiptNoteId) =>
              approveGrnMutation.mutate(goodsReceiptNoteId)
            }
            onReject={(goodsReceiptNoteId, reason) =>
              rejectGrnMutation.mutate({ id: goodsReceiptNoteId, reason })
            }
            rejectBusyId={
              rejectGrnMutation.isPending
                ? rejectGrnMutation.variables?.id
                : undefined
            }
            onConfirm={(goodsReceiptNoteId) =>
              confirmGrnMutation.mutate(goodsReceiptNoteId)
            }
            onCreate={openGrnDialog}
            onEdit={openEditGrnDialog}
            onSelect={setSelectedGoodsReceiptNote}
          />
        </TabsContent>
      </Tabs>

      {allGrnsQuery.error ? <ErrorBanner error={allGrnsQuery.error} /> : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          size="5xl"
          className="max-h-[90dvh] grid-rows-[auto_minmax(0,1fr)] overflow-hidden p-0"
        >
          <DialogHeader className="border-b px-6 py-4 pr-12">
            <DialogTitle>Tạo đơn mua</DialogTitle>
            <DialogDescription>
              Thêm đơn đặt hàng mới vào hệ thống.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden"
            onSubmit={handleCreate}
          >
            <div
              className="min-h-0 space-y-4 overflow-x-hidden overflow-y-auto px-6 py-4"
              data-testid="purchase-order-dialog-body"
            >
              <div className="grid gap-3 md:grid-cols-2">
                <SelectField
                  disabled={!canCreatePurchaseOrder}
                  label="Nhà cung cấp"
                  value={createForm.supplierId}
                  onChange={(supplierId) => {
                    setCreateForm((current) => ({
                      ...current,
                      supplierId,
                    }));
                    setItemForms([defaultItemForm]);
                  }}
                >
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectField>
                <div className="space-y-2">
                  <Label htmlFor="po-expected-date">Ngày dự kiến</Label>
                  <Input
                    id="po-expected-date"
                    type="date"
                    value={createForm.expectedDate}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        expectedDate: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="po-note">Ghi chú</Label>
                <Textarea
                  id="po-note"
                  value={createForm.note}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      note: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Label>Hàng đặt</Label>
                  <Button
                    onClick={addItemRow}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Plus data-icon="inline-start" />
                    Thêm dòng
                  </Button>
                </div>
                {itemForms.map((item, index) => (
                  <PurchaseOrderItemFields
                    availableItems={supplierWarehouseItems}
                    disabled={!createForm.supplierId}
                    index={index}
                    item={item}
                    key={index}
                    loadError={supplierWarehouseItemsError}
                    loading={supplierWarehouseItemsLoading}
                    onChange={(next) => updateItemForm(index, next)}
                    onRemove={() => removeItemRow(index)}
                    supplierItemByItemId={supplierItemByItemId}
                  />
                ))}
              </div>
            </div>

            <DialogFooter className="m-0 rounded-none px-6 py-4">
              <Button
                disabled={
                  !canCreatePurchaseOrder ||
                  !createForm.supplierId ||
                  itemForms.some(
                    (item) =>
                      !item.itemId || !item.sku || item.unit !== "thùng",
                  ) ||
                  createMutation.isPending
                }
                type="submit"
              >
                {createMutation.isPending ? (
                  <LoaderCircle
                    className="animate-spin"
                    data-icon="inline-start"
                  />
                ) : (
                  <Save data-icon="inline-start" />
                )}
                Tạo đơn mua
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={purchaseDetailOpen && Boolean(detail)}
        onOpenChange={setPurchaseDetailOpen}
      >
        <DialogContent
          size="5xl"
          className="max-h-[90dvh] grid-rows-[auto_minmax(0,1fr)] overflow-hidden p-0"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Chi tiết đơn mua</DialogTitle>
            <DialogDescription>
              {detail?.poNumber ?? "Đang tải đơn mua..."}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto">
            {detail ? (
              <PurchaseOrderDetail
                detail={detail}
                loading={detailQuery.isFetching}
                supplierLabel={getPurchaseOrderSupplierLabel(detail)}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={grnDialogOpen}
        onOpenChange={(open) => {
          setGrnDialogOpen(open);
          if (!open) {
            setGrnImages([]);
            setGrnItemForms([]);
            setGrnPurchaseOrderId("");
            setGrnEditTarget(undefined);
          }
        }}
      >
        <DialogContent
          size="2xl"
          className="grid max-h-[90dvh] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0"
        >
          <DialogHeader className="gap-1 border-b px-5 py-4">
            <DialogTitle>
              {grnEditTarget ? "Chỉnh sửa phiếu nhập" : "Tạo phiếu nhập"}
            </DialogTitle>
            <DialogDescription>
              {grnEditTarget
                ? `Cập nhật ${grnEditTarget.grnNumber} theo lý do từ chối rồi gửi duyệt lại.`
                : "Chọn đơn mua rồi nhập số lượng hàng thực nhận."}
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto]"
            onSubmit={handleCreateGrn}
          >
            <div className="min-h-0 space-y-5 overflow-y-auto px-5 py-4">
              <section className="space-y-3">
                <SelectField
                  disabled={
                    !canCreateGoodsReceiptNote ||
                    Boolean(grnEditTarget) ||
                    createGrnMutation.isPending ||
                    receivingPurchaseOrdersQuery.isLoading ||
                    receivingPurchaseOrders.length === 0
                  }
                  label="Đơn mua"
                  value={grnPurchaseOrderId}
                  onChange={handleGrnPurchaseOrderChange}
                >
                  {receivingPurchaseOrdersQuery.isLoading ? (
                    <SelectItem disabled value="_loading">
                      Đang tải danh sách đơn mua...
                    </SelectItem>
                  ) : receivingPurchaseOrders.length === 0 ? (
                    <SelectItem disabled value="_empty">
                      Chưa có đơn mua nào chờ nhập
                    </SelectItem>
                  ) : (
                    receivingPurchaseOrders.map((purchaseOrder) => (
                      <SelectItem
                        key={purchaseOrder.id}
                        value={purchaseOrder.id}
                      >
                        {getPurchaseOrderSelectLabel(purchaseOrder)}
                      </SelectItem>
                    ))
                  )}
                </SelectField>
                {grnPurchaseOrder ? (
                  <div className="grid gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm sm:grid-cols-[1.1fr_1.4fr_auto_auto]">
                    <InfoBox
                      label="Số đơn mua"
                      value={grnPurchaseOrder.poNumber}
                    />
                    <InfoBox
                      label="NCC"
                      title={grnPurchaseOrderSupplierLabel}
                      value={grnPurchaseOrderSupplierLabel}
                    />
                    <InfoBox
                      label="Ngày dự kiến"
                      nowrap
                      value={formatDate(grnPurchaseOrder.expectedDate)}
                    />
                    <InfoBox
                      label="Số dòng hàng"
                      nowrap
                      value={String(grnPurchaseOrder.items?.length ?? 0)}
                    />
                  </div>
                ) : null}
              </section>

              <section className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-sm font-semibold">Hàng thực nhận</h3>
                  {grnItemForms.length > 0 ? (
                    <span className="text-xs text-muted-foreground">
                      {grnItemForms.length} dòng hàng
                    </span>
                  ) : null}
                </div>
                <div className="space-y-3">
                  {grnItemForms.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      Chọn một đơn mua để hiển thị dòng hàng cần nhập.
                    </div>
                  ) : null}
                  {grnItemForms.map((item, index) => (
                    <GoodsReceiptItemFields
                      index={index}
                      item={item}
                      key={`${item.itemId}-${index}`}
                      onChange={(next) =>
                        setGrnItemForms((current) =>
                          current.map((currentItem, itemIndex) =>
                            itemIndex === index ? next : currentItem,
                          ),
                        )
                      }
                    />
                  ))}
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Ảnh minh chứng</h3>
                <EvidenceImagePicker
                  disabled={
                    !canCreateGoodsReceiptNote || createGrnMutation.isPending
                  }
                  files={grnImages}
                  id="goods-receipt-images"
                  label={
                    grnPurchaseOrder
                      ? `Ảnh minh chứng cho ${grnPurchaseOrder.poNumber}`
                      : "Ảnh minh chứng nhận hàng"
                  }
                  onChange={setGrnImages}
                />
                {grnEditTarget?.images?.length ? (
                  <p className="text-xs text-muted-foreground">
                    Phiếu đang có {grnEditTarget.images.length} ảnh đã lưu. Ảnh
                    chọn ở đây sẽ được bổ sung thêm.
                  </p>
                ) : null}
                {grnPurchaseOrder ? (
                  <p className="text-xs text-muted-foreground">
                    Ảnh sẽ được lưu vào phiếu nhập tạo từ{" "}
                    {grnPurchaseOrder.poNumber} của{" "}
                    {grnPurchaseOrderSupplierLabel}.
                  </p>
                ) : null}
              </section>
            </div>
            <DialogFooter className="mx-0 mb-0 rounded-b-xl">
              <Button
                disabled={
                  !canCreateGoodsReceiptNote ||
                  !grnPurchaseOrder ||
                  createGrnMutation.isPending ||
                  grnItemForms.length === 0
                }
                type="submit"
              >
                {createGrnMutation.isPending ? (
                  <LoaderCircle
                    className="animate-spin"
                    data-icon="inline-start"
                  />
                ) : (
                  <Save data-icon="inline-start" />
                )}
                {grnEditTarget ? "Lưu chỉnh sửa" : "Tạo phiếu nhập"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {selectedGoodsReceiptNote ? (
        <GoodsReceiptNoteDetailDialog
          grn={selectedGoodsReceiptNote}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedGoodsReceiptNote(undefined);
            }
          }}
        />
      ) : null}
    </div>
  );
}

function SelectField({
  children,
  disabled,
  label,
  onChange,
  value,
}: {
  children: ReactNode;
  disabled: boolean;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select disabled={disabled} value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label} className="w-full">
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  );
}

function PurchaseOrderTable({
  onSelect,
  purchaseOrders,
  selectedId,
}: {
  onSelect: (purchaseOrder: PurchaseOrder) => void;
  purchaseOrders: PurchaseOrder[];
  selectedId: string;
}) {
  return (
    <Table scrollable>
      <TableHeader>
        <TableRow>
          <TableHead>Số đơn mua</TableHead>
          <TableHead>NCC</TableHead>
          <TableHead>Mặt hàng</TableHead>
          <TableHead>Trạng thái</TableHead>
          <TableHead>Ngày tạo</TableHead>
          <TableHead className="w-36 text-right">Thao tác</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {purchaseOrders.length === 0 ? (
          <EmptyRow colSpan={6} label="Chưa có đơn mua." />
        ) : (
          purchaseOrders.map((purchaseOrder) => (
            <TableRow
              className={cn(
                "cursor-pointer",
                selectedId === purchaseOrder.id && "bg-primary/5",
              )}
              key={purchaseOrder.id}
              onClick={() => onSelect(purchaseOrder)}
            >
              <TableCell className="font-medium">
                {purchaseOrder.poNumber}
              </TableCell>
              <TableCell>
                {getPurchaseOrderSupplierLabel(purchaseOrder)}
              </TableCell>
              <TableCell className="max-w-64">
                <span className="line-clamp-2 text-sm text-muted-foreground">
                  {purchaseOrder.items
                    .map((item) => item.itemName || item.sku)
                    .join(", ")}
                </span>
              </TableCell>
              <TableCell>
                <StatusBadge tone={statusTone(purchaseOrder.status)}>
                  {statusLabel(purchaseOrder.status)}
                </StatusBadge>
              </TableCell>
              <TableCell>{formatDate(purchaseOrder.orderDate)}</TableCell>
              <TableCell>
                <div className="flex justify-end">
                  <Button
                    aria-label={`Xem chi tiết đơn mua ${purchaseOrder.poNumber}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect(purchaseOrder);
                    }}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Eye data-icon="inline-start" />
                    Xem chi tiết
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

function PurchaseOrderItemFields({
  availableItems,
  disabled,
  index,
  item,
  loadError,
  loading,
  onChange,
  onRemove,
  supplierItemByItemId,
}: {
  availableItems: WarehouseItem[];
  disabled: boolean;
  index: number;
  item: PurchaseOrderItemForm;
  loadError: unknown;
  loading: boolean;
  onChange: (item: PurchaseOrderItemForm) => void;
  onRemove: () => void;
  supplierItemByItemId: Map<string, SupplierItem>;
}) {
  const itemId = `purchase-item-${index}`;

  return (
    <div className="grid gap-3 rounded-lg border border-border/70 bg-muted/20 p-3 sm:grid-cols-2 lg:grid-cols-12">
      <div className="min-w-0 space-y-2 sm:col-span-2 lg:col-span-3">
        <Label htmlFor={`${itemId}-picker`}>Mặt hàng</Label>
        <WarehouseItemCombobox
          disabled={disabled}
          id={`${itemId}-picker`}
          items={availableItems}
          label={`Mặt hàng dòng ${index + 1}`}
          loadError={loadError}
          loading={loading}
          placeholder={disabled ? "Chọn nhà cung cấp trước" : "Chọn mặt hàng"}
          presentation="name-sku"
          selectedItemId={item.itemId}
          selectedSku={item.sku}
          onSelect={(stockItem) => {
            const supplierItem = supplierItemByItemId.get(stockItem.id);
            const alternateUnit = stockItem.altUnits?.find(
              (candidate) => candidate.unit !== "thùng",
            );
            onChange({
              ...item,
              expectedQty: String(Math.max(1, supplierItem?.minOrderQty ?? 1)),
              itemId: stockItem.id,
              itemDepth: stockItem.depth ?? undefined,
              itemHeight: stockItem.height ?? undefined,
              itemWidth: stockItem.width ?? undefined,
              packageFactor: String(
                alternateUnit?.factor ?? alternateUnit?.quantity ?? 1,
              ),
              packageUnit: alternateUnit?.unit ?? "cái",
              sku: stockItem.sku,
              unit: "thùng",
              unitPrice: String(supplierItem?.purchasePrice ?? 0),
            });
          }}
        />
      </div>
      <div className="min-w-0 space-y-2 lg:col-span-3">
        <Label htmlFor={`${itemId}-sku`}>SKU</Label>
        <Input
          aria-label={`SKU dòng ${index + 1}`}
          className="bg-muted/50 font-mono text-muted-foreground"
          id={`${itemId}-sku`}
          placeholder="SKU"
          readOnly
          required
          value={item.sku}
        />
      </div>
      <div className="min-w-0 space-y-2 lg:col-span-2">
        <Label htmlFor={`${itemId}-quantity`}>Số thùng đặt</Label>
        <Input
          aria-label={`Số thùng đặt dòng ${index + 1}`}
          id={`${itemId}-quantity`}
          min="1"
          required
          step="1"
          type="number"
          value={item.expectedQty}
          onChange={(event) =>
            onChange({ ...item, expectedQty: event.target.value })
          }
        />
      </div>
      <div className="min-w-0 space-y-2 lg:col-span-1">
        <Label htmlFor={`${itemId}-unit`}>Đơn vị</Label>
        <Input
          aria-label={`Đơn vị dòng ${index + 1}`}
          className="bg-muted/50 text-muted-foreground"
          id={`${itemId}-unit`}
          readOnly
          value={item.unit}
        />
      </div>
      <div className="min-w-0 space-y-2 lg:col-span-2">
        <Label htmlFor={`${itemId}-price`}>Đơn giá</Label>
        <Input
          aria-label={`Đơn giá dòng ${index + 1}`}
          id={`${itemId}-price`}
          min="0"
          type="number"
          value={item.unitPrice}
          onChange={(event) =>
            onChange({ ...item, unitPrice: event.target.value })
          }
        />
      </div>
      <div className="flex items-end justify-end lg:col-span-1">
        <Button
          aria-label={`Xóa dòng ${index + 1}`}
          onClick={onRemove}
          size="icon-sm"
          type="button"
          variant="destructive"
        >
          <Trash2 />
        </Button>
      </div>
      <div className="border-t pt-3 sm:col-span-2 lg:col-span-12">
        <div className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            Quy cách mặt hàng:
          </span>{" "}
          1 thùng = {item.packageFactor || "1"} {item.packageUnit || "cái"} ·{" "}
          {item.itemDepth ?? "—"} × {item.itemWidth ?? "—"} ×{" "}
          {item.itemHeight ?? "—"} cm
        </div>
      </div>
    </div>
  );
}

function formatCurrency(value: number) {
  return `${value.toLocaleString("vi-VN")} đ`;
}

function PurchaseOrderDetail({
  detail,
  loading,
  supplierLabel,
}: {
  detail: PurchaseOrder;
  loading: boolean;
  supplierLabel: string;
}) {
  const items = (detail.items ?? []).map((item) => {
    const expectedQty = toSafeNumber(item.expectedQty);
    const unitPrice = toSafeNumber(item.unitPrice);
    return {
      ...item,
      expectedQty,
      unitPrice,
      lineTotal: expectedQty * unitPrice,
    };
  });
  const totalQty = items.reduce((sum, item) => sum + item.expectedQty, 0);
  const totalAmount = items.reduce((sum, item) => sum + item.lineTotal, 0);

  return (
    <div data-testid="purchase-order-invoice">
      {/* Invoice header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b bg-muted/30 px-6 py-5 pr-14 sm:px-8 sm:py-6 sm:pr-16">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShoppingCart className="size-5" />
          </div>
          <div>
            <div className="text-lg font-bold tracking-tight">ĐƠN ĐẶT HÀNG</div>
            <div className="font-mono text-sm text-muted-foreground">
              {detail.poNumber}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <StatusBadge tone={statusTone(detail.status)}>
            {statusLabel(detail.status)}
          </StatusBadge>
          {loading ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <LoaderCircle className="size-3 animate-spin" />
              Đang cập nhật
            </span>
          ) : null}
        </div>
      </div>

      <div className="space-y-6 px-6 py-6 sm:px-8">
        {/* Parties + dates, invoice-style two-column block */}
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Nhà cung cấp
            </div>
            <div className="text-sm font-semibold">{supplierLabel}</div>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:justify-items-end">
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Ngày tạo
              </div>
              <div className="text-sm font-medium">
                {formatDate(detail.orderDate)}
              </div>
            </div>
            <div className="space-y-1 sm:text-right">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Ngày dự kiến
              </div>
              <div className="text-sm font-medium">
                {formatDate(detail.expectedDate)}
              </div>
            </div>
          </div>
        </div>

        {detail.note ? (
          <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Ghi chú: </span>
            {detail.note}
          </div>
        ) : null}

        {/* Line items — invoice table */}
        <div className="overflow-hidden rounded-lg border">
          <Table scrollable>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-10">#</TableHead>
                <TableHead>Mặt hàng</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">SL</TableHead>
                <TableHead>Đơn vị</TableHead>
                <TableHead className="text-right">Đơn giá</TableHead>
                <TableHead className="text-right">Thành tiền</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => (
                <TableRow key={`${item.itemId}-${item.sku}`}>
                  <TableCell className="text-muted-foreground">
                    {index + 1}
                  </TableCell>
                  <TableCell className="font-medium">
                    {item.itemName ?? item.sku}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {item.sku}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.expectedQty}
                  </TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.unitPrice)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(item.lineTotal)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Totals summary, right-aligned like an invoice footer */}
        <div className="flex justify-end">
          <div className="w-full max-w-xs space-y-2 rounded-lg border bg-muted/20 px-4 py-3 text-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Số dòng hàng</span>
              <span>{items.length}</span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Tổng số lượng</span>
              <span>{totalQty}</span>
            </div>
            <div className="flex items-center justify-between border-t pt-2 text-base font-bold">
              <span>Tổng tiền</span>
              <span className="text-primary">
                {formatCurrency(totalAmount)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GoodsReceiptItemFields({
  index,
  item,
  onChange,
}: {
  index: number;
  item: GoodsReceiptItemForm;
  onChange: (item: GoodsReceiptItemForm) => void;
}) {
  const fieldId = `goods-receipt-item-${index}`;

  return (
    <div className="overflow-hidden rounded-lg border border-border/70">
      <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
          {index + 1}
        </span>
        <span className="truncate text-sm font-medium" title={item.itemName}>
          {item.itemName || "Chưa xác định mặt hàng"}
        </span>
        <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">
          {item.sku}
        </span>
        {item.isPerishable ? (
          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
            Có hạn sử dụng
          </span>
        ) : null}
      </div>
      {item.itemDepth && item.itemWidth && item.itemHeight ? (
        <div className="border-b bg-blue-50/70 px-3 py-2 text-xs text-blue-900">
          <span className="font-semibold">Quy cách 1 thùng:</span>{" "}
          {item.itemDepth} × {item.itemWidth} × {item.itemHeight} cm ·{" "}
          {(item.itemDepth * item.itemWidth * item.itemHeight).toLocaleString(
            "vi-VN",
          )}{" "}
          cm³/thùng
        </div>
      ) : (
        <div className="border-b bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
          Mặt hàng chưa khai đủ kích thước thùng. Hãy sửa master data trước khi
          gửi duyệt.
        </div>
      )}
      <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-12">
        <div className="min-w-0 space-y-2 lg:col-span-3">
          <Label htmlFor={`${fieldId}-packages`}>Số thùng thực nhận</Label>
          <Input
            aria-label={`Số thùng thực nhận dòng ${index + 1}`}
            id={`${fieldId}-packages`}
            min="0"
            step="1"
            type="number"
            value={item.actualQty}
            onChange={(event) =>
              onChange({ ...item, actualQty: event.target.value })
            }
          />
        </div>
        <div className="min-w-0 space-y-2 lg:col-span-3">
          <Label htmlFor={`${fieldId}-manufactured`}>
            Ngày sản xuất <span className="text-destructive">*</span>
          </Label>
          <Input
            aria-label={`Ngày sản xuất phiếu nhập dòng ${index + 1}`}
            id={`${fieldId}-manufactured`}
            max={todayInHoChiMinh()}
            required
            type="date"
            value={item.manufacturedDate}
            onChange={(event) => {
              const manufacturedDate = event.target.value;
              onChange({
                ...item,
                manufacturedDate,
                lotNumber: formatLotNumber(manufacturedDate, item.lotSequence),
              });
            }}
          />
        </div>
        <div className="min-w-0 space-y-2 lg:col-span-2">
          <Label htmlFor={`${fieldId}-lot-sequence`}>
            SEQ trong ngày <span className="text-destructive">*</span>
          </Label>
          <Input
            aria-label={`SEQ số lô phiếu nhập dòng ${index + 1}`}
            id={`${fieldId}-lot-sequence`}
            inputMode="numeric"
            max="999"
            min="1"
            placeholder="001"
            required
            step="1"
            type="number"
            value={item.lotSequence}
            onChange={(event) => {
              const lotSequence = event.target.value;
              onChange({
                ...item,
                lotSequence,
                lotNumber: formatLotNumber(item.manufacturedDate, lotSequence),
              });
            }}
          />
        </div>
        <div className="min-w-0 space-y-2 lg:col-span-4">
          <Label htmlFor={`${fieldId}-lot`}>
            Mã lô <span className="text-destructive">*</span>
          </Label>
          <Input
            aria-label={`Mã lô phiếu nhập dòng ${index + 1}`}
            className="font-mono font-semibold tracking-wide"
            id={`${fieldId}-lot`}
            placeholder="LOT-YYMMDD-SEQ"
            readOnly
            required
            value={item.lotNumber}
          />
        </div>
        <div className="min-w-0 space-y-2 lg:col-span-4">
          <Label htmlFor={`${fieldId}-expiry`}>
            Hạn sử dụng
            {item.isPerishable ? (
              <span className="text-destructive"> *</span>
            ) : null}
          </Label>
          <Input
            aria-label={`Hạn sử dụng phiếu nhập dòng ${index + 1}`}
            id={`${fieldId}-expiry`}
            required={item.isPerishable}
            type="date"
            value={item.expiryDate}
            onChange={(event) =>
              onChange({ ...item, expiryDate: event.target.value })
            }
          />
        </div>
        <div className="min-w-0 space-y-2 sm:col-span-2 lg:col-span-8">
          <Label htmlFor={`${fieldId}-note`}>Ghi chú</Label>
          <Input
            aria-label={`Ghi chú phiếu nhập dòng ${index + 1}`}
            id={`${fieldId}-note`}
            value={item.note}
            onChange={(event) =>
              onChange({ ...item, note: event.target.value })
            }
          />
        </div>
      </div>
    </div>
  );
}

function InfoBox({
  label,
  nowrap,
  title,
  value,
}: {
  label: string;
  nowrap?: boolean;
  title?: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-1 text-sm font-semibold",
          nowrap ? "truncate" : "line-clamp-2",
        )}
        title={title}
      >
        {value}
      </div>
    </div>
  );
}
