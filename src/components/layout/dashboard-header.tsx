"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  ChevronDown,
  KeyRound,
  LogOut,
  Menu,
  ScanLine,
  Search,
  UserRound,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  AccountProfileDialog,
  ChangePasswordDialog,
} from "@/features/auth/components/account-dialogs";
import { logout } from "@/features/auth/services/auth.service";
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
  MANAGER: "Tìm SKU, đơn mua, phiếu chuyển, báo cáo...",
  SHIPPER: "Tìm mã đơn, mã vận đơn, người nhận...",
  RECEIVER: "Tìm phiếu nhập, SKU, vị trí cất hàng...",
  PICKER: "Tìm đơn soạn hàng, SKU, mã vị trí...",
  PRINTER: "Tìm in ly, ly chưa in, ly đã in...",
  COUNTER: "Tìm phiếu kiểm, SKU, chênh lệch...",
} as const;

export function DashboardHeader() {
  const user = useSessionUser();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const primaryRole = getDefaultRoleFocus(user?.roles);

  if (!user) {
    return null;
  }

  return (
    <>
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
                  Danh sách chức năng WMS được lọc theo vai trò hiện tại.
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
              aria-label="Quét mã vạch"
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="hidden items-center gap-2 rounded-lg border bg-card py-1 pl-1 pr-2 text-sm font-semibold shadow-[0_10px_26px_-24px_rgba(15,23,42,0.45)] transition-colors hover:bg-accent sm:flex"
                  type="button"
                >
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-secondary text-secondary-foreground">
                      {initials(user.name) || "WM"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="max-w-28 truncate">
                    {ROLE_LABELS[primaryRole]}
                  </span>
                  <ChevronDown className="size-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <span className="block truncate font-semibold text-foreground">
                    {user.name}
                  </span>
                  <span className="block truncate text-xs font-normal">
                    {ROLE_LABELS[primaryRole]}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setProfileOpen(true)}>
                  <UserRound />
                  Hồ sơ
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setChangePasswordOpen(true)}>
                  <KeyRound />
                  Đổi mật khẩu
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={async () => {
                    await logout();
                    router.replace("/login");
                  }}
                >
                  <LogOut />
                  Đăng xuất
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <AccountProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
      <ChangePasswordDialog
        open={changePasswordOpen}
        onOpenChange={setChangePasswordOpen}
      />
    </>
  );
}
