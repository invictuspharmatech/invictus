"use client";

import { useEffect, useState } from "react";

type MeResponse = {
  email?: string;
  name?: string;
  error?: string;
};

export function StockNotifyButton({
  productId,
  outOfStock,
  initialEmail = "",
}: {
  productId: string;
  outOfStock: boolean;
  /** Prefill from server session when available. */
  initialEmail?: string;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [loggedInEmail, setLoggedInEmail] = useState(initialEmail.trim());
  const [subscribed, setSubscribed] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!outOfStock) return;
    let cancelled = false;
    void fetch("/api/auth/me")
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as MeResponse;
      })
      .then((me) => {
        if (cancelled || !me?.email) return;
        setLoggedInEmail(me.email);
        setEmail(me.email);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [outOfStock]);

  useEffect(() => {
    if (!outOfStock || !email.includes("@")) return;
    void fetch(`/api/products/${productId}/stock-notify?email=${encodeURIComponent(email)}`)
      .then((res) => res.json())
      .then((row) => setSubscribed(Boolean(row?.subscribed)))
      .catch(() => undefined);
  }, [email, outOfStock, productId]);

  if (!outOfStock) return null;

  async function subscribe() {
    const target = (loggedInEmail || email).trim();
    if (!target.includes("@")) {
      setError("Enter a valid email.");
      return;
    }
    setBusy(true);
    setError("");
    const response = await fetch(`/api/products/${productId}/stock-notify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: target }),
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
          <p className="text-sm text-muted-foreground">
            Out of stock. Get an email when it returns.
          </p>
          {loggedInEmail ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p className="text-sm text-muted-foreground">
                We&apos;ll notify <span className="text-foreground">{loggedInEmail}</span>
              </p>
              <button
                type="button"
                className="gold-btn"
                disabled={busy}
                onClick={() => void subscribe()}
              >
                {busy ? "Saving…" : "Notify me"}
              </button>
            </div>
          ) : (
            <div className="mt-2 flex gap-2">
              <input
                className="field"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <button
                type="button"
                className="gold-btn"
                disabled={busy}
                onClick={() => void subscribe()}
              >
                Notify me
              </button>
            </div>
          )}
          {error ? <p className="mt-2 text-sm text-brand-red">{error}</p> : null}
        </>
      )}
    </div>
  );
}
