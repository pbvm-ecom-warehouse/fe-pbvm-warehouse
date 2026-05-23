import Link from "next/link";
import { Boxes } from "lucide-react";

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

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-teal-700 text-white">
            <Boxes className="size-5" />
          </div>
          <CardTitle>Đăng nhập WMS</CardTitle>
          <CardDescription>
            Truy cập dashboard kho, tồn kho, nhập hàng và chuyển kho.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="ops@pbvm.example" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mật khẩu</Label>
              <Input id="password" type="password" placeholder="••••••••" />
            </div>
            <Button asChild className="w-full">
              <Link href="/dashboard">Vào dashboard</Link>
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
