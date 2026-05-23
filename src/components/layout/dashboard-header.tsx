import { Bell, Search } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DashboardHeader() {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/95 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 max-w-xl pl-8"
            placeholder="Tìm SKU, phiếu nhập, phiếu chuyển..."
          />
        </div>
        <Button size="icon" variant="outline" aria-label="Thông báo">
          <Bell />
        </Button>
        <Avatar>
          <AvatarFallback>PB</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
