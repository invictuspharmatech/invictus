import { requireFullAdmin } from "@/lib/auth";
import { DashboardTilesEditor } from "@/components/admin/DashboardTilesEditor";

export default async function DashboardTilesPage() {
  const staff = await requireFullAdmin();
  if (!staff) return null;
  return (
    <div>
      <h1 className="display-font text-3xl">Dashboard tiles</h1>
      <DashboardTilesEditor />
    </div>
  );
}
