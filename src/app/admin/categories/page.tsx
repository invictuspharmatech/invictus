import Link from "next/link";
import { djangoAuthed } from "@/lib/django";
import { requireFullAdmin } from "@/lib/auth";
import { CatalogCsvBar } from "@/components/admin/CatalogCsvBar";
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
            These power the shop menu and the landing-page category section.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CatalogCsvBar kind="categories" openImport={importFlag === "1"} autoExport={exportFlag === "1"} />
          <Link href="/admin/categories/new" className="gold-btn">
            Add category
          </Link>
        </div>
      </div>
      <div className="tile mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            <tr>
              <th className="py-2">Name</th>
              <th>Slug</th>
              <th>Sort</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.id} className="border-t border-border/40">
                <td className="py-3">{category.name}</td>
                <td>{category.slug}</td>
                <td>{category.sortOrder}</td>
                <td>
                  <Link href={`/admin/categories/${category.id}`} className="text-sm text-signal">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
