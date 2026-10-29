import { notFound } from "next/navigation";
import { djangoAuthed } from "@/lib/django";
import { requireFullAdmin } from "@/lib/auth";
import { CouponForm } from "@/components/admin/CouponForm";
import type { ApiCoupon } from "@/lib/api-types";

export default async function EditCouponPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const staff = await requireFullAdmin();
  if (!staff) return null;
  const { id } = await params;
  const [coupon, allCoupons] = await Promise.all([
    djangoAuthed<ApiCoupon>(`/api/admin/coupons/${id}/`).catch(() => null),
    djangoAuthed<ApiCoupon[]>("/api/admin/coupons/").catch(() => []),
  ]);
  if (!coupon) notFound();
  return (
    <div>
      <h1 className="display-font text-3xl">Edit coupon</h1>
      <CouponForm coupon={coupon} allCoupons={allCoupons} />
    </div>
  );
}
