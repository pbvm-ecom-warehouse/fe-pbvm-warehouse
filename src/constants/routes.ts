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
  Settings,
  ShoppingCart,
  SlidersHorizontal,
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
    label: "Điều hướng kệ",
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
    label: "Lệnh in ly",
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
    label: "Cài đặt",
    icon: Settings,
    allowedRoles: getRouteAllowedRoles("/settings"),
  },
  {
    href: "/login",
    label: "Đăng nhập",
    icon: ClipboardCheck,
    allowedRoles: getRouteAllowedRoles("/login"),
  },
] as const;
