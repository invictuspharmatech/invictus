"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ApiOrder, ApiWarehouseSettings } from "@/lib/api-types";
import { isFullAdmin } from "@/lib/roles";
import { oppositeWarehouse, warehouseLabel } from "@/lib/warehouse";

export function OrderFulfillmentControls({
  order,
  policy,
  role,
}: {
  order: ApiOrder;
  policy: ApiWarehouseSettings;
  role: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const admin = isFullAdmin(role);
  const dest = oppositeWarehouse(order.warehouse);
  const canMove = policy.splitEnabled && policy.manualMoveEnabled && admin;
  const canRequest = policy.splitEnabled && policy.warehouseRequestEnabled;

  if (!canMove && !canRequest) return null;

  async function submit(itemId: string, quantity: number, immediate: boolean) {
    setError("");
    const res = await fetch(
      immediate
        ? `/api/admin/orders/${order.id}/move-item`
        : "/api/admin/fulfillment-requests",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          immediate
            ? { itemId, quantity, destWarehouse: dest }
            : { orderId: order.id, itemId, quantity },
        ),
      },
    );
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      setError(payload?.error || "Could not update warehouse.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-4 space-y-3 border-t border-border/40 pt-4">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        Move to {warehouseLabel(dest)}
      </p>
      {order.items.map((item) => (
        <div key={item.id} className="flex flex-wrap items-end gap-2 text-sm">
          <span className="min-w-40">
            {item.name} × {item.quantity}
          </span>
          <input
            className="field max-w-20"
            id={`qty-${item.id}`}
            type="number"
            min={1}
            max={item.quantity}
            defaultValue={item.quantity}
          />
          {canMove ? (
            <button
              className="gold-btn"
              type="button"
              onClick={() => {
                const input = document.getElementById(`qty-${item.id}`) as HTMLInputElement | null;
                void submit(item.id, Number(input?.value || 0), true);
              }}
            >
              Move now
            </button>
          ) : null}
          {canRequest ? (
            <button
              className="ghost-btn"
              type="button"
              onClick={() => {
                const input = document.getElementById(`qty-${item.id}`) as HTMLInputElement | null;
                void submit(item.id, Number(input?.value || 0), false);
              }}
            >
              Request other warehouse
            </button>
          ) : null}
        </div>
      ))}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </div>
  );
}
