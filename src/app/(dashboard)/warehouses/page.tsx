import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WarehouseLayoutEditor } from "@/features/warehouse-layout/components/warehouse-layout-editor";
import { WarehouseStructureClient } from "@/features/warehouse-structure/components/warehouse-structure-client";

export default function WarehousesPage() {
  return (
    <Tabs className="space-y-4" defaultValue="layout">
      <TabsList>
        <TabsTrigger value="layout">Mặt bằng</TabsTrigger>
        <TabsTrigger value="structure">Dữ liệu kệ</TabsTrigger>
      </TabsList>
      <TabsContent value="layout">
        <WarehouseLayoutEditor />
      </TabsContent>
      <TabsContent value="structure">
        <WarehouseStructureClient />
      </TabsContent>
    </Tabs>
  );
}
