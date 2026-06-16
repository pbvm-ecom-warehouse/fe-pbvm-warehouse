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
    return { label: "Hết hàng", variant: "destructive" as const };
  }

  if (status === "low") {
    return { label: "Sắp hết", variant: "secondary" as const };
  }

  return { label: "Ổn định", variant: "outline" as const };
}

export function InventoryTable({ rows }: { rows: StockLedgerRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>SKU</TableHead>
          <TableHead>Kho</TableHead>
          <TableHead className="text-right">Quantity</TableHead>
          <TableHead className="text-right">Reserved</TableHead>
          <TableHead className="text-right">Available</TableHead>
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
              Chưa có dữ liệu tồn kho từ wms-api.
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
                <div className="font-medium">{row.productSku}</div>
                <div className="text-xs text-muted-foreground">
                  {row.productName}
                </div>
              </TableCell>
              <TableCell>{row.warehouseName}</TableCell>
              <TableCell className="text-right">{row.quantity}</TableCell>
              <TableCell className="text-right">{reservedQty}</TableCell>
              <TableCell className="text-right font-medium">
                {Math.max(availableQty, 0)}
              </TableCell>
              <TableCell>
                <Badge variant={status.variant}>{status.label}</Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
