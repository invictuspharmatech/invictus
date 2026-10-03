import { djangoAuthed } from "@/lib/django";
import { requireStaff } from "@/lib/auth";
import { warehouseLabel } from "@/lib/warehouse";
import { isFullAdmin } from "@/lib/roles";
import Link from "next/link";
import type { ApiProduct } from "@/lib/api-types";

export default async function AdminInventoryPage({
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
  const low = products.filter((product) => {
    const w1 = product.stockQuantityW1;
    const w2 = product.stockQuantityW2;
    const total = product.stockQuantity;
    if (warehouse === "1") return w1 != null && w1 <= 5;
    if (warehouse === "2") return w2 != null && w2 <= 5;
    return total != null && total <= 5;
  });

  return (
    <div>
      <h1 className="display-font text-3xl">Inventory</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Stock by warehouse. Low-stock rows are at or below 5 units.
      </p>
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
      <p className="mt-4 text-sm text-muted-foreground">{low.length} products running low.</p>
      <div className="mt-4 overflow-x-auto tile">
        <table className="w-full text-left text-sm">
          <thead className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            <tr>
              <th className="py-2">Product</th>
              <th>Home</th>
              <th>W1</th>
              <th>W2</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const w1 = product.stockQuantityW1;
              const w2 = product.stockQuantityW2;
              const total = product.stockQuantity;
              const isLow =
                warehouse === "1"
                  ? w1 != null && w1 <= 5
                  : warehouse === "2"
                    ? w2 != null && w2 <= 5
                    : total != null && total <= 5;
              return (
                <tr
                  key={product.id}
                  className={`border-t border-border/40 ${isLow ? "bg-brand-red/10" : ""}`}
                >
                  <td className="py-3">
                    {admin ? (
                      <Link href={`/admin/cms/products/${product.id}`} className="hover:text-primary">
                        {product.name}
                      </Link>
                    ) : (
                      product.name
                    )}
                    <div className="text-xs text-muted-foreground">{product.sku}</div>
                  </td>
                  <td>{warehouseLabel(product.warehouse)}</td>
                  <td>{w1 ?? "—"}</td>
                  <td>{w2 ?? "—"}</td>
                  <td>{total ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
