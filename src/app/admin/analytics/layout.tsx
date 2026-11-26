import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireFullAdmin } from "@/lib/auth";
import { AnalyticsSubNav } from "@/components/admin/analytics/AnalyticsSubNav";

export default async function AnalyticsLayout({ children }: { children: ReactNode }) {
  const staff = await requireFullAdmin();
  if (!staff) redirect("/admin");
  return (
    <div>
      <h1 className="display-font text-3xl">Analytics</h1>
      <AnalyticsSubNav />
      <div className="mt-8">{children}</div>
    </div>
  );
}
