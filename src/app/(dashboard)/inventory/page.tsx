import Link from "next/link";
import { ArrowRight, Boxes, ClipboardCheck, PackageCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function InventoryPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-normal">
          Tồn kho
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tính năng tồn kho tổng hợp chưa sẵn sàng</CardTitle>
          <CardDescription>
            Bạn vẫn có thể vận hành qua mặt hàng, nhập hàng, cất hàng và xuất
            kho.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Button asChild variant="outline">
            <Link href="/products">
              <Boxes data-icon="inline-start" />
              Sản phẩm
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/purchases">
              <ClipboardCheck data-icon="inline-start" />
              Nhập hàng
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/goods-issues">
              <PackageCheck data-icon="inline-start" />
              Xuất kho
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
