import { djangoAuthed } from "@/lib/django";
import { requireStaff } from "@/lib/auth";
import { warehouseLabel } from "@/lib/warehouse";
import { isFullAdmin } from "@/lib/roles";
import Link from "next/link";
import type { ApiProduct } from "@/lib/api-types";

const LOW_STOCK_MAX = 10;

function stockQty(product: ApiProduct, warehouse?: string): number | null {
  if (warehouse === "1") return product.stockQuantityW1;
  if (warehouse === "2") return product.stockQuantityW2;
  if (product.stockQuantity != null) return product.stockQuantity;
  if (product.stockQuantityW1 == null && product.stockQuantityW2 == null) return null;
  return (product.stockQuantityW1 ?? 0) + (product.stockQuantityW2 ?? 0);
}

function isLowStock(qty: number | null) {
  return qty != null && qty > 0 && qty <= LOW_STOCK_MAX;
}

function isOutOfStock(product: ApiProduct, qty: number | null, warehouse?: string) {
  const status = (product.stockStatus || "").toLowerCase();
  if (status === "always_in_stock") return false;
  if (qty != null && qty <= 0) return true;
  if (warehouse === "1" || warehouse === "2") return false;
  return status === "outofstock" || status === "out_of_stock";
}

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
  const low = products.filter((product) => isLowStock(stockQty(product, warehouse)));
  const out = products.filter((product) =>
    isOutOfStock(product, stockQty(product, warehouse), warehouse),
  );

  return (
    <div>
      <h1 className="display-font text-3xl">Inventory</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Stock by warehouse. Low stock is 1–10 units. Out of stock is qty 0.
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
      <p className="mt-4 text-sm text-muted-foreground">
        {low.length} low stock · {out.length} out of stock.
      </p>
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
              const qty = stockQty(product, warehouse);
              const lowRow = isLowStock(qty);
              const outRow = isOutOfStock(product, qty, warehouse);
              return (
                <tr
                  key={product.id}
                  className={`border-t border-border/40 ${outRow ? "bg-brand-red/20" : lowRow ? "bg-brand-red/10" : ""}`}
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
                  <td>{product.stockQuantityW1 ?? "—"}</td>
                  <td>{product.stockQuantityW2 ?? "—"}</td>
                  <td>{product.stockQuantity ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
