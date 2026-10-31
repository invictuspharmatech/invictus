import Link from "next/link";
import { djangoAuthed } from "@/lib/django";
import { requireStaff } from "@/lib/auth";
import { ProductStockSummary } from "@/components/admin/ProductStockSummary";
import type { ApiProduct } from "@/lib/api-types";

export default async function ProductStockSummaryPage() {
  const staff = await requireStaff();
  if (!staff) return null;

  const products = await djangoAuthed<ApiProduct[]>("/api/admin/products/");

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="display-font text-3xl">Stock summary</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Products assigned to each warehouse, grouped by category, with price and stock at that
            warehouse.
          </p>
        </div>
        <Link href="/admin/products" className="ghost-btn">
          Back to products
        </Link>
      </div>
      <ProductStockSummary products={products} />
    </div>
  );
}
