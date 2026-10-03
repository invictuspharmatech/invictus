import Link from "next/link";
import { djangoAuthed } from "@/lib/django";
import { requireStaff } from "@/lib/auth";
import { WarehouseSettingsForm } from "@/components/admin/WarehouseSettingsForm";
import { formatMoney } from "@/lib/constants";
import { isFullAdmin } from "@/lib/roles";
import type { ApiDashboardOverview, ApiWarehouseSettings } from "@/lib/api-types";

export default async function AdminWarehousesPage() {
  const staff = await requireStaff();
  if (!staff) return null;
  const admin = isFullAdmin(staff.role);
  const [overview, settings] = await Promise.all([
    djangoAuthed<ApiDashboardOverview>("/api/admin/overview/"),
    admin
      ? djangoAuthed<ApiWarehouseSettings>("/api/admin/cms/warehouse-settings/")
      : Promise.resolve(null),
  ]);

  return (
    <div>
      <h1 className="display-font text-3xl">Warehouses</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Open a warehouse for low-stock products and processing orders. Split and request settings
        live here now that Dashboard is the admin home.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {overview.warehouses.map((row) => (
          <Link key={row.code} href={`/admin/warehouses/${row.code}`} className="tile block">
            <h2 className="text-xl">{row.name}</h2>
            {row.contact ? (
              <p className="mt-1 text-sm text-muted-foreground">{row.contact}</p>
            ) : null}
            {row.notes ? (
              <p className="mt-2 text-sm text-muted-foreground">{row.notes}</p>
            ) : null}
            <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
              <p>
                <span className="block text-muted-foreground">SKUs</span>
                {row.productCount}
              </p>
              <p>
                <span className="block text-muted-foreground">Low stock</span>
                {row.lowStockCount}
              </p>
              <p>
                <span className="block text-muted-foreground">Processing</span>
                {row.processingCount}
              </p>
              <p>
                <span className="block text-muted-foreground">Open value</span>
                {formatMoney(row.openOrderValue)}
              </p>
            </div>
          </Link>
        ))}
      </div>
      <div className="mt-6">
        <Link href="/admin/transfers" className="text-sm text-signal">
          Transfers & requests →
        </Link>
      </div>
      {admin && settings ? <WarehouseSettingsForm settings={settings} /> : null}
    </div>
  );
}
