"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/site/PageHeader";
import { formatMoney } from "@/lib/constants";
import type { ApiBtcInvoice } from "@/lib/api-types";

type PayInfo = {
  orderId: string;
  orderNumber: string;
  paymentStatus: string;
  orderStatus: string;
  grandTotal: number;
  canPay: boolean;
  checkoutWindowClosed: boolean;
  invoice: ApiBtcInvoice | null;
};

function OrderPayInner() {
  const searchParams = useSearchParams();
  const token = (searchParams.get("t") || "").trim();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<PayInfo | null>(null);
  const [invoice, setInvoice] = useState<ApiBtcInvoice | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setError("This link is missing payment information. Open Pay now from your order email.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/orders/pay?t=${encodeURIComponent(token)}`);
    const data = (await response.json()) as PayInfo & { error?: string };
    if (!response.ok) {
      setError(data.error || "Invalid payment link.");
      setInfo(null);
      setLoading(false);
      return;
    }
    setInfo(data);
    setInvoice(data.invoice);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createInvoice() {
    if (!token) return;
    setBusy(true);
    setError(null);
    const response = await fetch("/api/orders/pay/invoice", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ t: token }),
    });
    const data = (await response.json()) as ApiBtcInvoice & { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(data.error || "Could not create a Bitcoin invoice.");
      return;
    }
    setInvoice(data);
    if (data.checkoutLink) {
      window.location.assign(data.checkoutLink);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center text-sm text-muted-foreground">
        Checking your payment link…
      </div>
    );
  }

  if (error && !info) {
    return (
      <div className="mx-auto max-w-xl px-4 pb-20 sm:px-6">
        <PageHeader title="Payment link" />
        <div className="tile text-sm">
          <p>{error}</p>
          <Link href="/account/orders" className="mt-4 inline-block text-muted-foreground">
            My orders
          </Link>
        </div>
      </div>
    );
  }

  const paid =
    info?.paymentStatus === "PAID" ||
    invoice?.status === "complete" ||
    invoice?.status === "paid";
  const checkoutLink = invoice?.checkoutClosed ? null : invoice?.checkoutLink || null;

  return (
    <div className="mx-auto max-w-xl px-4 pb-20 sm:px-6">
      <PageHeader title="Pay with Bitcoin" lede={`Order ${info?.orderNumber || ""}`} />
      <div className="tile space-y-4">
        {typeof info?.grandTotal === "number" ? (
          <p className="text-lg">{formatMoney(info.grandTotal)}</p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          Status: {(info?.orderStatus || "").toLowerCase()} · payment{" "}
          {(info?.paymentStatus || "").toLowerCase()}
        </p>
        {paid ? (
          <p>This order is paid. Thank you.</p>
        ) : info?.checkoutWindowClosed || !info?.canPay ? (
          <p className="text-sm text-brand-red">
            This Bitcoin payment link is no longer available. Place a new order to pay.
          </p>
        ) : checkoutLink ? (
          <a className="gold-btn inline-flex" href={checkoutLink}>
            Open BTCPay invoice
          </a>
        ) : (
          <button className="gold-btn" type="button" disabled={busy} onClick={() => void createInvoice()}>
            {busy ? "Creating invoice…" : "Create Bitcoin invoice"}
          </button>
        )}
        {error ? <p className="text-sm text-brand-red">{error}</p> : null}
      </div>
    </div>
  );
}

export default function OrderPayPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-xl px-4 py-20 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <OrderPayInner />
    </Suspense>
  );
}
