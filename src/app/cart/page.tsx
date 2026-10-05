"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/site/PageHeader";
import { useCart } from "@/components/shop/CartProvider";
import { formatMoney } from "@/lib/constants";
import {
  fetchCheckoutSettings,
  orderLimitAmount,
  readSavedShippingOptionId,
  resolveShippingFee,
  saveShippingOptionId,
  type CheckoutSettings,
} from "@/lib/checkout-settings";

export default function CartPage() {
  const { items, merchandiseTotal, updateQuantity, removeItem } = useCart();
  const [settings, setSettings] = useState<CheckoutSettings | null>(null);
  const [optionId, setOptionId] = useState<string | null>(null);

  useEffect(() => {
    void fetchCheckoutSettings().then((data) => {
      setSettings(data);
      const saved = readSavedShippingOptionId();
      const resolved = resolveShippingFee(data, saved);
      setOptionId(resolved.id);
      saveShippingOptionId(resolved.id);
    });
  }, []);

  const shippingOption = resolveShippingFee(settings, optionId);
  const shippingEstimate = items.length === 0 ? 0 : shippingOption.fee;
  const minOrder = settings?.minOrderAmount ?? 100;
  const maxOrder = settings?.maxOrderAmount ?? null;
  const compared = orderLimitAmount(merchandiseTotal, shippingEstimate, settings);
  const belowMin = merchandiseTotal > 0 && minOrder != null && compared < minOrder;
  const aboveMax = merchandiseTotal > 0 && maxOrder != null && compared > maxOrder;
  const blocked = belowMin || aboveMax;
  const remaining = minOrder != null ? Math.max(0, minOrder - compared) : 0;
  const fees = settings?.shippingFees ?? [];

  const minCopy = useMemo(() => {
    if (!belowMin || minOrder == null) return null;
    return `${formatMoney(minOrder)} minimum order. Add ${formatMoney(remaining)} more.`;
  }, [belowMin, minOrder, remaining]);

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
            {fees.length > 1 ? (
              <label className="mt-4 block text-sm">
                Shipping
                <select
                  className="field mt-1"
                  value={shippingOption.id}
                  onChange={(event) => {
                    setOptionId(event.target.value);
                    saveShippingOptionId(event.target.value);
                  }}
                >
                  {fees.map((fee) => (
                    <option key={fee.id} value={fee.id}>
                      {fee.name} · {formatMoney(fee.fee)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt>Merchandise</dt>
                <dd>{formatMoney(merchandiseTotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>{fees.length > 1 ? shippingOption.name : "Shipping"}</dt>
                <dd>{formatMoney(shippingEstimate)}</dd>
              </div>
              <div className="flex justify-between border-t border-border/40 pt-3 font-medium">
                <dt>Estimated total</dt>
                <dd>{formatMoney(merchandiseTotal + shippingEstimate)}</dd>
              </div>
            </dl>
            {minCopy ? <p className="mt-4 text-sm text-signal">{minCopy}</p> : null}
            {aboveMax && maxOrder != null ? (
              <p className="mt-4 text-sm text-signal">
                {formatMoney(maxOrder)} maximum order.
              </p>
            ) : null}
            <Link
              href="/checkout"
              className={`gold-btn mt-6 w-full ${blocked ? "pointer-events-none opacity-40" : ""}`}
            >
              Checkout
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}
