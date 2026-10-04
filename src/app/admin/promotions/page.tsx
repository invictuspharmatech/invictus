import Link from "next/link";
import { requireFullAdmin } from "@/lib/auth";

export default async function AdminPromotionsPage() {
  const staff = await requireFullAdmin();
  if (!staff) return null;
  return (
    <div>
      <h1 className="display-font text-3xl">Promotions</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Create coupon codes and review affiliate tracking.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Link href="/admin/promotions/coupons" className="tile">
          <h2 className="text-lg">Coupons</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Percent off, fixed amount, or free shipping. Shoppers enter the code at checkout.
          </p>
        </Link>
        <Link href="/admin/affiliates" className="tile">
          <h2 className="text-lg">Affiliates</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Review applications and tracking codes.
          </p>
        </Link>
      </div>
    </div>
  );
}
