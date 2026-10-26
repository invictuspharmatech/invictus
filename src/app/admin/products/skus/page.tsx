import Link from "next/link";
import { djangoAuthed } from "@/lib/django";
import { requireFullAdmin } from "@/lib/auth";
import { SkuGenerateBoard } from "@/components/admin/SkuGenerateBoard";
import type { ApiCategory } from "@/lib/api-types";

export default async function AdminProductSkusPage() {
  const staff = await requireFullAdmin();
  if (!staff) return null;
  const categories = await djangoAuthed<ApiCategory[]>("/api/admin/categories/");

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display-font text-3xl">Generate SKUs</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Assign <span className="font-mono">IP-{"{ABBR}"}-001</span> style SKUs for an entire
            category. Numbers continue from the highest existing SKU for that abbreviation.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/categories" className="ghost-btn">
            Edit category abbreviations
          </Link>
          <Link href="/admin/products" className="ghost-btn">
            Back to products
          </Link>
        </div>
      </div>
      <SkuGenerateBoard categories={categories} />
    </div>
  );
}
