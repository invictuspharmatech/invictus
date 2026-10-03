import { redirect } from "next/navigation";
import { djangoAuthed } from "@/lib/django";
import { requireFullAdmin } from "@/lib/auth";
import { AccountingWarehouse } from "@/lib/enums";
import { asAccountingWarehouse, warehouseFilterLabel } from "@/lib/accounting";
import { DashboardTiles } from "@/components/admin/DashboardTiles";
import type { ApiDashboardOverview } from "@/lib/api-types";

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ warehouse?: string }>;
}) {
  const staff = await requireFullAdmin();
  if (!staff) redirect("/admin");
  const { warehouse: rawWarehouse } = await searchParams;
  const warehouse = asAccountingWarehouse(rawWarehouse);
  const overview = await djangoAuthed<ApiDashboardOverview>(
    `/api/admin/overview/?warehouse=${warehouse}`,
  );

  return (
    <div>
      <h1 className="display-font text-3xl">Analytics</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Same operational tiles as the dashboard, scoped by warehouse.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        {(
          [
            AccountingWarehouse.BOTH,
            AccountingWarehouse.WAREHOUSE_1,
            AccountingWarehouse.WAREHOUSE_2,
          ] as const
        ).map((item) => (
          <a
            key={item}
            href={`/admin/analytics?warehouse=${item}`}
            className={item === warehouse ? "gold-btn" : "ghost-btn"}
          >
            {warehouseFilterLabel(item)}
          </a>
        ))}
      </div>
      <DashboardTiles overview={overview} />
    </div>
  );
}
