import {
  Boxes,
  ClipboardCheck,
  Factory,
  FileBarChart2,
  Home,
  MapPinned,
  PackageCheck,
  PackageOpen,
  Repeat2,
  RotateCcw,
  ShoppingCart,
  SlidersHorizontal,
  Server,
  UsersRound,
  Warehouse,
} from "lucide-react";

import { getRouteAllowedRoles } from "@/lib/rbac";

export const dashboardRoutes = [
  {
    href: "/dashboard",
    label: "Tổng quan",
    icon: Home,
    allowedRoles: getRouteAllowedRoles("/dashboard"),
  },
  {
    href: "/warehouses",
    label: "Kho",
    icon: Warehouse,
    allowedRoles: getRouteAllowedRoles("/warehouses"),
  },
  {
    href: "/products",
    label: "Sản phẩm",
    icon: PackageOpen,
    allowedRoles: getRouteAllowedRoles("/products"),
  },
  {
    href: "/inventory",
    label: "Tồn kho",
    icon: Boxes,
    allowedRoles: getRouteAllowedRoles("/inventory"),
  },
  {
    href: "/warehouse-navigation",
    label: "Cất hàng",
    icon: MapPinned,
    allowedRoles: getRouteAllowedRoles("/warehouse-navigation"),
  },
  {
    href: "/purchases",
    label: "Nhập hàng",
    icon: ShoppingCart,
    allowedRoles: getRouteAllowedRoles("/purchases"),
  },
  {
    href: "/goods-issues",
    label: "Xuất kho",
    icon: PackageCheck,
    allowedRoles: getRouteAllowedRoles("/goods-issues"),
  },
  {
    href: "/goods-returns",
    label: "Hàng hoàn",
    icon: RotateCcw,
    allowedRoles: getRouteAllowedRoles("/goods-returns"),
  },
  {
    href: "/adjustments",
    label: "Kiểm kê",
    icon: SlidersHorizontal,
    allowedRoles: getRouteAllowedRoles("/adjustments"),
  },
  {
    href: "/suppliers",
    label: "Nhà cung cấp",
    icon: Factory,
    allowedRoles: getRouteAllowedRoles("/suppliers"),
  },
  {
    href: "/print-jobs",
    label: "In ly",
    icon: Repeat2,
    allowedRoles: getRouteAllowedRoles("/print-jobs"),
  },
  {
    href: "/reports",
    label: "Báo cáo",
    icon: FileBarChart2,
    allowedRoles: getRouteAllowedRoles("/reports"),
  },
  {
    href: "/settings",
    label: "Hệ thống",
    icon: Server,
    allowedRoles: getRouteAllowedRoles("/settings"),
  },
  {
    href: "/staff",
    label: "Nhân viên",
    icon: UsersRound,
    allowedRoles: getRouteAllowedRoles("/staff"),
  },
  {
    href: "/login",
    label: "Đăng nhập",
    icon: ClipboardCheck,
    allowedRoles: getRouteAllowedRoles("/login"),
  },
] as const;
