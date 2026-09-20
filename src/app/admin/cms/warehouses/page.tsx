import { djangoAuthed } from "@/lib/django";
import { requireFullAdmin } from "@/lib/auth";
import { WarehouseSettingsForm } from "@/components/admin/WarehouseSettingsForm";
import type { ApiWarehouseSettings } from "@/lib/api-types";

export default async function WarehouseSettingsPage() {
  const staff = await requireFullAdmin();
  if (!staff) return null;
  const settings = await djangoAuthed<ApiWarehouseSettings>(
    "/api/admin/cms/warehouse-settings/",
  );

  return (
    <div>
      <h1 className="display-font text-3xl">Warehouses</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Control how inventory and orders move between Warehouse 1 and Warehouse 2. Analytics follow
        the warehouse that actually ships. Partial splits split shipping $10 / $10. Moving a whole
        order moves the full $20 shipping with it. Backorders are set on each product, not here.
      </p>
      <WarehouseSettingsForm settings={settings} />
    </div>
  );
}
