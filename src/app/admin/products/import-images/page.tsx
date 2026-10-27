import Link from "next/link";
import { requireFullAdmin } from "@/lib/auth";
import { djangoJson } from "@/lib/django";
import { ProductImageImportBoard } from "@/components/admin/ProductImageImportBoard";
import type { ApiCategory } from "@/lib/api-types";

export default async function AdminProductImageImportPage() {
  const staff = await requireFullAdmin();
  if (!staff) return null;
  const categories = await djangoJson<ApiCategory[]>("/api/categories/");

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="display-font text-3xl">Import from images</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Runs on this site&apos;s database — use it on live to create or update live products.
          </p>
        </div>
        <Link href="/admin/products" className="ghost-btn">
          Back to products
        </Link>
      </div>
      <ProductImageImportBoard categories={categories} />
    </div>
  );
}
