import Link from "next/link";
import { redirect } from "next/navigation";
import { djangoAuthed } from "@/lib/django";
import { readSession } from "@/lib/auth";
import { PageHeader } from "@/components/site/PageHeader";
import { formatMoney } from "@/lib/constants";
import { warehouseLabel } from "@/lib/warehouse";
import type { ApiOrder } from "@/lib/api-types";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ placed?: string }>;
}) {
  const session = await readSession();
  if (!session) redirect("/login?next=/account/orders");
  const { placed } = await searchParams;
  const orders = await djangoAuthed<ApiOrder[]>("/api/account/orders/");

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
      <PageHeader title="My orders" />
      {placed ? (
        <p className="mb-6 tile text-sm">
          Order placed. If your cart spanned both warehouses, you will see two order numbers below.
        </p>
      ) : null}
      <div className="space-y-4">
        {orders.map((order) => (
          <article key={order.id} className="tile">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg">{order.orderNumber}</h2>
                <p className="text-sm text-muted-foreground">
                  {warehouseLabel(order.warehouse)} · {order.status.toLowerCase()}
                </p>
              </div>
              <p>{formatMoney(order.grandTotal)}</p>
            </div>
            <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
              {order.items.map((item) => (
                <li key={item.id}>
                  {item.name} × {item.quantity}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
      <Link href="/account" className="mt-8 inline-block text-sm text-muted-foreground">
        ← Account
      </Link>
    </div>
  );
}
