"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/site/PageHeader";
import { BtcPayInvoiceModal } from "@/components/shop/BtcPayInvoiceModal";
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
  const [invoiceOpen, setInvoiceOpen] = useState(false);

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

  const checkoutLink = orders.find((order) => order.checkoutLink)?.checkoutLink || null;
  const payUrl = orders.find((order) => order.payUrl)?.payUrl || null;
  const total = useMemo(
    () => orders.reduce((sum, order) => sum + (Number(order.grandTotal) || 0), 0),
    [orders],
  );

  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
      <PageHeader
        title="Pay with Bitcoin"
        lede="Your order is reserved. Complete the Bitcoin invoice in the popup — you stay on this site."
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
        <article className="tile">
          <h2 className="text-lg">Order total</h2>
          <p className="mt-1 text-sm">{formatMoney(total)}</p>
          {checkoutLink ? (
            <button type="button" className="gold-btn mt-4 inline-flex" onClick={() => setInvoiceOpen(true)}>
              Open Bitcoin invoice
            </button>
          ) : payUrl ? (
            <Link className="gold-btn mt-4 inline-flex" href={payUrl}>
              Open payment page
            </Link>
          ) : (
            <p className="mt-3 text-sm text-brand-red">
              Payment link is not ready. Check your email or contact the store.
            </p>
          )}
        </article>
      )}
      <Link href="/account/orders" className="mt-8 inline-block text-sm text-muted-foreground">
        View orders
      </Link>
      {invoiceOpen && checkoutLink ? (
        <BtcPayInvoiceModal checkoutLink={checkoutLink} onClose={() => setInvoiceOpen(false)} />
      ) : null}
    </div>
  );
}
