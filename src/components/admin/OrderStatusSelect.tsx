"use client";

import { STAFF_ORDER_STATUSES, canonicalOrderStatus, formatOrderStatus } from "@/lib/enums";
import { useRouter } from "next/navigation";

const OPTIONS = [...STAFF_ORDER_STATUSES];

export function OrderStatusSelect({
  id,
  status,
  onUpdated,
}: {
  id: string;
  status: string;
  onUpdated?: () => void;
}) {
  const router = useRouter();
  const current = canonicalOrderStatus(status);

  return (
    <select
      className="field max-w-xs"
      defaultValue={current}
      key={current}
      onChange={async (event) => {
        await fetch(`/api/admin/orders/${id}/status`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: event.target.value }),
        });
        router.refresh();
        onUpdated?.();
      }}
    >
      {OPTIONS.map((option) => (
        <option key={option} value={option}>
          {formatOrderStatus(option)}
        </option>
      ))}
    </select>
  );
}
