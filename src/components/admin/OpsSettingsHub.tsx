"use client";

import { FormEvent, useEffect, useState } from "react";

type TabKey = "checkout" | "shipping" | "orderNumbering" | "accounts";
type SettingsSection = "checkout" | "shipping" | "orderNumbering" | "affiliate";

type ShippingFeeRow = {
  id: string;
  name: string;
  fee: number | string;
  sortOrder: number | string;
};

type OpsSettings = {
  checkout: {
    minOrderAmount: number | null;
    maxOrderAmount: number | null;
    includeShippingInOrderLimit: boolean;
  };
  shipping: { fees: ShippingFeeRow[] };
  orderNumbering: {
    enabled: boolean;
    prefix: string;
    numDigits: number;
    preview: string;
  };
  affiliate: {
    payoutType: "STORE_CREDIT" | "COMMISSION";
    type: "PERCENT" | "FIXED";
    amount: number;
  };
};

const TABS: { key: TabKey; label: string }[] = [
  { key: "checkout", label: "Checkout" },
  { key: "shipping", label: "Shipping" },
  { key: "orderNumbering", label: "Sequential order number" },
  { key: "accounts", label: "Accounts" },
];

function moneyInput(value: number | null | undefined) {
  return value == null || value === 0 ? "" : String(value);
}

export function OpsSettingsHub() {
  const [tab, setTab] = useState<TabKey>("checkout");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkout, setCheckout] = useState({
    minOrderAmount: "100",
    maxOrderAmount: "",
    includeShippingInOrderLimit: false,
  });
  const [fees, setFees] = useState<ShippingFeeRow[]>([]);
  const [orderNumbering, setOrderNumbering] = useState({
    enabled: false,
    prefix: "INV",
    numDigits: 5,
    preview: "INV-XXXXXXXX-1",
  });
  const [affiliate, setAffiliate] = useState({
    payoutType: "STORE_CREDIT" as "STORE_CREDIT" | "COMMISSION",
    type: "PERCENT" as "PERCENT" | "FIXED",
    amount: "10",
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const response = await fetch("/api/admin/ops-settings");
      const data = (await response.json()) as OpsSettings & { error?: string };
      if (cancelled) return;
      if (!response.ok) {
        setError(data.error || "Failed to load settings.");
        setLoading(false);
        return;
      }
      setCheckout({
        minOrderAmount: moneyInput(data.checkout.minOrderAmount),
        maxOrderAmount: moneyInput(data.checkout.maxOrderAmount),
        includeShippingInOrderLimit: data.checkout.includeShippingInOrderLimit,
      });
      setFees(data.shipping.fees);
      setOrderNumbering(data.orderNumbering);
      setAffiliate({
        payoutType: data.affiliate.payoutType,
        type: data.affiliate.type,
        amount: String(data.affiliate.amount),
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(section: SettingsSection, payload: Record<string, unknown>) {
    setSaving(true);
    setMessage(null);
    setError(null);
    const response = await fetch("/api/admin/ops-settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ section, ...payload }),
    });
    const data = (await response.json()) as Partial<OpsSettings> & { error?: string };
    setSaving(false);
    if (!response.ok) {
      setError(data.error || "Could not save settings.");
      return;
    }
    if (data.orderNumbering) setOrderNumbering(data.orderNumbering);
    if (data.shipping?.fees) setFees(data.shipping.fees);
    if (data.checkout) {
      setCheckout({
        minOrderAmount: moneyInput(data.checkout.minOrderAmount),
        maxOrderAmount: moneyInput(data.checkout.maxOrderAmount),
        includeShippingInOrderLimit: data.checkout.includeShippingInOrderLimit,
      });
    }
    if (data.affiliate) {
      setAffiliate({
        payoutType: data.affiliate.payoutType,
        type: data.affiliate.type,
        amount: String(data.affiliate.amount),
      });
    }
    setMessage("Saved.");
  }

  function onCheckout(event: FormEvent) {
    event.preventDefault();
    void save("checkout", {
      minOrderAmount: checkout.minOrderAmount,
      maxOrderAmount: checkout.maxOrderAmount,
      includeShippingInOrderLimit: checkout.includeShippingInOrderLimit,
    });
  }

  function onShipping(event: FormEvent) {
    event.preventDefault();
    void save("shipping", { fees });
  }

  function onNumbering(event: FormEvent) {
    event.preventDefault();
    void save("orderNumbering", orderNumbering);
  }

  if (loading) {
    return <p className="mt-6 text-sm text-muted-foreground">Loading settings…</p>;
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-2 border-b border-border/40 pb-3">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`text-[12px] uppercase tracking-[0.16em] ${
              tab === item.key ? "text-foreground" : "text-muted-foreground"
            }`}
            onClick={() => {
              setTab(item.key);
              setMessage(null);
              setError(null);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      {error ? <p className="mt-4 text-sm text-brand-red">{error}</p> : null}
      {message ? <p className="mt-4 text-sm text-muted-foreground">{message}</p> : null}

      {tab === "checkout" ? (
        <form onSubmit={onCheckout} className="tile mt-6 max-w-2xl space-y-4">
          <h2 className="text-lg">Checkout order amount</h2>
          <p className="text-sm text-muted-foreground">
            Customers are blocked on cart and checkout unless the charged merchandise (after
            discounts) stays in range. Shipping can be included below.
          </p>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={checkout.includeShippingInOrderLimit}
              onChange={(event) =>
                setCheckout((prev) => ({
                  ...prev,
                  includeShippingInOrderLimit: event.target.checked,
                }))
              }
            />
            Include shipping in the amount used for min/max checks
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              Minimum order (USD)
              <input
                className="field mt-1"
                type="number"
                min={0}
                step="0.01"
                placeholder="No minimum"
                value={checkout.minOrderAmount}
                onChange={(event) =>
                  setCheckout((prev) => ({ ...prev, minOrderAmount: event.target.value }))
                }
              />
            </label>
            <label className="text-sm">
              Maximum order (USD)
              <input
                className="field mt-1"
                type="number"
                min={0}
                step="0.01"
                placeholder="No maximum"
                value={checkout.maxOrderAmount}
                onChange={(event) =>
                  setCheckout((prev) => ({ ...prev, maxOrderAmount: event.target.value }))
                }
              />
            </label>
          </div>
          <button className="gold-btn" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save checkout limits"}
          </button>
        </form>
      ) : null}

      {tab === "shipping" ? (
        <form onSubmit={onShipping} className="tile mt-6 space-y-4">
          <h2 className="text-lg">Checkout shipping fees</h2>
          <p className="text-sm text-muted-foreground">
            Named flat-rate options shown on cart and checkout. Leave empty to fall back to $20
            standard shipping.
          </p>
          {fees.length === 0 ? (
            <p className="text-sm text-muted-foreground">No options yet — click Add option.</p>
          ) : null}
          {fees.map((row, index) => (
            <div key={row.id} className="flex flex-wrap items-end gap-3 border border-border/40 p-3">
              <label className="min-w-40 flex-1 text-sm">
                Shipping name
                <input
                  className="field mt-1"
                  value={row.name}
                  onChange={(event) =>
                    setFees((rows) =>
                      rows.map((item, idx) =>
                        idx === index ? { ...item, name: event.target.value } : item,
                      ),
                    )
                  }
                />
              </label>
              <label className="w-28 text-sm">
                Fee ($)
                <input
                  className="field mt-1"
                  type="number"
                  min={0}
                  step="0.01"
                  value={row.fee}
                  onChange={(event) =>
                    setFees((rows) =>
                      rows.map((item, idx) =>
                        idx === index ? { ...item, fee: event.target.value } : item,
                      ),
                    )
                  }
                />
              </label>
              <label className="w-20 text-sm">
                Order
                <input
                  className="field mt-1"
                  type="number"
                  min={0}
                  value={row.sortOrder}
                  onChange={(event) =>
                    setFees((rows) =>
                      rows.map((item, idx) =>
                        idx === index ? { ...item, sortOrder: event.target.value } : item,
                      ),
                    )
                  }
                />
              </label>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setFees((rows) => rows.filter((_, idx) => idx !== index))}
              >
                Remove
              </button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="ghost-btn"
              onClick={() =>
                setFees((rows) => [
                  ...rows,
                  {
                    id: `new-${Date.now()}`,
                    name: "",
                    fee: 20,
                    sortOrder: rows.length,
                  },
                ])
              }
            >
              Add option
            </button>
            <button className="gold-btn" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save shipping fees"}
            </button>
          </div>
        </form>
      ) : null}

      {tab === "orderNumbering" ? (
        <form onSubmit={onNumbering} className="tile mt-6 max-w-xl space-y-4">
          <h2 className="text-lg">Sequential order number</h2>
          <p className="text-sm text-muted-foreground">
            When enabled, new checkouts use prefix + calendar year + a zero-padded counter (resets
            each year). Warehouse splits still append -1 / -2. Off keeps random INV-XXXXXXXX IDs.
          </p>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={orderNumbering.enabled}
              onChange={(event) =>
                setOrderNumbering((prev) => ({ ...prev, enabled: event.target.checked }))
              }
            />
            Enable sequential order numbers
          </label>
          <label className="text-sm">
            Prefix
            <input
              className="field mt-1"
              maxLength={32}
              disabled={!orderNumbering.enabled}
              value={orderNumbering.prefix}
              onChange={(event) =>
                setOrderNumbering((prev) => ({ ...prev, prefix: event.target.value }))
              }
            />
          </label>
          <label className="text-sm">
            Counter width (digits)
            <input
              className="field mt-1 max-w-xs"
              type="number"
              min={1}
              max={12}
              disabled={!orderNumbering.enabled}
              value={orderNumbering.numDigits}
              onChange={(event) =>
                setOrderNumbering((prev) => ({
                  ...prev,
                  numDigits: Math.min(12, Math.max(1, parseInt(event.target.value, 10) || 5)),
                }))
              }
            />
          </label>
          <p className="text-sm text-muted-foreground">
            Preview: <code>{orderNumbering.preview}</code>
          </p>
          <button className="gold-btn" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save order numbering"}
          </button>
        </form>
      ) : null}

      {tab === "accounts" ? (
        <div className="mt-6 max-w-xl">
          <form
            className="tile space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void save("affiliate", affiliate);
            }}
          >
            <h2 className="text-lg">Affiliate defaults</h2>
            <p className="text-sm text-muted-foreground">
              Applied when an affiliate application is approved (or when an account is first marked
              affiliate).
            </p>
            <label className="text-sm">
              Payout type
              <select
                className="field mt-1"
                value={affiliate.payoutType}
                onChange={(event) =>
                  setAffiliate((prev) => ({
                    ...prev,
                    payoutType: event.target.value as "STORE_CREDIT" | "COMMISSION",
                  }))
                }
              >
                <option value="STORE_CREDIT">Store credit</option>
                <option value="COMMISSION">Commission</option>
              </select>
            </label>
            <label className="text-sm">
              Amount type
              <select
                className="field mt-1"
                value={affiliate.type}
                onChange={(event) =>
                  setAffiliate((prev) => ({
                    ...prev,
                    type: event.target.value as "PERCENT" | "FIXED",
                  }))
                }
              >
                <option value="PERCENT">Percentage</option>
                <option value="FIXED">Fixed</option>
              </select>
            </label>
            <label className="text-sm">
              Default amount {affiliate.type === "PERCENT" ? "(%)" : "($)"}
              <input
                className="field mt-1"
                type="number"
                min={0}
                max={affiliate.type === "PERCENT" ? 100 : undefined}
                step="0.01"
                value={affiliate.amount}
                onChange={(event) =>
                  setAffiliate((prev) => ({ ...prev, amount: event.target.value }))
                }
              />
            </label>
            <button className="gold-btn" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save affiliate defaults"}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
