import { canonicalOrderStatus, formatOrderStatus } from "@/lib/enums";

/** Compact status pill for order lists. */
export function orderStatusBadgeClass(status: string): string {
  const key = canonicalOrderStatus(status);
  switch (key) {
    case "PENDING":
      return "bg-amber-500/20 text-amber-200";
    case "ON_HOLD":
      return "bg-orange-500/20 text-orange-200";
    case "PROCESSING":
      return "bg-signal/20 text-signal";
    case "PARTIALLY_FILLED":
      return "bg-orange-400/20 text-orange-100";
    case "COMPLETED":
      return "bg-emerald-500/20 text-emerald-200";
    case "CANCELLED":
      return "bg-muted text-muted-foreground";
    case "REFUNDED":
      return "bg-violet-500/20 text-violet-200";
    case "FAILED":
      return "bg-brand-red/25 text-red-200";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function OrderStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${orderStatusBadgeClass(status)}`}
    >
      {formatOrderStatus(status)}
    </span>
  );
}
