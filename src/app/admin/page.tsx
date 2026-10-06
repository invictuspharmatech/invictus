import Link from "next/link";
import { redirect } from "next/navigation";
import { Eye } from "lucide-react";
import { djangoAuthed } from "@/lib/django";
import { requireStaff } from "@/lib/auth";
import { isFullAdmin } from "@/lib/roles";
import { WarehouseCode, formatOrderStatus } from "@/lib/enums";
import { formatMoney } from "@/lib/constants";
import { DashboardTiles } from "@/components/admin/DashboardTiles";
import { DashboardPieCharts } from "@/components/admin/DashboardPieCharts";
import type { ApiDashboardOverview } from "@/lib/api-types";

function warehouseShort(code: string) {
  return code === WarehouseCode.WAREHOUSE_1 ? "W1" : "W2";
}

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
      <DashboardPieCharts />
      <section className="tile mt-8 overflow-x-auto p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 px-5 py-4">
          <h2 className="text-lg">Recent orders</h2>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/orders/create" className="gold-btn">
              Create order
            </Link>
            <Link href="/admin/orders" className="ghost-btn">
              View all orders
            </Link>
          </div>
        </div>
        {overview.orders.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">No recent orders.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Order #</th>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Warehouse</th>
                <th className="px-5 py-3">Total</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {overview.orders.map((order) => (
                <tr key={order.id} className="border-t border-border/40">
                  <td className="px-5 py-3">
                    <Link href={`/admin/orders/${order.id}`} className="text-signal hover:underline">
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td className="px-5 py-3">{order.customerEmail || order.customerName || "—"}</td>
                  <td className="px-5 py-3">{warehouseShort(order.warehouse)}</td>
                  <td className="px-5 py-3">{formatMoney(order.grandTotal)}</td>
                  <td className="px-5 py-3">
                    <span className="rounded bg-secondary px-2 py-0.5 text-xs uppercase tracking-wide">
                      {formatOrderStatus(order.status)}
                    </span>
                  </td>
                  <td className="px-5 py-3">{order.createdAt.slice(0, 10)}</td>
                  <td className="px-5 py-3">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="ghost-btn px-2 py-1"
                      title="View order"
                    >
                      <Eye className="size-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
