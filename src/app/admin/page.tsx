import Link from "next/link";
import { redirect } from "next/navigation";
import { djangoAuthed } from "@/lib/django";
import { requireStaff } from "@/lib/auth";
import { isFullAdmin } from "@/lib/roles";
import { DashboardTiles } from "@/components/admin/DashboardTiles";
import type { ApiDashboardOverview } from "@/lib/api-types";

export default async function AdminHomePage() {
  const staff = await requireStaff();
  if (!staff) redirect("/login?next=/admin");
  const overview = await djangoAuthed<ApiDashboardOverview>("/api/admin/overview/");

  return (
    <div>
      <h1 className="display-font text-3xl">Dashboard</h1>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Signed in as {staff.email}.</p>
        {isFullAdmin(staff.role) ? (
          <Link href="/admin/dashboard/tiles" className="ghost-btn">
            Customize tiles
          </Link>
        ) : null}
      </div>
      <DashboardTiles overview={overview} />
    </div>
  );
}
