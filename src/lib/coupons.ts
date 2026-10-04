import { CouponType } from "@/lib/enums";

export function asCouponType(value: string): CouponType {
  if (
    value === CouponType.PERCENT ||
    value === CouponType.FIXED ||
    value === CouponType.FREE_SHIPPING
  ) {
    return value;
  }
  return CouponType.PERCENT;
}

export function couponTypeLabel(value: string): string {
  const resolved = asCouponType(value);
  switch (resolved) {
    case CouponType.PERCENT:
      return "Percent off";
    case CouponType.FIXED:
      return "Fixed amount";
    case CouponType.FREE_SHIPPING:
      return "Free shipping";
    default: {
      const exhaustive: never = resolved;
      return exhaustive;
    }
  }
}

export function toDatetimeLocal(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
