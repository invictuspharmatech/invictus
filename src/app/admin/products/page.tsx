import { djangoAuthed, djangoJson } from "@/lib/django";
import { requireStaff } from "@/lib/auth";
import { AdminProductsTable } from "@/components/admin/AdminProductsTable";
import { CatalogCsvBar } from "@/components/admin/CatalogCsvBar";
import { isFullAdmin } from "@/lib/roles";
import Link from "next/link";
import type { ApiCategory, ApiProduct } from "@/lib/api-types";

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ import?: string; export?: string }>;
}) {
  const staff = await requireStaff();
  if (!staff) return null;
  const admin = isFullAdmin(staff.role);
  const { import: importFlag, export: exportFlag } = await searchParams;
  const [products, categories] = await Promise.all([
    djangoAuthed<ApiProduct[]>("/api/admin/products/"),
    djangoJson<ApiCategory[]>("/api/categories/"),
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="display-font text-3xl">Products</h1>
        <div className="flex flex-wrap gap-2">
          {admin ? <CatalogCsvBar kind="products" openImport={importFlag === "1"} autoExport={exportFlag === "1"} /> : null}
          {admin ? (
            <Link href="/admin/cms/products/new" className="gold-btn">
              Add New Product
            </Link>
          ) : null}
        </div>
      </div>
      <AdminProductsTable products={products} categories={categories} admin={admin} />
    </div>
  );
}
