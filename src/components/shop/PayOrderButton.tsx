"use client";

import { useState } from "react";
import type { ApiBtcInvoice } from "@/lib/api-types";

export function PayOrderButton({
  orderId,
  checkoutLink,
  paymentStatus,
  status,
}: {
  orderId: string;
  checkoutLink?: string | null;
  paymentStatus?: string;
  status: string;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const blocked = [
    "CANCELLED",
    "FAILED",
    "COMPLETED",
    "REFUNDED",
    "PARTIALLY_FILLED",
    "SHIPPED",
    "DELIVERED",
    "PROCESSING",
  ].includes(status);
  const awaiting =
    !blocked &&
    ((paymentStatus || "PENDING") === "PENDING" || paymentStatus === "PARTIAL");
  if (!awaiting) return null;

  async function openInvoice() {
    if (checkoutLink) {
      window.location.assign(checkoutLink);
      return;
    }
    setBusy(true);
    setError("");
    const response = await fetch(`/api/btc/invoice/${orderId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const data = (await response.json()) as ApiBtcInvoice & { error?: string };
    setBusy(false);
    if (!response.ok || !data.checkoutLink) {
      setError(data.error || "Could not open Bitcoin payment.");
      return;
    }
    window.location.assign(data.checkoutLink);
  }

  return (
    <div className="mt-3">
      <button className="gold-btn" type="button" disabled={busy} onClick={() => void openInvoice()}>
        {busy ? "Opening…" : "Pay with Bitcoin"}
      </button>
      {error ? <p className="mt-2 text-sm text-brand-red">{error}</p> : null}
    </div>
  );
}
