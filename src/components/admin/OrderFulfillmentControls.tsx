"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiOrder, ApiWarehouseSettings } from "@/lib/api-types";
import { isFullAdmin } from "@/lib/roles";
import { oppositeWarehouse, warehouseLabel } from "@/lib/warehouse";

const SPLIT_STATUSES = new Set(["PAID", "PROCESSING", "PARTIALLY_FILLED"]);

type SplitResult = {
  ok?: boolean;
  error?: string;
  mode?: string;
  warnings?: string[];
  destOrderNumber?: string;
  destOrderId?: string;
  order?: ApiOrder;
};

export function OrderFulfillmentControls({
  order,
  policy,
  role,
  onUpdated,
}: {
  order: ApiOrder;
  policy: ApiWarehouseSettings;
  role: string;
  onUpdated?: (next?: ApiOrder) => void;
}) {
  const router = useRouter();
  const admin = isFullAdmin(role);
  const dest = oppositeWarehouse(order.warehouse);
  const policyAllowsMove = Boolean(policy.splitEnabled && policy.manualMoveEnabled);
  const policyAllowsRequest = Boolean(policy.splitEnabled && policy.warehouseRequestEnabled);
  const statusEligible = SPLIT_STATUSES.has((order.status || "").toUpperCase());
  const moveEnabled = admin && policyAllowsMove && statusEligible;
  const requestEnabled = policyAllowsRequest && statusEligible;

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [qtyDraft, setQtyDraft] = useState<Record<string, number>>(() =>
    Object.fromEntries(order.items.map((item) => [item.id, item.quantity])),
  );
  const [open, setOpen] = useState(false);
  const [restockSource, setRestockSource] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);

  const selectedItems = useMemo(
    () => order.items.filter((item) => selected[item.id]),
    [order.items, selected],
  );

  const inactiveReason = !admin
    ? "Only admins can move items between warehouses immediately."
    : !policy.splitEnabled
      ? "Warehouse splitting is disabled in warehouse settings."
      : !policy.manualMoveEnabled
        ? "Manual warehouse moves are disabled in warehouse settings."
        : !statusEligible
          ? "Available when order status is Paid, Processing, or Partially filled."
          : "";

  function toggleAll(checked: boolean) {
    if (!moveEnabled) return;
    setSelected(Object.fromEntries(order.items.map((item) => [item.id, checked])));
  }

  async function submitSplit() {
    if (!moveEnabled) return;
    if (!selectedItems.length) {
      setError("Select at least one item to move.");
      return;
    }
    setBusy(true);
    setError("");
    setWarnings([]);
    try {
      const response = await fetch(`/api/admin/orders/${order.id}/split-move`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          destWarehouse: dest,
          restockSource,
          note,
          items: selectedItems.map((item) => ({
            itemId: item.id,
            quantity: Math.min(
              Math.max(1, Number(qtyDraft[item.id] || item.quantity)),
              item.quantity,
            ),
          })),
        }),
      });
      const payload = (await response.json().catch(() => null)) as SplitResult | null;
      if (!response.ok) {
        setError(payload?.error || "Could not move items.");
        return;
      }
      setWarnings(payload?.warnings || []);
      setOpen(false);
      setSelected({});
      setNote("");
      setRestockSource(false);
      if (payload?.order) {
        onUpdated?.(payload.order);
      } else {
        onUpdated?.();
      }
      router.refresh();
      if (payload?.mode === "created" && payload.destOrderId) {
        window.alert(
          `Created ${payload.destOrderNumber || "new order"} for ${warehouseLabel(dest)}. No new payment was charged.`,
        );
      } else if (payload?.mode === "merged" && payload.destOrderNumber) {
        window.alert(`Moved into existing order ${payload.destOrderNumber}.`);
      } else if (payload?.mode === "reassign") {
        window.alert(`Order reassigned to ${warehouseLabel(dest)}.`);
      }
      if (payload?.warnings?.length) {
        window.alert(`Stock note:\n${payload.warnings.join("\n")}`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function submitRequest(itemId: string, quantity: number) {
    if (!requestEnabled) return;
    setError("");
    const res = await fetch("/api/admin/fulfillment-requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderId: order.id, itemId, quantity }),
    });
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      setError(payload?.error || "Could not submit request.");
      return;
    }
    router.refresh();
    onUpdated?.();
  }

  // Always show for staff so the control is discoverable; inactive when not usable.
  return (
    <div
      className={`mt-4 space-y-3 border-t border-border/40 pt-4 ${
        moveEnabled ? "" : "opacity-60"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Move to {warehouseLabel(dest)}
          </p>
          {!moveEnabled && inactiveReason ? (
            <p className="mt-1 text-xs text-muted-foreground">{inactiveReason}</p>
          ) : null}
        </div>
        {admin ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="ghost-btn"
              disabled={!moveEnabled}
              onClick={() => toggleAll(selectedItems.length !== order.items.length)}
            >
              {selectedItems.length === order.items.length ? "Clear all" : "Select all"}
            </button>
            <button
              type="button"
              className="gold-btn"
              disabled={!moveEnabled || !selectedItems.length}
              onClick={() => {
                setError("");
                setWarnings([]);
                setOpen(true);
              }}
            >
              Move selected ({selectedItems.length})
            </button>
          </div>
        ) : null}
      </div>

      <ul className="space-y-2 text-sm">
        {order.items.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-end gap-2 rounded border border-border/40 px-3 py-2"
          >
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                disabled={!moveEnabled}
                checked={Boolean(selected[item.id])}
                onChange={(event) =>
                  setSelected((prev) => ({ ...prev, [item.id]: event.target.checked }))
                }
              />
              <span className="min-w-40 font-medium">{item.name}</span>
            </label>
            <span className="text-xs text-muted-foreground">× {item.quantity}</span>
            <label className="grid gap-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Move qty
              <input
                className="field max-w-20"
                type="number"
                min={1}
                max={item.quantity}
                disabled={!moveEnabled}
                value={qtyDraft[item.id] ?? item.quantity}
                onChange={(event) =>
                  setQtyDraft((prev) => ({
                    ...prev,
                    [item.id]: Math.max(
                      1,
                      Math.min(item.quantity, Number(event.target.value) || 1),
                    ),
                  }))
                }
              />
            </label>
            {policyAllowsRequest ? (
              <button
                className="ghost-btn"
                type="button"
                disabled={!requestEnabled}
                onClick={() =>
                  void submitRequest(
                    item.id,
                    Math.min(
                      item.quantity,
                      Math.max(1, Number(qtyDraft[item.id] || item.quantity)),
                    ),
                  )
                }
              >
                Request other warehouse
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      {error ? <p className="text-sm text-brand-red">{error}</p> : null}
      {warnings.length ? (
        <div className="rounded border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
          {warnings.map((row) => (
            <p key={row}>{row}</p>
          ))}
        </div>
      ) : null}

      {open && moveEnabled ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4">
          <div className="tile w-full max-w-lg space-y-4 p-5">
            <div>
              <h3 className="text-lg">Move to {warehouseLabel(dest)}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedItems.length === order.items.length &&
                selectedItems.every(
                  (item) => (qtyDraft[item.id] ?? item.quantity) >= item.quantity,
                )
                  ? "All items selected — this order will be reassigned to the other warehouse (same order #)."
                  : `Selected lines will merge into an existing processing order for this customer at ${warehouseLabel(dest)}, or a new fulfillment order will be created. No new payment is charged.`}
              </p>
            </div>

            <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
              {selectedItems.map((item) => (
                <li key={item.id}>
                  {item.name} × {qtyDraft[item.id] ?? item.quantity}
                </li>
              ))}
            </ul>

            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={restockSource}
                onChange={(event) => setRestockSource(event.target.checked)}
              />
              <span>
                <strong>Add inventory back to {warehouseLabel(order.warehouse)}</strong>
                <span className="mt-1 block text-muted-foreground">
                  Default is No (recommended when this warehouse oversold). Dest warehouse stock is
                  still reduced; a soft warning appears if dest is short.
                </span>
              </span>
            </label>

            <label className="grid gap-1 text-sm">
              Optional customer-facing / internal note
              <textarea
                className="field min-h-20"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Optional note about why this was split…"
              />
            </label>

            {error ? <p className="text-sm text-brand-red">{error}</p> : null}

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="ghost-btn"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="gold-btn"
                disabled={busy}
                onClick={() => void submitSplit()}
              >
                {busy ? "Moving…" : "Confirm move"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
