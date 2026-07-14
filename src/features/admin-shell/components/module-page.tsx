"use client";

import { Clock3, Eye, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
    description: "Quản lý kho trung tâm, khu vực, dãy kệ và mã vị trí.",
    action: "Tạo kho",
    highlights: ["Kho trung tâm", "Khu vực / dãy / vị trí", "Địa chỉ"],
    tableTitle: "Danh sách kho",
    columns: ["Tên kho", "Loại kho", "Trạng thái"],
    roleNotes: {
      ADMIN: "Quản trị viên quản lý cấu trúc kho và phạm vi làm việc của nhân viên.",
      MANAGER: "Quản lý xem năng lực kho và điều phối vận hành.",
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
      ADMIN: "Quản trị viên quản lý mã hàng dùng chung cho toàn hệ thống.",
      MANAGER: "Quản lý theo dõi mã hàng phục vụ nhập, xuất và báo cáo.",
      PRINTER: "Nhân viên in theo dõi ly chưa in và ly đã in.",
    },
  },
  inventory: {
    title: "Tồn kho",
    description: "Theo dõi số lượng tồn kho, đã đặt trước và khả dụng.",
    action: "Xem sổ tồn kho",
    highlights: ["Sổ tồn kho", "Biến động tồn", "Lịch sử đối chiếu"],
    tableTitle: "Sổ tồn kho",
    columns: ["SKU", "Kho", "Khả dụng"],
    roleNotes: {
      ADMIN: "Quản trị viên xem toàn bộ số lượng tồn, đã đặt trước và khả dụng.",
      MANAGER: "Quản lý dùng sổ tồn kho để điều phối và duyệt điều chỉnh.",
      RECEIVER: "Nhân viên nhận hàng đối chiếu tồn sau khi nhập và cất hàng.",
      PICKER: "Nhân viên soạn hàng xem vị trí và lượng khả dụng trước khi xuất.",
      PRINTER: "Nhân viên in kiểm tra tồn ly chưa in và ly đã in.",
      COUNTER: "Nhân viên kiểm kê dùng sổ tồn kho để đối chiếu số thực tế.",
    },
  },
  purchases: {
    title: "Nhập hàng",
    description: "Quản lý đơn mua hàng và phiếu nhập kho.",
    action: "Tạo đơn mua",
    highlights: ["Đơn mua", "Phiếu nhập", "Nhà cung cấp"],
    tableTitle: "Phiếu nhập",
    columns: ["Mã phiếu", "Nhà cung cấp", "Trạng thái"],
    roleNotes: {
      ADMIN: "Quản trị viên theo dõi và xử lý toàn bộ quy trình nhập hàng.",
      MANAGER: "Quản lý tạo đơn mua, kiểm tra chênh lệch và duyệt phiếu nhập.",
      RECEIVER: "Nhân viên nhận hàng tạo, xác nhận phiếu nhập và chuyển hàng đi cất.",
    },
  },
  "goods-issues": {
    title: "Xuất kho",
    description: "Soạn hàng, quét SKU và vị trí kệ trước khi xác nhận xuất kho.",
    action: "Tạo phiếu xuất",
    highlights: ["Phiếu xuất", "Ưu tiên hạn dùng", "Quét mã xác nhận"],
    tableTitle: "Phiếu xuất kho",
    columns: ["Mã phiếu", "Mã đơn hàng", "Trạng thái"],
    roleNotes: {
      ADMIN: "Quản trị viên theo dõi toàn bộ quy trình xuất kho.",
      MANAGER: "Quản lý tạo phiếu xuất và theo dõi trạng thái xuất kho.",
      PICKER: "Nhân viên soạn hàng quét SKU, quét vị trí kệ và xác nhận xuất kho.",
    },
  },
  adjustments: {
    title: "Kiểm kê",
    description: "Kiểm kê và điều chỉnh số lượng tồn kho.",
    action: "Tạo điều chỉnh",
    highlights: ["Phiếu kiểm", "Điều chỉnh tồn", "Hủy hàng"],
    tableTitle: "Phiếu điều chỉnh",
    columns: ["Mã phiếu", "Kho", "Loại"],
    roleNotes: {
      ADMIN: "Quản trị viên theo dõi toàn bộ quy trình kiểm kê và điều chỉnh tồn.",
      MANAGER: "Quản lý tạo phiếu kiểm và duyệt điều chỉnh.",
      COUNTER: "Nhân viên kiểm kê đếm thực tế và ghi nhận chênh lệch.",
    },
  },
  suppliers: {
    title: "Nhà cung cấp",
    description: "Thông tin nhà cung cấp và lịch sử giao dịch.",
    action: "Thêm NCC",
    highlights: ["Liên hệ", "Địa chỉ", "Lịch sử đơn mua"],
    tableTitle: "Danh sách nhà cung cấp",
    columns: ["Tên", "Liên hệ", "Trạng thái"],
    roleNotes: {
      ADMIN: "Quản trị viên quản lý dữ liệu nhà cung cấp.",
      MANAGER: "Quản lý dùng lịch sử giao dịch để tạo và theo dõi đơn mua.",
      RECEIVER: "Nhân viên nhận hàng xem nhà cung cấp để đối chiếu phiếu nhập.",
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
      ADMIN: "Quản trị viên xem báo cáo toàn hệ thống.",
      MANAGER: "Quản lý theo dõi tồn kho, nhập xuất và giá trị kho.",
    },
  },
  "print-jobs": {
    title: "In ly",
    description: "Xử lý các đơn in ly đã thanh toán.",
    action: "Làm mới",
    highlights: ["Từ đơn đã thanh toán", "Tiêu thụ ly chưa in", "Xác nhận in xong"],
    tableTitle: "Đơn in ly",
    columns: ["Mã đơn in", "Mã đơn hàng", "Trạng thái"],
    roleNotes: {
      ADMIN: "Theo dõi toàn bộ quy trình in ly theo đơn.",
      MANAGER: "Xem tiến độ in ly từ các đơn đã thanh toán.",
      PRINTER:
        "Nhân viên in quét SKU, quét vị trí, in ly và xác nhận hoàn thành.",
    },
  },
  settings: {
    title: "Cài đặt",
    description: "Người dùng, vai trò và cấu hình vận hành.",
    action: "Cấu hình",
    highlights: ["Đơn vị vận hành", "Vai trò", "Kết nối hệ thống"],
    tableTitle: "Cấu hình",
    columns: ["Nhóm", "Giá trị", "Trạng thái"],
    roleNotes: {
      ADMIN: "Quản trị viên quản lý đơn vị vận hành, người dùng và phân quyền.",
      MANAGER: "Quản lý xem cấu hình vận hành liên quan điều phối.",
    },
  },
} as const;

type ModuleKey = keyof typeof moduleSummaries;

const roleActionLabels: Partial<Record<ModuleKey, Partial<Record<WmsRole, string>>>> = {
  purchases: {
    RECEIVER: "Xác nhận phiếu nhập",
    MANAGER: "Tạo đơn mua",
  },
  "goods-issues": {
    PICKER: "Xác nhận xuất kho",
    MANAGER: "Tạo phiếu xuất",
  },
  adjustments: {
    COUNTER: "Nhập kết quả đếm",
    MANAGER: "Tạo điều chỉnh",
  },
  "print-jobs": {
    PRINTER: "Xác nhận in xong",
    MANAGER: "Làm mới",
  },
};

function getRoleNote(moduleKey: ModuleKey, role: WmsRole) {
  const roleNotes = moduleSummaries[moduleKey].roleNotes as Partial<
    Record<WmsRole, string>
  >;

  return (
    roleNotes[role] ?? "Bạn có quyền xem dữ liệu mục này theo vai trò hiện tại."
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
          <h1 className="flex items-center gap-3 text-2xl font-bold tracking-normal">
            {summary.title}
            <Badge variant="outline" className="text-xs">{ROLE_LABELS[primaryRole]}</Badge>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {summary.description}
          </p>

        </div>
        {canUsePrimaryAction ? (
          <Button disabled>
            <Plus data-icon="inline-start" />
            {actionLabel}
            <Clock3 data-icon="inline-end" />
          </Button>
        ) : (
          <Badge className="h-8 rounded-lg px-3" variant="outline">
            <Eye data-icon="inline-start" />
            Chế độ xem
          </Badge>
        )}
      </div>

      <Card>

        <CardContent className="pt-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {summary.highlights.map((item) => (
              <div
                className="rounded-lg border border-border/70 bg-muted/20 p-3"
                key={item}
              >
                <div className="text-sm font-semibold text-foreground">
                  {item}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{roleNote}</p>
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
                  {"Chưa có dữ liệu."}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
