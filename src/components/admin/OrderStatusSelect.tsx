"use client";

import { OrderStatus } from "@/lib/enums";
import { useRouter } from "next/navigation";

const OPTIONS: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.PAID,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
];

export function OrderStatusSelect({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();

  return (
    <select
      className="field max-w-xs"
      defaultValue={status}
      onChange={async (event) => {
        await fetch(`/api/admin/orders/${id}/status`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: event.target.value }),
        });
        router.refresh();
      }}
    >
      {OPTIONS.map((option) => (
        <option key={option} value={option}>
          {option.toLowerCase()}
        </option>
      ))}
    </select>
  );
}
