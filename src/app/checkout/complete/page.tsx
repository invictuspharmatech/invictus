"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/site/PageHeader";
import { formatMoney } from "@/lib/constants";

type PayOrder = {
  id: string;
  orderNumber: string;
  warehouse?: string;
  grandTotal?: number;
  checkoutLink?: string | null;
  payUrl?: string | null;
};

export default function CheckoutCompletePage() {
  const [orders, setOrders] = useState<PayOrder[]>([]);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem("invictus-checkout-pay");
      if (!raw) return;
      const parsed = JSON.parse(raw) as PayOrder[];
      if (Array.isArray(parsed)) setOrders(parsed);
    } catch {
      setOrders([]);
    }
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
      <PageHeader
        title="Pay with Bitcoin"
        lede={
          orders.length > 1
            ? "Your order is reserved. Open BTCPay Server to complete each invoice below."
            : "Your order is reserved. Open BTCPay Server to send the exact amount."
        }
      />
      {orders.length === 0 ? (
        <div className="tile text-sm">
          <p>No checkout session was found in this browser.</p>
          <p className="mt-2 text-muted-foreground">
            Use the Pay now link in your confirmation email, or open My account → Orders if you
            placed this while signed in.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <article key={order.id || order.orderNumber} className="tile">
              <h2 className="text-lg">{order.orderNumber}</h2>
              {typeof order.grandTotal === "number" ? (
                <p className="mt-1 text-sm">{formatMoney(order.grandTotal)}</p>
              ) : null}
              {order.checkoutLink ? (
                <a className="gold-btn mt-4 inline-flex" href={order.checkoutLink}>
                  Open BTCPay invoice
                </a>
              ) : order.payUrl ? (
                <Link className="gold-btn mt-4 inline-flex" href={order.payUrl}>
                  Open payment page
                </Link>
              ) : (
                <p className="mt-3 text-sm text-brand-red">
                  Payment link is not ready. Check your email or contact the store.
                </p>
              )}
            </article>
          ))}
        </div>
      )}
      <Link href="/account/orders" className="mt-8 inline-block text-sm text-muted-foreground">
        View orders
      </Link>
    </div>
  );
}
