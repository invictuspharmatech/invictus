import Link from "next/link";
import { djangoAuthed } from "@/lib/django";
import { requireStaff } from "@/lib/auth";
import { AccountingWarehouse, WarehouseCode } from "@/lib/enums";
import { formatMoney } from "@/lib/constants";
import { asAccountingWarehouse, warehouseFilterLabel } from "@/lib/accounting";
import { isFullAdmin } from "@/lib/roles";
import type { ApiOrder } from "@/lib/api-types";

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ warehouse?: string }>;
}) {
  const staff = await requireStaff();
  if (!staff) return null;
  const admin = isFullAdmin(staff.role);
  const { warehouse: rawWarehouse } = await searchParams;
  const warehouse = asAccountingWarehouse(rawWarehouse);
  const overviewPath = admin
    ? `/api/admin/overview/?warehouse=${warehouse}`
    : "/api/admin/overview/";

  const overview = await djangoAuthed<{
    productCount: number;
    openOrderValue: number;
    pendingAffiliates: number;
    userCount: number;
    warehouse: string;
    orders: ApiOrder[];
  }>(overviewPath);

  return (
    <div>
      <h1 className="display-font text-3xl">Operations</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Signed in as {staff.email}. Super user accounts stay hidden from other admins.
      </p>
      {admin ? (
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
              href={`/admin?warehouse=${item}`}
              className={item === warehouse ? "gold-btn" : "ghost-btn"}
            >
              {warehouseFilterLabel(item)}
            </a>
          ))}
        </div>
      ) : null}
      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <Stat label="Catalog" value={String(overview.productCount)} href="/admin/products" />
        <Stat
          label="Open order value"
          value={formatMoney(overview.openOrderValue)}
          href="/admin/orders"
        />
        <Stat
          label="Pending affiliates"
          value={String(overview.pendingAffiliates)}
          href="/admin/affiliates"
        />
        <Stat label="Visible users" value={String(overview.userCount)} href="/admin/users" />
      </div>
      <section className="tile mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg">Latest orders</h2>
          <Link href="/admin/orders" className="text-sm text-muted-foreground">
            View all
          </Link>
        </div>
        <ul className="mt-4 divide-y divide-border/40 text-sm">
          {overview.orders.map((order) => (
            <li key={order.id} className="flex justify-between py-3">
              <span>
                {order.orderNumber} ·{" "}
                {order.warehouse === WarehouseCode.WAREHOUSE_1 ? "W1" : "W2"} ·{" "}
                {order.status.toLowerCase()}
              </span>
              <span>{formatMoney(order.grandTotal)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href: string;
}) {
  return (
    <Link href={href} className="tile">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl">{value}</p>
    </Link>
  );
}
