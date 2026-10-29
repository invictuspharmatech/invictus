import { djangoAuthed } from "@/lib/django";
import { requireFullAdmin } from "@/lib/auth";
import { CouponForm } from "@/components/admin/CouponForm";
import type { ApiCoupon } from "@/lib/api-types";

export default async function NewCouponPage() {
  const staff = await requireFullAdmin();
  if (!staff) return null;
  const allCoupons = await djangoAuthed<ApiCoupon[]>("/api/admin/coupons/").catch(() => []);
  return (
    <div>
      <h1 className="display-font text-3xl">Add coupon</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Set total and per-customer usage limits, and which codes may stack together.
      </p>
      <CouponForm allCoupons={allCoupons} />
    </div>
  );
}
