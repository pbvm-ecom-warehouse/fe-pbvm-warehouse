"use client";

import { ArrowUpRight, Eye, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSessionUser } from "@/hooks/use-session-user";
import {
  getDefaultRoleFocus,
  hasModuleActionAccess,
  ROLE_LABELS,
  type WmsRole,
} from "@/lib/rbac";

const moduleSummaries = {
  warehouses: {
    title: "Kho",
    description: "Quản lý kho trung tâm, zone, rack và shelf barcode.",
    action: "Tạo kho",
    highlights: ["Kho trung tâm", "Zone / Rack / Shelf", "Địa chỉ"],
    tableTitle: "Danh sách kho",
    columns: ["Tên kho", "Loại kho", "Trạng thái"],
    roleNotes: {
      ADMIN: "Admin có thể quản lý cấu trúc kho và scope người dùng.",
      MANAGER: "Manager xem năng lực kho và điều phối vận hành.",
    },
  },
  products: {
    title: "Sản phẩm",
    description: "Quản lý nguyên liệu, ly chưa in và ly đã in.",
    action: "Tạo SKU",
    highlights: ["Nguyên liệu", "Ly chưa in", "Ly đã in"],
    tableTitle: "Danh sách sản phẩm",
    columns: ["SKU", "Tên sản phẩm", "Nhóm"],
    roleNotes: {
      ADMIN: "Admin quản lý SKU nền cho toàn hệ thống.",
      MANAGER: "Manager theo dõi SKU phục vụ PO, transfer và báo cáo.",
      PRINTER: "Printer tập trung CUP_BLANK và CUP_PRINTED phục vụ lệnh in.",
    },
  },
  inventory: {
    title: "Tồn kho",
    description: "Theo dõi quantity, reserved_qty và available_qty.",
    action: "Xem ledger",
    highlights: ["Stock ledger", "Stock movement", "Audit trail"],
    tableTitle: "Stock ledger",
    columns: ["SKU", "Kho", "Available"],
    roleNotes: {
      ADMIN: "Admin xem toàn bộ quantity, reserved_qty và available_qty.",
      MANAGER: "Manager dùng ledger để điều phối và duyệt adjustment.",
      RECEIVER: "Receiver đối chiếu tồn sau GRN, put-away và transfer-in.",
      PICKER: "Picker xem vị trí và available trước khi xuất kho.",
      PRINTER: "Printer kiểm tra tồn CUP_BLANK và CUP_PRINTED quanh Print Job.",
      COUNTER: "Counter dùng ledger làm baseline kiểm đếm thực tế.",
    },
  },
  purchases: {
    title: "Nhập hàng",
    description: "Purchase order và phiếu nhập kho GRN.",
    action: "Tạo PO",
    highlights: ["PO", "GRN", "Nhà cung cấp"],
    tableTitle: "Phiếu nhập",
    columns: ["Mã phiếu", "Nhà cung cấp", "Trạng thái"],
    roleNotes: {
      ADMIN: "Admin có toàn quyền với PO và GRN.",
      MANAGER: "Manager tạo PO, kiểm tra chênh lệch và duyệt GRN.",
      RECEIVER: "Receiver tạo/xác nhận GRN và chuyển hàng sang put-away.",
    },
  },
  transfers: {
    title: "Chuyển kho",
    description: "",
    action: "Tạo phiếu",
    highlights: ["TRANSFER_OUT", "TRANSFER_IN", "IN_TRANSIT"],
    tableTitle: "Phiếu chuyển kho",
    columns: ["Mã phiếu", "Từ kho", "Đến kho"],
    roleNotes: {
      ADMIN: "Admin có toàn quyền với transfer liên kho.",
      MANAGER: "Manager tạo, xác nhận và duyệt transfer.",
      PICKER: "Picker xử lý transfer-out tại kho nguồn.",
      RECEIVER: "Receiver xử lý transfer-in tại kho đích.",
    },
  },
  adjustments: {
    title: "Kiểm kê",
    description: "Điều chỉnh thừa thiếu qua stock movement.",
    action: "Tạo điều chỉnh",
    highlights: ["ADJUST_PLUS", "ADJUST_MINUS", "Ref audit"],
    tableTitle: "Phiếu điều chỉnh",
    columns: ["Mã phiếu", "Kho", "Loại"],
    roleNotes: {
      ADMIN: "Admin có toàn quyền với kiểm kê và adjustment.",
      MANAGER: "Manager tạo phiếu kiểm và duyệt điều chỉnh.",
      COUNTER: "Counter kiểm đếm thực tế và ghi nhận chênh lệch.",
    },
  },
  suppliers: {
    title: "Nhà cung cấp",
    description: "Thông tin nhà cung cấp và lịch sử giao dịch.",
    action: "Thêm NCC",
    highlights: ["Liên hệ", "Địa chỉ", "PO history"],
    tableTitle: "Danh sách nhà cung cấp",
    columns: ["Tên", "Liên hệ", "Trạng thái"],
    roleNotes: {
      ADMIN: "Admin quản lý dữ liệu nhà cung cấp.",
      MANAGER: "Manager dùng supplier history để tạo và theo dõi PO.",
      RECEIVER: "Receiver xem nhà cung cấp để đối chiếu GRN khi nhận hàng.",
    },
  },
  reports: {
    title: "Báo cáo",
    description: "Báo cáo tồn kho, nhập xuất và giá trị kho.",
    action: "Tạo báo cáo",
    highlights: ["Tồn kho", "Nhập xuất", "Giá trị kho"],
    tableTitle: "Báo cáo gần đây",
    columns: ["Tên báo cáo", "Kỳ", "Cập nhật"],
    roleNotes: {
      ADMIN: "Admin xem báo cáo toàn tenant.",
      MANAGER: "Manager theo dõi tồn kho, nhập xuất và giá trị kho.",
    },
  },
  "print-jobs": {
    title: "Lệnh in ly",
    description: "Theo dõi print.requested, blank cup hold và output CUP_PRINTED.",
    action: "Tạo lệnh in",
    highlights: ["PRINT_CONSUME", "PRINT_OUTPUT", "Design snapshot"],
    tableTitle: "Danh sách Print Job",
    columns: ["Mã lệnh in", "Order ref", "Trạng thái"],
    roleNotes: {
      ADMIN: "Admin có toàn quyền với luồng in ly make-to-order.",
      MANAGER: "Manager nhận print.requested và mở Print Job với designFile snapshot.",
      PRINTER: "Printer tiêu thụ CUP_BLANK, xác nhận PRINT_OUTPUT và đóng job.",
    },
  },
  settings: {
    title: "Cài đặt",
    description: "Tenant, người dùng và cấu hình vận hành.",
    action: "Cấu hình",
    highlights: ["Tenant", "Vai trò", "API"],
    tableTitle: "Cấu hình",
    columns: ["Nhóm", "Giá trị", "Trạng thái"],
    roleNotes: {
      ADMIN: "Admin quản lý tenant, người dùng và role assignment.",
      MANAGER: "Manager xem cấu hình vận hành liên quan điều phối.",
    },
  },
} as const;

type ModuleKey = keyof typeof moduleSummaries;

const roleActionLabels: Partial<Record<ModuleKey, Partial<Record<WmsRole, string>>>> = {
  purchases: {
    RECEIVER: "Xác nhận GRN",
    MANAGER: "Tạo PO",
  },
  transfers: {
    PICKER: "Xử lý transfer-out",
    RECEIVER: "Nhận transfer-in",
    MANAGER: "Tạo phiếu",
  },
  adjustments: {
    COUNTER: "Nhập kết quả đếm",
    MANAGER: "Tạo điều chỉnh",
  },
  "print-jobs": {
    PRINTER: "Xác nhận in xong",
    MANAGER: "Tạo lệnh in",
  },
};

function getRoleNote(moduleKey: ModuleKey, role: WmsRole) {
  const roleNotes = moduleSummaries[moduleKey].roleNotes as Partial<
    Record<WmsRole, string>
  >;

  return (
    roleNotes[role] ?? "Bạn có quyền xem dữ liệu module này theo role hiện tại."
  );
}

function getActionLabel(moduleKey: ModuleKey, role: WmsRole) {
  return roleActionLabels[moduleKey]?.[role] ?? moduleSummaries[moduleKey].action;
}

export function ModulePage({ moduleKey }: { moduleKey: ModuleKey }) {
  const summary = moduleSummaries[moduleKey];
  const user = useSessionUser();
  const primaryRole = getDefaultRoleFocus(user?.roles);
  const canUsePrimaryAction = hasModuleActionAccess(moduleKey, user?.roles);
  const actionLabel = getActionLabel(moduleKey, primaryRole);
  const roleNote = getRoleNote(moduleKey, primaryRole);

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-normal">
            {summary.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {summary.description}
          </p>
          <p className="mt-2 max-w-3xl text-xs font-medium text-primary">
            {ROLE_LABELS[primaryRole]} · {roleNote}
          </p>
        </div>
        {canUsePrimaryAction ? (
          <Button>
            <Plus data-icon="inline-start" />
            {actionLabel}
          </Button>
        ) : (
          <Badge className="h-8 rounded-lg px-3" variant="outline">
            <Eye data-icon="inline-start" />
            Chế độ xem
          </Badge>
        )}
      </div>

      <Card>
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="flex items-center gap-2 text-lg">
            {summary.title}
            <ArrowUpRight className="size-4 text-primary" />
          </CardTitle>
          <CardDescription>{summary.description}</CardDescription>
          <CardAction>
            <Badge variant="outline">{ROLE_LABELS[primaryRole]}</Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            {summary.highlights.map((item) => (
              <div
                className="rounded-lg border border-border/70 bg-muted/20 p-3"
                key={item}
              >
                <div className="text-sm font-semibold text-foreground">
                  {item}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {roleNote}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>{summary.tableTitle}</CardTitle>
          
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                {summary.columns.map((column) => (
                  <TableHead key={column}>{column}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell
                  className="h-24 text-center text-sm text-muted-foreground"
                  colSpan={summary.columns.length}
                >
                  Chưa có dữ liệu từ wms-api cho role {ROLE_LABELS[primaryRole]}.
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
