"use client";

import Link from "next/link";
import { useMemo } from "react";
import { PageHeader } from "@/components/site/PageHeader";
import { useCart } from "@/components/shop/CartProvider";
import { MIN_ORDER_USD, SHIPPING_USD, formatMoney } from "@/lib/constants";
import { warehouseLabel } from "@/lib/warehouse";
import { WarehouseCode } from "@/lib/enums";

export default function CartPage() {
  const { items, merchandiseTotal, updateQuantity, removeItem } = useCart();

  const groups = useMemo(() => {
    const warehouse1 = items.filter((item) => item.warehouse === WarehouseCode.WAREHOUSE_1);
    const warehouse2 = items.filter((item) => item.warehouse === WarehouseCode.WAREHOUSE_2);
    return [
      { warehouse: WarehouseCode.WAREHOUSE_1, items: warehouse1 },
      { warehouse: WarehouseCode.WAREHOUSE_2, items: warehouse2 },
    ].filter((group) => group.items.length > 0);
  }, [items]);

  const shippingEstimate = groups.length * SHIPPING_USD;
  const belowMin = merchandiseTotal > 0 && merchandiseTotal < MIN_ORDER_USD;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
      <PageHeader title="Shopping Cart" lede="Orders that span both warehouses split into two shipments at checkout." />
      {items.length === 0 ? (
        <div className="tile py-16 text-center">
          <h2 className="text-xl">Your cart is empty</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Looks like you haven&apos;t added any products yet.
          </p>
          <Link href="/products" className="gold-btn mt-6 inline-flex">
            Start shopping
          </Link>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="space-y-6">
            {groups.map((group, index) => (
              <section key={group.warehouse} className="tile">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  Order {index + 1} · {warehouseLabel(group.warehouse)}
                </p>
                <ul className="mt-4 divide-y divide-border/40">
                  {group.items.map((item) => (
                    <li key={item.productId} className="flex items-start justify-between gap-4 py-4">
                      <div>
                        <Link href={`/products/${item.slug}`} className="font-medium">
                          {item.name}
                        </Link>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {formatMoney(item.unitPrice)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          className="field w-16"
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(event) =>
                            updateQuantity(item.productId, Number(event.target.value) || 1)
                          }
                        />
                        <button
                          type="button"
                          className="text-xs uppercase tracking-[0.14em] text-muted-foreground"
                          onClick={() => removeItem(item.productId)}
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <aside className="tile h-fit">
            <h2 className="text-lg">Summary</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt>Merchandise</dt>
                <dd>{formatMoney(merchandiseTotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Shipping ({groups.length} shipment{groups.length === 1 ? "" : "s"})</dt>
                <dd>{formatMoney(shippingEstimate)}</dd>
              </div>
              <div className="flex justify-between border-t border-border/40 pt-3 font-medium">
                <dt>Estimated total</dt>
                <dd>{formatMoney(merchandiseTotal + shippingEstimate)}</dd>
              </div>
            </dl>
            {belowMin ? (
              <p className="mt-4 text-sm text-signal">
                ${MIN_ORDER_USD} minimum order. Add {formatMoney(MIN_ORDER_USD - merchandiseTotal)} more.
              </p>
            ) : null}
            <Link
              href="/checkout"
              className={`gold-btn mt-6 w-full ${belowMin ? "pointer-events-none opacity-40" : ""}`}
            >
              Checkout
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}
