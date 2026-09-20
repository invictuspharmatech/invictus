"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/site/PageHeader";
import { readReferralCode } from "@/components/shop/ReferralCapture";
import { useCart } from "@/components/shop/CartProvider";
import { MIN_ORDER_USD, SHIPPING_USD, formatMoney } from "@/lib/constants";
import { warehouseLabel } from "@/lib/warehouse";
import { WarehouseCode } from "@/lib/enums";

export default function CheckoutPage() {
  const router = useRouter();
  const { items, merchandiseTotal, clear } = useCart();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const groups = useMemo(
    () =>
      [
        WarehouseCode.WAREHOUSE_1,
        WarehouseCode.WAREHOUSE_2,
      ]
        .map((warehouse) => ({
          warehouse,
          items: items.filter((item) => item.warehouse === warehouse),
        }))
        .filter((group) => group.items.length > 0),
    [items],
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") || ""),
      email: String(form.get("email") || ""),
      line1: String(form.get("line1") || ""),
      line2: String(form.get("line2") || ""),
      city: String(form.get("city") || ""),
      state: String(form.get("state") || ""),
      postal: String(form.get("postal") || ""),
      notes: String(form.get("notes") || ""),
      referralCode: readReferralCode(),
      items: items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
    };

    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await response.json()) as {
      error?: string;
      groupId?: string;
      orders?: { orderNumber: string }[];
    };
    setPending(false);
    if (!response.ok) {
      setError(data.error || "Checkout failed.");
      return;
    }
    clear();
    router.push(`/account/orders?placed=${data.groupId ?? ""}`);
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="display-font text-3xl">Nothing to check out</h1>
        <a href="/products" className="gold-btn mt-6 inline-flex">
          Shop products
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
      <PageHeader
        title="Checkout"
        lede={`$${MIN_ORDER_USD} minimum. Bitcoin is the accepted payment method. Mixed-warehouse carts become two orders.`}
      />
      <form onSubmit={onSubmit} className="grid gap-8 lg:grid-cols-2">
        <div className="tile space-y-4">
          <h2 className="text-lg">Shipping</h2>
          <input className="field" name="name" placeholder="Full name" required />
          <input className="field" name="email" type="email" placeholder="Email" required />
          <input className="field" name="line1" placeholder="Address" required />
          <input className="field" name="line2" placeholder="Apartment, suite (optional)" />
          <div className="grid grid-cols-2 gap-3">
            <input className="field" name="city" placeholder="City" required />
            <input className="field" name="state" placeholder="State" required />
          </div>
          <input className="field" name="postal" placeholder="ZIP" required />
          <textarea className="field min-h-24" name="notes" placeholder="Order notes (optional)" />
        </div>
        <div className="tile">
          <h2 className="text-lg">Order split</h2>
          <div className="mt-4 space-y-4">
            {groups.map((group, index) => {
              const subtotal = group.items.reduce(
                (sum, item) => sum + item.unitPrice * item.quantity,
                0,
              );
              return (
                <div key={group.warehouse} className="border border-border/40 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    Order {index + 1} · {warehouseLabel(group.warehouse)}
                  </p>
                  <ul className="mt-3 space-y-1 text-sm">
                    {group.items.map((item) => (
                      <li key={item.productId} className="flex justify-between gap-3">
                        <span>
                          {item.name} × {item.quantity}
                        </span>
                        <span>{formatMoney(item.unitPrice * item.quantity)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 flex justify-between text-sm text-muted-foreground">
                    <span>Shipping</span>
                    <span>{formatMoney(SHIPPING_USD)}</span>
                  </p>
                  <p className="mt-1 flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span>{formatMoney(subtotal + SHIPPING_USD)}</span>
                  </p>
                </div>
              );
            })}
          </div>
          <p className="mt-6 text-sm">
            Merchandise {formatMoney(merchandiseTotal)} · Combined shipping{" "}
            {formatMoney(groups.length * SHIPPING_USD)}
          </p>
          {error ? <p className="mt-3 text-sm text-brand-red">{error}</p> : null}
          <button className="gold-btn mt-6 w-full" type="submit" disabled={pending}>
            {pending ? "Placing orders…" : "Place order"}
          </button>
        </div>
      </form>
    </div>
  );
}
