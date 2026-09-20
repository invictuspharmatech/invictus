import { djangoAuthed } from "@/lib/django";
import { requireStaff } from "@/lib/auth";
import { formatMoney } from "@/lib/constants";
import { warehouseLabel } from "@/lib/warehouse";
import { OrderStatusSelect } from "@/components/admin/OrderStatusSelect";
import { OrderFulfillmentControls } from "@/components/admin/OrderFulfillmentControls";
import type { ApiOrder, ApiWarehouseSettings } from "@/lib/api-types";

export default async function AdminOrdersPage() {
  const staff = await requireStaff();
  if (!staff) return null;
  const [orders, policy] = await Promise.all([
    djangoAuthed<ApiOrder[]>("/api/admin/orders/"),
    djangoAuthed<ApiWarehouseSettings>("/api/cms/warehouse-policy/"),
  ]);

  return (
    <div>
      <h1 className="display-font text-3xl">Orders</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Split checkouts share a group ID. Moving items to another warehouse moves merch analytics
        with them. A whole-order move takes the full shipping fee; a partial split is $10 / $10.
      </p>
      <div className="mt-6 space-y-4">
        {orders.map((order) => (
          <article key={order.id} className="tile">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg">{order.orderNumber}</h2>
                <p className="text-sm text-muted-foreground">
                  {warehouseLabel(order.warehouse)} · {order.customerName} · {order.customerEmail}
                </p>
                <p className="text-xs text-muted-foreground">Group {order.groupId}</p>
              </div>
              <div className="text-right">
                <p>{formatMoney(order.grandTotal)}</p>
                <p className="text-xs text-muted-foreground">
                  Merch {formatMoney(order.merchandiseTotal)} · Ship {formatMoney(order.shippingTotal)}
                </p>
              </div>
            </div>
            <ul className="mt-3 text-sm text-muted-foreground">
              {order.items.map((item) => (
                <li key={item.id}>
                  {item.name} × {item.quantity}
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <OrderStatusSelect id={order.id} status={order.status} />
            </div>
            <OrderFulfillmentControls order={order} policy={policy} role={staff.role} />
          </article>
        ))}
      </div>
    </div>
  );
}
