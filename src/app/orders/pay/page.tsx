"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/site/PageHeader";
import { BtcPayInvoiceModal } from "@/components/shop/BtcPayInvoiceModal";
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
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const autoOpened = useRef(false);

  const createInvoice = useCallback(async (payToken: string) => {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/orders/pay/invoice", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ t: payToken }),
    });
    const data = (await response.json()) as ApiBtcInvoice & { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(data.error || "Could not create a Bitcoin invoice.");
      return null;
    }
    setInvoice(data);
    if (data.checkoutLink && !data.checkoutClosed) {
      setInvoiceOpen(true);
    }
    return data;
  }, []);

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

    const paid =
      data.paymentStatus === "PAID" ||
      data.invoice?.status === "complete" ||
      data.invoice?.status === "paid";
    const existingLink =
      data.invoice && !data.invoice.checkoutClosed ? data.invoice.checkoutLink : null;

    // Open the invoice popup immediately — never leave the shopper on a
    // "Create Bitcoin invoice" interstitial as the primary path.
    if (!paid && data.canPay && !data.checkoutWindowClosed && !autoOpened.current) {
      autoOpened.current = true;
      if (existingLink) {
        setInvoiceOpen(true);
      } else {
        await createInvoice(token);
      }
    }
  }, [token, createInvoice]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center text-sm text-muted-foreground">
        Opening Bitcoin payment…
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
          <button type="button" className="gold-btn inline-flex" onClick={() => setInvoiceOpen(true)}>
            Open Bitcoin invoice
          </button>
        ) : (
          <button
            className="gold-btn"
            type="button"
            disabled={busy}
            onClick={() => void createInvoice(token)}
          >
            {busy ? "Opening invoice…" : "Open Bitcoin invoice"}
          </button>
        )}
        {error ? <p className="text-sm text-brand-red">{error}</p> : null}
      </div>
      {invoiceOpen && checkoutLink ? (
        <BtcPayInvoiceModal checkoutLink={checkoutLink} onClose={() => setInvoiceOpen(false)} />
      ) : null}
    </div>
  );
}

export default function OrderPayPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-xl px-4 py-20 text-center text-sm text-muted-foreground">
          Opening Bitcoin payment…
        </div>
      }
    >
      <OrderPayInner />
    </Suspense>
  );
}
