"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { ApiOrder, ApiShippingLabel } from "@/lib/api-types";

export function ShippingLabelActions({
  orderId,
  labels,
  onDeleted,
  onError,
}: {
  orderId: string;
  labels: ApiShippingLabel[];
  onDeleted: (order: ApiOrder) => void;
  onError: (message: string) => void;
}) {
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  if (labels.length === 0) {
    return <span className="text-xs text-muted-foreground">-</span>;
  }

  async function removeLabel(label: ApiShippingLabel) {
    if (!window.confirm("Remove this shipping label from the order? This cannot be undone.")) {
      return;
    }
    const rowKey = `${orderId}:${label.id}`;
    setDeletingKey(rowKey);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/labels/${label.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; order?: ApiOrder }
        | null;
      if (!response.ok || !payload?.order) {
        onError(payload?.error || "Failed to delete shipping label.");
        return;
      }
      onDeleted(payload.order);
    } catch {
      onError("Failed to delete shipping label.");
    } finally {
      setDeletingKey(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {labels.map((label) => {
        const tracking = (label.trackingNumber || "").trim();
        const trackingHref = (label.trackingUrl || "").trim();
        const rowKey = `${orderId}:${label.id}`;
        return (
          <div key={label.id} className="flex items-center gap-2 whitespace-nowrap">
            {!tracking ? (
              <span className="text-xs text-muted-foreground">-</span>
            ) : trackingHref ? (
              <a
                href={trackingHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium underline underline-offset-2"
              >
                {tracking}
              </a>
            ) : (
              <span className="text-xs">{tracking}</span>
            )}
            {label.labelUrl ? (
              <a
                href={label.labelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="print-label-btn"
              >
                Print label
              </a>
            ) : null}
            <button
              type="button"
              title="Remove label from order"
              className="label-delete-btn"
              disabled={deletingKey === rowKey}
              onClick={() => void removeLabel(label)}
            >
              <Trash2 className="size-4" aria-hidden />
              <span className="sr-only">Delete label</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
