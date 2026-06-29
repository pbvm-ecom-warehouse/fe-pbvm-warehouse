"use client";

import { Bell, ChevronDown, Menu, ScanLine, Search } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SidebarContent } from "@/components/layout/app-sidebar";
import { useSessionUser } from "@/hooks/use-session-user";
import { getDefaultRoleFocus, ROLE_LABELS } from "@/lib/rbac";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

const roleSearchPlaceholder = {
  ADMIN: "Tìm SKU, phiếu nhập, người dùng...",
  MANAGER: "Tìm SKU, PO, phiếu chuyển, báo cáo...",
  RECEIVER: "Tìm GRN, SKU, vị trí put-away...",
  PICKER: "Tìm đơn pick, SKU, shelf code...",
  PRINTER: "Tìm lệnh in, CUP_BLANK, CUP_PRINTED...",
  COUNTER: "Tìm phiếu kiểm, SKU, chênh lệch...",
} as const;

export function DashboardHeader() {
  const user = useSessionUser();
  const primaryRole = getDefaultRoleFocus(user?.roles);

  if (!user) {
    return null;
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border/80 bg-card/90 px-4 py-3 backdrop-blur-xl sm:px-5 lg:px-6">
      <div className="mx-auto flex w-full max-w-[1500px] items-center gap-3">
        <Sheet>
          <SheetTrigger asChild>
            <Button
              className="lg:hidden"
              size="icon"
              variant="outline"
              aria-label="Mở menu"
            >
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent className="w-[286px] p-0" side="left">
            <SheetHeader className="sr-only">
              <SheetTitle>Điều hướng WMS</SheetTitle>
              <SheetDescription>
                Danh sách module WMS được lọc theo role hiện tại.
              </SheetDescription>
            </SheetHeader>
            <SidebarContent closeOnNavigate />
          </SheetContent>
        </Sheet>

        <div className="relative min-w-0 flex-1 md:max-w-[460px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-10 pl-9 pr-16"
            placeholder={roleSearchPlaceholder[primaryRole]}
          />
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded-md border bg-muted/60 px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground md:inline-flex">
            Ctrl K
          </kbd>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button
            className="hidden md:inline-flex"
            size="icon"
            variant="outline"
            aria-label="Quét barcode"
          >
            <ScanLine />
          </Button>
          <Button
            className="relative"
            size="icon"
            variant="outline"
            aria-label="Thông báo"
          >
            <Bell />
            <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-primary" />
          </Button>
          <div className="hidden items-center gap-2 rounded-lg border bg-card py-1 pl-1 pr-2 text-sm font-semibold shadow-[0_10px_26px_-24px_rgba(15,23,42,0.45)] sm:flex">
            <Avatar className="size-8">
              <AvatarFallback className="bg-secondary text-secondary-foreground">
                {initials(user.name) || "WM"}
              </AvatarFallback>
            </Avatar>
            <span className="max-w-28 truncate">{ROLE_LABELS[primaryRole]}</span>
            <ChevronDown className="size-4 text-muted-foreground" />
          </div>
        </div>
      </div>
    </header>
  );
}
