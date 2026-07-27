import {
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
  Truck,
  UsersRound,
  Warehouse,
} from "lucide-react";

import { getRouteAllowedRoles } from "@/lib/rbac";

/** Nhóm route gộp chung trong sidebar dưới 1 mục collapse — key khớp field
 * `group` của từng route trong dashboardRoutes bên dưới. */
export const ROUTE_GROUPS = {
  catalog: {
    label: "Kho & Danh mục",
    icon: Warehouse,
  },
} as const;

export type RouteGroupKey = keyof typeof ROUTE_GROUPS;

export const dashboardRoutes = [
  {
    href: "/dashboard",
    label: "Tổng quan",
    icon: Home,
    allowedRoles: getRouteAllowedRoles("/dashboard"),
  },
  {
    href: "/reports",
    label: "Báo cáo",
    icon: FileBarChart2,
    allowedRoles: getRouteAllowedRoles("/reports"),
  },
  {
    href: "/locations",
    label: "Kho",
    icon: MapPinned,
    allowedRoles: getRouteAllowedRoles("/locations"),
    group: "catalog",
  },
  {
    href: "/products",
    label: "Sản phẩm",
    icon: PackageOpen,
    allowedRoles: getRouteAllowedRoles("/products"),
    group: "catalog",
  },
  {
    href: "/suppliers",
    label: "Nhà cung cấp",
    icon: Factory,
    allowedRoles: getRouteAllowedRoles("/suppliers"),
    group: "catalog",
  },
  {
    href: "/purchase-orders",
    label: "Đặt Nhập hàng",
    icon: ShoppingCart,
    allowedRoles: getRouteAllowedRoles("/purchase-orders"),
  },
  {
    href: "/goods-receipt-notes",
    label: "Nhận hàng",
    icon: ClipboardCheck,
    allowedRoles: getRouteAllowedRoles("/goods-receipt-notes"),
  },
  {
    href: "/goods-issues",
    label: "Xuất kho",
    icon: PackageCheck,
    allowedRoles: getRouteAllowedRoles("/goods-issues"),
  },
  {
    href: "/shipping",
    label: "Giao hàng",
    icon: Truck,
    allowedRoles: getRouteAllowedRoles("/shipping"),
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
    href: "/print-jobs",
    label: "In ly",
    icon: Repeat2,
    allowedRoles: getRouteAllowedRoles("/print-jobs"),
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
