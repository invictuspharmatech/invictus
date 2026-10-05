import { requireFullAdmin } from "@/lib/auth";
import { DashboardTilesEditor } from "@/components/admin/DashboardTilesEditor";

export default async function DashboardTilesPage() {
  const staff = await requireFullAdmin();
  if (!staff) return null;
  return (
    <div>
      <h1 className="display-font text-3xl">Dashboard tiles</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Reorder rows, set custom titles, change colors, and add any metric from the catalog. Layout
        applies to all admins.
      </p>
      <DashboardTilesEditor />
    </div>
  );
}
