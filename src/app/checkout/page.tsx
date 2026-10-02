"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/site/PageHeader";
import { readReferralCode } from "@/components/shop/ReferralCapture";
import { useCart } from "@/components/shop/CartProvider";
import { MIN_ORDER_USD, SHIPPING_USD, formatMoney } from "@/lib/constants";
import { WarehouseCode } from "@/lib/enums";

type CheckoutOrder = {
  id: string;
  orderNumber: string;
  warehouse: string;
  grandTotal: number;
  checkoutLink?: string | null;
  payUrl?: string | null;
};

export default function CheckoutPage() {
  const router = useRouter();
  const { items, merchandiseTotal, clear } = useCart();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const shippingTotal = useMemo(() => {
    const hasW1 = items.some((item) => item.warehouse === WarehouseCode.WAREHOUSE_1);
    const hasW2 = items.some((item) => item.warehouse === WarehouseCode.WAREHOUSE_2);
    if (hasW1 && hasW2) return SHIPPING_USD * 2;
    return items.length > 0 ? SHIPPING_USD : 0;
  }, [items]);

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
      checkoutLink?: string | null;
      orders?: CheckoutOrder[];
    };
    setPending(false);
    if (!response.ok) {
      setError(data.error || "Checkout failed.");
      return;
    }
    const orders = data.orders || [];
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("invictus-checkout-pay", JSON.stringify(orders));
    }
    clear();
    const checkoutLink = data.checkoutLink || orders.find((order) => order.checkoutLink)?.checkoutLink;
    if (checkoutLink && orders.length === 1) {
      window.location.assign(checkoutLink);
      return;
    }
    router.push(`/checkout/complete?group=${encodeURIComponent(data.groupId || "")}`);
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
        lede={`$${MIN_ORDER_USD} minimum. Bitcoin is the accepted payment method. After you place the order you will be sent to BTCPay Server to complete payment.`}
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
          <h2 className="text-lg">Order summary</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {items.map((item) => (
              <li key={item.productId} className="flex justify-between gap-3">
                <span>
                  {item.name} × {item.quantity}
                </span>
                <span>{formatMoney(item.unitPrice * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 flex justify-between text-sm text-muted-foreground">
            <span>Shipping</span>
            <span>{formatMoney(shippingTotal)}</span>
          </p>
          <p className="mt-2 flex justify-between text-sm">
            <span>Total</span>
            <span>{formatMoney(merchandiseTotal + shippingTotal)}</span>
          </p>
          {error ? <p className="mt-3 text-sm text-brand-red">{error}</p> : null}
          <button className="gold-btn mt-6 w-full" type="submit" disabled={pending}>
            {pending ? "Opening Bitcoin payment…" : "Place order and pay with Bitcoin"}
          </button>
        </div>
      </form>
    </div>
  );
}
