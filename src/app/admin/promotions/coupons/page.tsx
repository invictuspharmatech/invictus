import Link from "next/link";
import { djangoAuthed } from "@/lib/django";
import { requireFullAdmin } from "@/lib/auth";
import { couponTypeLabel, asCouponType } from "@/lib/coupons";
import { CouponType } from "@/lib/enums";
import { formatMoney } from "@/lib/constants";
import type { ApiCoupon } from "@/lib/api-types";

function couponValue(coupon: ApiCoupon) {
  const type = asCouponType(coupon.discountType);
  switch (type) {
    case CouponType.FREE_SHIPPING:
      return "Free shipping";
    case CouponType.PERCENT:
      return `${coupon.amount}%`;
    case CouponType.FIXED:
      return formatMoney(coupon.amount);
    default: {
      const exhaustive: never = type;
      return exhaustive;
    }
  }
}

export default async function AdminCouponsPage() {
  const staff = await requireFullAdmin();
  if (!staff) return null;
  const coupons = await djangoAuthed<ApiCoupon[]>("/api/admin/coupons/");

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display-font text-3xl">Coupons</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Codes shoppers can enter at checkout. Percent, fixed amount, or free shipping.
          </p>
        </div>
        <Link href="/admin/promotions/coupons/new" className="gold-btn">
          Add coupon
        </Link>
      </div>
      <div className="tile mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            <tr>
              <th className="py-2">Code</th>
              <th>Name</th>
              <th>Type</th>
              <th>Value</th>
              <th>Uses</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {coupons.length === 0 ? (
              <tr>
                <td className="py-6 text-muted-foreground" colSpan={7}>
                  No coupons yet.
                </td>
              </tr>
            ) : (
              coupons.map((coupon) => (
                <tr key={coupon.id} className="border-t border-border/40">
                  <td className="py-3 font-medium">{coupon.code}</td>
                  <td>{coupon.name}</td>
                  <td>{couponTypeLabel(coupon.discountType)}</td>
                  <td>{couponValue(coupon)}</td>
                  <td>
                    {coupon.usedCount}
                    {coupon.usageLimit != null ? ` / ${coupon.usageLimit}` : ""}
                  </td>
                  <td>{coupon.isActive ? "Active" : "Off"}</td>
                  <td>
                    <Link
                      href={`/admin/promotions/coupons/${coupon.id}`}
                      className="text-sm text-signal"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
