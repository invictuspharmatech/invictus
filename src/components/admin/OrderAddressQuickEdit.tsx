"use client";

import { useEffect, useState } from "react";
import type { ApiOrder } from "@/lib/api-types";

type Draft = {
  customerName: string;
  customerEmail: string;
  shippingLine1: string;
  shippingLine2: string;
  shippingCity: string;
  shippingState: string;
  shippingPostal: string;
  shippingCountry: string;
};

function draftFrom(order: ApiOrder): Draft {
  return {
    customerName: order.customerName || "",
    customerEmail: order.customerEmail || "",
    shippingLine1: order.shippingLine1 || "",
    shippingLine2: order.shippingLine2 || "",
    shippingCity: order.shippingCity || "",
    shippingState: order.shippingState || "",
    shippingPostal: order.shippingPostal || "",
    shippingCountry: order.shippingCountry || "US",
  };
}

function orderBlocked(status: string): boolean {
  const key = status.toUpperCase();
  return key === "CANCELLED" || key === "REFUNDED" || key === "FAILED";
}

export function OrderAddressQuickEdit({
  order,
  onCancel,
  onSaved,
}: {
  order: ApiOrder;
  onCancel: () => void;
  onSaved: (next: ApiOrder) => void;
}) {
  const [draft, setDraft] = useState(() => draftFrom(order));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const blocked = orderBlocked(order.status);

  useEffect(() => {
    setDraft(draftFrom(order));
    setError("");
  }, [order]);

  async function save() {
    if (blocked) return;
    if (
      !draft.shippingLine1.trim() ||
      !draft.shippingCity.trim() ||
      !draft.shippingState.trim() ||
      !draft.shippingPostal.trim()
    ) {
      setError("Address line 1, city, state, and postal code are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/shipping`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = (await res.json().catch(() => ({}))) as ApiOrder & { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not save address.");
        return;
      }
      onSaved(data);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-t border-border/40 bg-muted/20 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">
          Quick edit address · {order.orderNumber}
        </p>
        <div className="flex gap-2">
          <button type="button" className="ghost-btn" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="gold-btn"
            disabled={saving || blocked}
            onClick={() => void save()}
          >
            {saving ? "Saving…" : "Save address"}
          </button>
        </div>
      </div>
      {blocked ? (
        <p className="mt-2 text-sm text-brand-red">This order status cannot be edited.</p>
      ) : null}
      {error ? <p className="mt-2 text-sm text-brand-red">{error}</p> : null}
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            ["customerName", "Customer name", "sm:col-span-1"],
            ["customerEmail", "Email", "sm:col-span-1"],
            ["shippingLine1", "Address line 1", "sm:col-span-2 lg:col-span-2"],
            ["shippingLine2", "Address line 2", "sm:col-span-2 lg:col-span-2"],
            ["shippingCity", "City", ""],
            ["shippingState", "State", ""],
            ["shippingPostal", "Postal", ""],
            ["shippingCountry", "Country", ""],
          ] as const
        ).map(([key, label, span]) => (
          <label key={key} className={`grid gap-1 text-xs ${span}`}>
            {label}
            <input
              className="field"
              value={draft[key]}
              disabled={blocked}
              onChange={(event) => setDraft((prev) => ({ ...prev, [key]: event.target.value }))}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
