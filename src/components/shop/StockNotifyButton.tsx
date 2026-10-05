"use client";

import { useEffect, useState } from "react";

export function StockNotifyButton({
  productId,
  outOfStock,
}: {
  productId: string;
  outOfStock: boolean;
}) {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!outOfStock || !email.includes("@")) return;
    void fetch(`/api/products/${productId}/stock-notify?email=${encodeURIComponent(email)}`)
      .then((res) => res.json())
      .then((row) => setSubscribed(Boolean(row?.subscribed)))
      .catch(() => undefined);
  }, [email, outOfStock, productId]);

  if (!outOfStock) return null;

  async function subscribe() {
    setBusy(true);
    setError("");
    const response = await fetch(`/api/products/${productId}/stock-notify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const payload = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(payload.error || "Could not subscribe.");
      return;
    }
    setSubscribed(true);
  }

  return (
    <div className="mt-4 max-w-sm">
      {subscribed ? (
        <p className="text-sm">We will email you when this is back in stock.</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">Out of stock. Get an email when it returns.</p>
          <div className="mt-2 flex gap-2">
            <input
              className="field"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <button type="button" className="gold-btn" disabled={busy} onClick={() => void subscribe()}>
              Notify me
            </button>
          </div>
          {error ? <p className="mt-2 text-sm text-brand-red">{error}</p> : null}
        </>
      )}
    </div>
  );
}
