import Link from "next/link";
import { redirect } from "next/navigation";
import { djangoAuthed } from "@/lib/django";
import { readSession } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { PageHeader } from "@/components/site/PageHeader";
import { formatMoney } from "@/lib/constants";
import { AffiliateApplyButton } from "@/components/shop/AffiliateApplyButton";
import { LogoutButton } from "@/components/shop/LogoutButton";
import type { ApiOrder } from "@/lib/api-types";

export default async function AccountPage() {
  const session = await readSession();
  if (!session) redirect("/login?next=/account");
  if (isStaff(session.role)) redirect("/admin");

  const { orders, application } = await djangoAuthed<{
    orders: ApiOrder[];
    application: { id: string; status: string } | null;
  }>("/api/account/summary/");

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
      <PageHeader title={`Hello, ${session.name}`} lede={session.email} />
      <div className="mb-8 flex flex-wrap gap-3">
        <Link href="/account/orders" className="ghost-btn">
          Orders
        </Link>
        {session.isAffiliate ? (
          <Link href="/account/affiliate" className="gold-btn">
            Affiliate tracking
          </Link>
        ) : (
          <AffiliateApplyButton pending={application?.status === "pending"} />
        )}
        <LogoutButton />
      </div>
      <section className="tile">
        <h2 className="text-lg">Recent orders</h2>
        {orders.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No orders yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border/40 text-sm">
            {orders.map((order) => (
              <li key={order.id} className="flex justify-between py-3">
                <span>
                  {order.orderNumber} · {order.status.toLowerCase()}
                </span>
                <span>{formatMoney(order.grandTotal)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
