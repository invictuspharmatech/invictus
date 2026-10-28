"use client";

import { useCallback, useEffect, useState } from "react";

type Props = {
  productId: string;
  /** compact = product card; full = product detail (GreatLife) */
  variant?: "compact" | "full";
  className?: string;
  /** When false, render nothing (parent already gated with productShowsStockNotify). */
  outOfStock?: boolean;
  initialEmail?: string;
};

type MeResponse = { email?: string };

const NOTIFY_LABEL = "Notify Me When Back In Stock";

export function StockNotifyButton({
  productId,
  variant = "compact",
  className = "",
  outOfStock = true,
  initialEmail = "",
}: Props) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(initialEmail.trim() || null);
  const [guestEmail, setGuestEmail] = useState("");
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(
    async (emailHint?: string | null) => {
      if (!emailHint?.includes("@")) return;
      try {
        const res = await fetch(
          `/api/products/${productId}/stock-notify?email=${encodeURIComponent(emailHint)}`,
        );
        const row = (await res.json()) as { subscribed?: boolean };
        setSubscribed(Boolean(row?.subscribed));
      } catch {
        /* ignore */
      }
    },
    [productId],
  );

  useEffect(() => {
    if (!outOfStock) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const me = (await res.json()) as MeResponse;
          const email = me?.email ? String(me.email) : null;
          if (!cancelled && email) {
            setUserEmail(email);
            await refreshStatus(email);
          }
        } else if (initialEmail.includes("@")) {
          await refreshStatus(initialEmail);
        }
      } catch {
        if (!cancelled && initialEmail.includes("@")) await refreshStatus(initialEmail);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [outOfStock, productId, initialEmail, refreshStatus]);

  if (!outOfStock || loading) return null;

  const isFull = variant === "full";

  async function handleSubscribe(emailOverride?: string) {
    setSubmitting(true);
    setError(null);
    const email = (emailOverride ?? userEmail ?? guestEmail).trim();
    if (!userEmail && !email.includes("@")) {
      setError("Enter a valid email.");
      setSubmitting(false);
      return;
    }
    try {
      const response = await fetch(`/api/products/${productId}/stock-notify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: userEmail || email }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "Could not subscribe. Please try again.");
        return;
      }
      setSubscribed(true);
      setShowGuestForm(false);
      if (!userEmail && email) setGuestEmail(email);
    } catch {
      setError("Could not subscribe. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUnsubscribe() {
    setSubmitting(true);
    setError(null);
    try {
      const email = userEmail || guestEmail.trim();
      const url = email
        ? `/api/products/${productId}/stock-notify?email=${encodeURIComponent(email)}`
        : `/api/products/${productId}/stock-notify`;
      await fetch(url, { method: "DELETE" });
      setSubscribed(false);
    } catch {
      setError("Could not cancel subscription.");
    } finally {
      setSubmitting(false);
    }
  }

  if (subscribed) {
    const shown = guestEmail || userEmail;
    return (
      <div className={className}>
        <div
          className={`flex ${
            isFull ? "flex-col gap-3 sm:flex-row sm:items-center" : "flex-col gap-2"
          } rounded-xl border border-signal/35 bg-signal/10 px-3 py-2.5`}
        >
          <p className={`${isFull ? "text-sm" : "text-xs"} text-foreground`}>
            ✓ You&apos;ll be emailed when this is back in stock
            {shown ? ` (${shown})` : ""}
          </p>
          <button
            type="button"
            onClick={() => void handleUnsubscribe()}
            disabled={submitting}
            className={`${isFull ? "text-sm" : "text-xs"} shrink-0 font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50`}
          >
            Cancel alert
          </button>
        </div>
        {error ? <p className="mt-1 text-xs text-brand-red">{error}</p> : null}
      </div>
    );
  }

  if (userEmail) {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={() => void handleSubscribe()}
          disabled={submitting}
          className={`w-full rounded-xl border border-signal/40 bg-signal/15 px-4 py-2.5 ${
            isFull ? "text-sm" : "text-xs"
          } font-semibold text-signal transition hover:bg-signal/25 disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {submitting ? "Subscribing…" : NOTIFY_LABEL}
        </button>
        {error ? <p className="mt-1 text-xs text-brand-red">{error}</p> : null}
      </div>
    );
  }

  if (!showGuestForm) {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setShowGuestForm(true);
          }}
          className={`w-full rounded-xl border border-signal/40 bg-signal/15 px-4 py-2.5 ${
            isFull ? "text-sm" : "text-xs"
          } font-semibold text-signal transition hover:bg-signal/25`}
        >
          {NOTIFY_LABEL}
        </button>
      </div>
    );
  }

  return (
    <div
      className={className}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div className="space-y-2 rounded-xl border border-border/50 bg-muted/40 p-3">
        <label className={`block ${isFull ? "text-xs" : "text-[11px]"} text-muted-foreground`}>
          Your email for back-in-stock alerts
        </label>
        <input
          type="email"
          value={guestEmail}
          onChange={(event) => setGuestEmail(event.target.value)}
          placeholder="you@example.com"
          className={`field w-full ${isFull ? "text-sm" : "text-xs"}`}
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void handleSubscribe(guestEmail.trim())}
            disabled={submitting || !guestEmail.trim()}
            className={`gold-btn flex-1 ${isFull ? "text-sm" : "text-xs"} disabled:opacity-50`}
          >
            {submitting ? "Saving…" : "Subscribe"}
          </button>
          <button
            type="button"
            onClick={() => setShowGuestForm(false)}
            className={`ghost-btn ${isFull ? "text-sm" : "text-xs"}`}
          >
            Cancel
          </button>
        </div>
      </div>
      {error ? <p className="mt-1 text-xs text-brand-red">{error}</p> : null}
    </div>
  );
}
