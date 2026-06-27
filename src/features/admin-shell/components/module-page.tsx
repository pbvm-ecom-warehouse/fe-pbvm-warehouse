import { Plus } from "lucide-react";

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

const moduleSummaries = {
  warehouses: {
    title: "Kho",
    description: "Quản lý kho trung tâm và kho chi nhánh.",
    action: "Tạo kho",
    highlights: ["Kho trung tâm", "Kho chi nhánh", "Địa chỉ"],
    tableTitle: "Danh sách kho",
    columns: ["Tên kho", "Loại kho", "Trạng thái"],
  },
  products: {
    title: "Sản phẩm",
    description: "Quản lý nguyên liệu, ly chưa in và ly đã in.",
    action: "Tạo SKU",
    highlights: ["Nguyên liệu", "Ly chưa in", "Ly đã in"],
    tableTitle: "Danh sách sản phẩm",
    columns: ["SKU", "Tên sản phẩm", "Nhóm"],
  },
  inventory: {
    title: "Tồn kho",
    description: "Theo dõi quantity, reserved_qty và available_qty.",
    action: "Xem ledger",
    highlights: ["Stock ledger", "Stock movement", "Audit trail"],
    tableTitle: "Stock ledger",
    columns: ["SKU", "Kho", "Available"],
  },
  purchases: {
    title: "Nhập hàng",
    description: "Purchase order và phiếu nhập kho GRN.",
    action: "Tạo PO",
    highlights: ["PO", "GRN", "Nhà cung cấp"],
    tableTitle: "Phiếu nhập",
    columns: ["Mã phiếu", "Nhà cung cấp", "Trạng thái"],
  },
  "goods-issues": {
    title: "Xuất kho",
    description: "Soạn hàng, quét SKU + shelf và xác nhận Goods Issue.",
    action: "Tạo phiếu xuất",
    highlights: ["Goods Issue", "FEFO", "Barcode confirm"],
    tableTitle: "Phiếu xuất kho",
    columns: ["Mã phiếu", "Order ref", "Trạng thái"],
  },
  adjustments: {
    title: "Kiểm kê",
    description: "Điều chỉnh thừa thiếu qua stock movement.",
    action: "Tạo điều chỉnh",
    highlights: ["Stock Count", "ADJUST", "SCRAP"],
    tableTitle: "Phiếu điều chỉnh",
    columns: ["Mã phiếu", "Kho", "Loại"],
  },
  suppliers: {
    title: "Nhà cung cấp",
    description: "Thông tin nhà cung cấp và lịch sử giao dịch.",
    action: "Thêm NCC",
    highlights: ["Liên hệ", "Địa chỉ", "PO history"],
    tableTitle: "Danh sách nhà cung cấp",
    columns: ["Tên", "Liên hệ", "Trạng thái"],
  },
  reports: {
    title: "Báo cáo",
    description: "Báo cáo tồn kho, nhập xuất và giá trị kho.",
    action: "Tạo báo cáo",
    highlights: ["Tồn kho", "Nhập xuất", "Giá trị kho"],
    tableTitle: "Báo cáo gần đây",
    columns: ["Tên báo cáo", "Kỳ", "Cập nhật"],
  },
  "cup-conversions": {
    title: "Convert ly",
    description: "Theo dõi chuyển CUP_BLANK sang CUP_PRINTED bằng lệnh in.",
    action: "Tạo convert",
    highlights: ["PRINT_CONSUME", "PRINT_OUTPUT", "Design snapshot"],
    tableTitle: "Chiến dịch in ly",
    columns: ["Mã chiến dịch", "SKU nguồn", "SKU đích"],
  },
  settings: {
    title: "Cài đặt",
    description: "Tenant, người dùng và cấu hình vận hành.",
    action: "Cấu hình",
    highlights: ["Tenant", "Vai trò", "API"],
    tableTitle: "Cấu hình",
    columns: ["Nhóm", "Giá trị", "Trạng thái"],
  },
} as const;

type ModuleKey = keyof typeof moduleSummaries;

export function ModulePage({ moduleKey }: { moduleKey: ModuleKey }) {
  const summary = moduleSummaries[moduleKey];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">
          {summary.title}
        </h1>
        <p className="text-sm text-muted-foreground">{summary.description}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{summary.title}</CardTitle>
          <CardDescription>{summary.description}</CardDescription>
          <CardAction>
            <Button>
              <Plus data-icon="inline-start" />
              {summary.action}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {summary.highlights.map((item) => (
              <Badge key={item} variant="secondary">
                {item}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{summary.tableTitle}</CardTitle>
          <CardDescription>
            Dữ liệu sẽ được lấy từ wms-api khi module nghiệp vụ được nối API.
          </CardDescription>
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
                  Chưa có dữ liệu từ wms-api.
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
