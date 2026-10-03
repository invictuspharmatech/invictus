import Link from "next/link";
import { requireFullAdmin } from "@/lib/auth";

export default async function AdminPromotionsPage() {
  const staff = await requireFullAdmin();
  if (!staff) return null;
  return (
    <div>
      <h1 className="display-font text-3xl">Promotions</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Affiliate tracking is live. Coupons and gift cards stay on this tab so the menu matches
        Great Life.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
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
