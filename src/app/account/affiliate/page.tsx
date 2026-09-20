import { redirect } from "next/navigation";
import { djangoAuthed } from "@/lib/django";
import { readSession } from "@/lib/auth";
import { PageHeader } from "@/components/site/PageHeader";
import { formatMoney } from "@/lib/constants";
import type { ApiOrder } from "@/lib/api-types";

export default async function AffiliateDashboardPage() {
  const session = await readSession();
  if (!session) redirect("/login?next=/account/affiliate");
  if (!session.isAffiliate) redirect("/account");

  const user = await djangoAuthed<{
    affiliateCode: string;
    commissionType: string;
    commissionRate: number;
    payoutType: string;
    referredOrders: ApiOrder[];
    referredUsers: { id: string; name: string; email: string }[];
  }>("/api/account/affiliate/");

  const sales = user.referredOrders.reduce((sum, order) => sum + order.merchandiseTotal, 0);
  const commission = user.referredOrders.reduce((sum, order) => sum + order.commissionAmount, 0);
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const link = `${origin}/?ref=${user.affiliateCode}`;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
      <PageHeader title="Affiliate tracking" lede={`Code ${user.affiliateCode}`} />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="tile">
          <p className="text-sm text-muted-foreground">Referred sales</p>
          <p className="mt-2 text-2xl">{formatMoney(sales)}</p>
        </div>
        <div className="tile">
          <p className="text-sm text-muted-foreground">Commission earned</p>
          <p className="mt-2 text-2xl">{formatMoney(commission)}</p>
        </div>
        <div className="tile">
          <p className="text-sm text-muted-foreground">Referred customers</p>
          <p className="mt-2 text-2xl">{user.referredUsers.length}</p>
        </div>
      </div>
      <div className="tile mt-6">
        <p className="text-sm text-muted-foreground">Your link</p>
        <p className="mt-2 break-all text-sm">{link}</p>
        <p className="mt-3 text-xs text-muted-foreground">
          {user.payoutType === "STORE_CREDIT" ? "Store credit" : "Commission"}:{" "}
          {user.commissionType === "FIXED"
            ? `${formatMoney(user.commissionRate)} per order, excluding shipping`
            : `${user.commissionRate}% of sales, excluding shipping`}
        </p>
      </div>
      <section className="tile mt-6 overflow-x-auto">
        <h2 className="text-lg">Orders</h2>
        <table className="mt-4 w-full text-left text-sm">
          <thead className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            <tr>
              <th className="py-2">Order</th>
              <th>Purchase</th>
              <th>Commission</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {user.referredOrders.map((order) => (
              <tr key={order.id} className="border-t border-border/40">
                <td className="py-2">{order.orderNumber}</td>
                <td>{formatMoney(order.merchandiseTotal)}</td>
                <td>{formatMoney(order.commissionAmount)}</td>
                <td className="capitalize">{order.status.toLowerCase()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
