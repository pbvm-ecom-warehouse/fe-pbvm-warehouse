import { WarehouseNavigationClient } from "@/features/warehouse-navigation/components/warehouse-navigation-client";

export default function WarehouseNavigationPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border bg-card px-4 py-4 shadow-[0_14px_34px_-28px_rgba(15,23,42,0.42)] lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-normal">
            Điều hướng kệ
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gợi ý vị trí theo khu vực, dãy kệ và vị trí; nhân viên vẫn xác nhận
            bằng mã vạch.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs lg:w-[420px]">
          <div className="rounded-lg border bg-primary/5 px-3 py-2">
            <div className="font-semibold">Gợi ý</div>
            <div className="text-muted-foreground">vừa sức chứa</div>
          </div>
          <div className="rounded-lg border bg-teal-50 px-3 py-2">
            <div className="font-semibold">Mã vạch</div>
            <div className="text-muted-foreground">bắt buộc</div>
          </div>
          <div className="rounded-lg border bg-amber-50 px-3 py-2">
            <div className="font-semibold">Đổi vị trí</div>
            <div className="text-muted-foreground">có ghi nhận</div>
          </div>
        </div>
      </div>
      <WarehouseNavigationClient />
    </div>
  );
}
