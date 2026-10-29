import Link from "next/link";
import { djangoAuthed } from "@/lib/django";
import { requireFullAdmin } from "@/lib/auth";
import { CatalogCsvBar } from "@/components/admin/CatalogCsvBar";
import { AdminCategoriesTable } from "@/components/admin/AdminCategoriesTable";
import type { ApiCategory } from "@/lib/api-types";

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ import?: string; export?: string }>;
}) {
  const staff = await requireFullAdmin();
  if (!staff) return null;
  const { import: importFlag, export: exportFlag } = await searchParams;
  const categories = await djangoAuthed<ApiCategory[]>("/api/admin/categories/");

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display-font text-3xl">Categories</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Star (★) a category to show it on the homepage. More than 4 starred
            categories become a moving carousel. Sort order controls display order.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CatalogCsvBar kind="categories" openImport={importFlag === "1"} autoExport={exportFlag === "1"} />
          <Link href="/admin/products/skus" className="ghost-btn">
            Generate SKUs
          </Link>
          <Link href="/admin/categories/new" className="gold-btn">
            Add category
          </Link>
        </div>
      </div>
      <AdminCategoriesTable categories={categories} />
    </div>
  );
}
