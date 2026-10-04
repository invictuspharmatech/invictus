import { requireFullAdmin } from "@/lib/auth";
import { CouponForm } from "@/components/admin/CouponForm";

export default async function NewCouponPage() {
  const staff = await requireFullAdmin();
  if (!staff) return null;
  return (
    <div>
      <h1 className="display-font text-3xl">Add coupon</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Shoppers enter this code at checkout. Leave dates blank for no window.
      </p>
      <CouponForm />
    </div>
  );
}
