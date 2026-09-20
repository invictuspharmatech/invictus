import { djangoAuthed } from "@/lib/django";
import { requireStaff } from "@/lib/auth";
import { WarehouseToggle } from "@/components/admin/WarehouseToggle";
import { warehouseLabel } from "@/lib/warehouse";
import { isFullAdmin } from "@/lib/roles";
import Link from "next/link";
import type { ApiProduct } from "@/lib/api-types";

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; warehouse?: string }>;
}) {
  const staff = await requireStaff();
  if (!staff) return null;
  const admin = isFullAdmin(staff.role);
  const { q, warehouse } = await searchParams;
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (warehouse) params.set("warehouse", warehouse);
  const query = params.toString();
  const products = await djangoAuthed<ApiProduct[]>(
    `/api/admin/products/${query ? `?${query}` : ""}`,
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display-font text-3xl">Products</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Each product has W1 stock, W2 stock, and a total. Backorders are set per product.
            Warehouse staff only see their own count. Admins see both.
          </p>
        </div>
        {admin ? (
          <Link href="/admin/cms/products/new" className="gold-btn">
            New product
          </Link>
        ) : null}
      </div>
      <form className="mt-6 flex flex-wrap gap-2">
        <input className="field max-w-xs" name="q" defaultValue={q} placeholder="Search SKU or name" />
        <select className="field max-w-48" name="warehouse" defaultValue={warehouse ?? ""}>
          <option value="">All warehouses</option>
          <option value="1">Warehouse 1</option>
          <option value="2">Warehouse 2</option>
        </select>
        <button className="gold-btn" type="submit">
          Filter
        </button>
      </form>
      <div className="mt-6 overflow-x-auto tile">
        <table className="w-full text-left text-sm">
          <thead className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            <tr>
              <th className="py-2">Product</th>
              <th>Category</th>
              <th>Warehouse</th>
              <th>W1</th>
              <th>W2</th>
              <th>Total</th>
              <th>Backorder</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-t border-border/40">
                <td className="py-3">
                  <Link href={`/admin/cms/products/${product.id}`} className="hover:text-primary">
                    {product.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">{product.sku}</div>
                </td>
                <td>{product.categories.map((row) => row.category.name).join(", ")}</td>
                <td>{warehouseLabel(product.warehouse)}</td>
                <td>{product.stockQuantityW1 ?? "—"}</td>
                <td>{product.stockQuantityW2 ?? "—"}</td>
                <td>{product.stockQuantity ?? "—"}</td>
                <td>{product.allowBackorder ? "Yes" : "No"}</td>
                <td>
                  {admin ? (
                    <WarehouseToggle id={product.id} warehouse={product.warehouse} />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
