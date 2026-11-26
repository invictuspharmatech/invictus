import Link from "next/link";
import { requireFullAdmin } from "@/lib/auth";

export default async function AdminPromotionsPage() {
  const staff = await requireFullAdmin();
  if (!staff) return null;
  return (
    <div>
      <h1 className="display-font text-3xl">Promotions</h1>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Link href="/admin/promotions/coupons" className="tile">
          <h2 className="text-lg">Coupons</h2>
        </Link>
        <Link href="/admin/affiliates" className="tile">
          <h2 className="text-lg">Affiliates</h2>
        </Link>
      </div>
    </div>
  );
}
