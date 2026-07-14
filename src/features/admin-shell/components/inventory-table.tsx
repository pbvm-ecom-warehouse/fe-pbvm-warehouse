import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getStockStatus } from "@/features/inventory/utils/stock";
import type { StockLedgerRow } from "@/types/api";

function statusCopy(status: ReturnType<typeof getStockStatus>) {
  if (status === "out") {
    return {
      className: "bg-rose-50 text-rose-700",
      label: "Hết hàng",
      variant: "destructive" as const,
    };
  }

  if (status === "low") {
    return {
      className: "bg-amber-50 text-amber-700",
      label: "Sắp hết",
      variant: "secondary" as const,
    };
  }

  return {
    className: "bg-teal-50 text-teal-700",
    label: "Ổn định",
    variant: "outline" as const,
  };
}

export function InventoryTable({ rows }: { rows: StockLedgerRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>SKU</TableHead>
          <TableHead>Kho</TableHead>
          <TableHead className="text-right">Tồn thực tế</TableHead>
          <TableHead className="text-right">Đã giữ</TableHead>
          <TableHead className="text-right">Khả dụng</TableHead>
          <TableHead>Trạng thái</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell
              className="h-24 text-center text-sm text-muted-foreground"
              colSpan={6}
            >
              Chưa có dữ liệu tồn kho.
            </TableCell>
          </TableRow>
        ) : null}

        {rows.map((row) => {
          const reservedQty = row.reserved ?? row.reservedQty ?? 0;
          const availableQty = row.quantity - reservedQty;
          const status = statusCopy(
            getStockStatus(row.quantity, reservedQty, row.reorderPoint),
          );

          return (
            <TableRow key={row.id}>
              <TableCell>
                <div className="font-mono font-semibold text-primary">
                  {row.productSku}
                </div>
                <div className="text-xs text-muted-foreground">
                  {row.productName}
                </div>
              </TableCell>
              <TableCell className="font-medium">{row.warehouseName}</TableCell>
              <TableCell className="font-mono text-right font-semibold">
                {row.quantity}
              </TableCell>
              <TableCell className="font-mono text-right font-semibold text-amber-700">
                {reservedQty}
              </TableCell>
              <TableCell className="font-mono text-right font-bold text-foreground">
                {Math.max(availableQty, 0)}
              </TableCell>
              <TableCell>
                <Badge className={status.className} variant={status.variant}>
                  {status.label}
                </Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
