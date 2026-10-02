"use client";

import { OrderStatus } from "@/lib/enums";
import { useRouter } from "next/navigation";

const OPTIONS: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.ON_HOLD,
  OrderStatus.PAID,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
  OrderStatus.FAILED,
];

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

  return (
    <select
      className="field max-w-xs"
      defaultValue={status}
      key={status}
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
          {option.toLowerCase().replaceAll("_", " ")}
        </option>
      ))}
    </select>
  );
}
