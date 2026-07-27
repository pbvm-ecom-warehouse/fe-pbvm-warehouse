"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  PageHeader,
  PermissionNotice,
} from "@/features/admin-shell/components/operations-ui";
import { hasAnyRole } from "@/lib/rbac";
import { useSessionUser } from "@/hooks/use-session-user";

import { AttributeOptionsAdminPanel } from "./attribute-options-admin-dialog";

export function ProductAttributesClient() {
  const user = useSessionUser();
  const canAdministerOptions = hasAnyRole(user?.roles, ["ADMIN"]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Thuộc tính SKU"
        actions={
          <Button asChild variant="outline">
            <Link href="/products">
              <ArrowLeft data-icon="inline-start" />
              Quay lại
            </Link>
          </Button>
        }
      />

      {!canAdministerOptions ? (
        <PermissionNotice>
          Quyền tạo và quản lý giá trị SKU dành cho quản trị viên.
        </PermissionNotice>
      ) : (
        <AttributeOptionsAdminPanel />
      )}
    </div>
  );
}
