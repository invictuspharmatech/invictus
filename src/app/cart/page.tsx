"use client";

import Link from "next/link";
import { PageHeader } from "@/components/site/PageHeader";
import { useCart } from "@/components/shop/CartProvider";
import { MIN_ORDER_USD, SHIPPING_USD, formatMoney } from "@/lib/constants";
import { WarehouseCode } from "@/lib/enums";

export default function CartPage() {
  const { items, merchandiseTotal, updateQuantity, removeItem } = useCart();
  const hasW1 = items.some((item) => item.warehouse === WarehouseCode.WAREHOUSE_1);
  const hasW2 = items.some((item) => item.warehouse === WarehouseCode.WAREHOUSE_2);
  const shippingEstimate =
    items.length === 0 ? 0 : hasW1 && hasW2 ? SHIPPING_USD * 2 : SHIPPING_USD;
  const belowMin = merchandiseTotal > 0 && merchandiseTotal < MIN_ORDER_USD;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
      <PageHeader title="Shopping Cart" />
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
          <section className="tile">
            <ul className="divide-y divide-border/40">
              {items.map((item) => (
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
          <aside className="tile h-fit">
            <h2 className="text-lg">Summary</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt>Merchandise</dt>
                <dd>{formatMoney(merchandiseTotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Shipping</dt>
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
