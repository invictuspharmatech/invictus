import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { djangoAuthed } from "@/lib/django";
import { requireStaff } from "@/lib/auth";
import { formatMoney } from "@/lib/constants";
import { WarehouseCode } from "@/lib/enums";
import { isFullAdmin, staffWarehouse } from "@/lib/roles";
import { warehouseLabel } from "@/lib/warehouse";
import type { ApiDashboardOverview, ApiOrder, ApiProduct } from "@/lib/api-types";

function asWarehouseCode(value: string): WarehouseCode | null {
  if (value === WarehouseCode.WAREHOUSE_1 || value === WarehouseCode.WAREHOUSE_2) {
    return value;
  }
  return null;
}

export default async function AdminWarehouseDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const staff = await requireStaff();
  if (!staff) return null;
  const { code: raw } = await params;
  const code = asWarehouseCode(raw);
  if (!code) notFound();
  const scoped = staffWarehouse(staff.role);
  if (scoped && scoped !== code) redirect("/admin/warehouses");

  const warehouseQuery = code === WarehouseCode.WAREHOUSE_1 ? "1" : "2";
  const [overview, products, orderData] = await Promise.all([
    djangoAuthed<ApiDashboardOverview>(`/api/admin/overview/?warehouse=${code}`),
    djangoAuthed<ApiProduct[]>(`/api/admin/products/?warehouse=${warehouseQuery}`),
    djangoAuthed<{ orders: ApiOrder[] }>(
      `/api/admin/orders/?status=PROCESSING&warehouse=${code}`,
    ),
  ]);
  const card = overview.warehouses.find((row) => row.code === code);
  const stockKey = code === WarehouseCode.WAREHOUSE_1 ? "stockQuantityW1" : "stockQuantityW2";
  const lowStock = products.filter((product) => {
    const count = product[stockKey];
    return count != null && count <= 5;
  });

  return (
    <div>
      <p className="text-sm text-muted-foreground">
        <Link href="/admin/warehouses">Warehouses</Link>
      </p>
      <h1 className="display-font mt-2 text-3xl">{card?.name || warehouseLabel(code)}</h1>
      {card?.contact ? <p className="mt-2 text-sm text-muted-foreground">{card.contact}</p> : null}
      {card?.notes ? <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{card.notes}</p> : null}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href={`/admin/inventory?warehouse=${warehouseQuery}`} className="tile">
          <p className="text-sm text-muted-foreground">SKUs</p>
          <p className="mt-2 text-2xl">{card?.productCount ?? 0}</p>
        </Link>
        <Link href={`/admin/inventory?warehouse=${warehouseQuery}`} className="tile">
          <p className="text-sm text-muted-foreground">Low stock</p>
          <p className="mt-2 text-2xl">{card?.lowStockCount ?? 0}</p>
        </Link>
        <Link href={`/admin/orders?status=processing&warehouse=${code}`} className="tile">
          <p className="text-sm text-muted-foreground">Processing</p>
          <p className="mt-2 text-2xl">{card?.processingCount ?? 0}</p>
        </Link>
        <Link href={`/admin/orders?warehouse=${code}`} className="tile">
          <p className="text-sm text-muted-foreground">Open value</p>
          <p className="mt-2 text-2xl">{formatMoney(card?.openOrderValue ?? 0)}</p>
        </Link>
      </div>

      <section className="tile mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg">Processing orders</h2>
          <Link
            href={`/admin/orders?status=processing&warehouse=${code}`}
            className="text-sm text-muted-foreground"
          >
            View all
          </Link>
        </div>
        <ul className="mt-4 divide-y divide-border/40 text-sm">
          {orderData.orders.length === 0 ? (
            <li className="py-3 text-muted-foreground">No processing orders.</li>
          ) : (
            orderData.orders.map((order) => (
              <li key={order.id} className="flex justify-between py-3">
                <Link href={`/admin/orders/${order.id}`} className="hover:text-primary">
                  {order.orderNumber} · {order.customerName}
                </Link>
                <span>{formatMoney(order.grandTotal)}</span>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="tile mt-8">
        <h2 className="text-lg">Products running low</h2>
        <ul className="mt-4 divide-y divide-border/40 text-sm">
          {lowStock.length === 0 ? (
            <li className="py-3 text-muted-foreground">Nothing at or below 5 units.</li>
          ) : (
            lowStock.slice(0, 20).map((product) => (
              <li key={product.id} className="flex justify-between py-3">
                {isFullAdmin(staff.role) ? (
                  <Link href={`/admin/cms/products/${product.id}`} className="hover:text-primary">
                    {product.name}
                  </Link>
                ) : (
                  <span>{product.name}</span>
                )}
                <span>{product[stockKey] ?? 0}</span>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
