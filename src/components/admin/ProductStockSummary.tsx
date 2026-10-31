import Link from "next/link";
import { formatMoney } from "@/lib/constants";
import { WarehouseCode } from "@/lib/enums";
import { warehouseLabel } from "@/lib/warehouse";
import type { ApiProduct } from "@/lib/api-types";

type SummaryRow = {
  id: string;
  name: string;
  sku: string;
  price: number;
  salePrice: number | null;
  stock: number;
};

type CategoryGroup = {
  categoryId: string;
  categoryName: string;
  rows: SummaryRow[];
};

function productPrice(product: ApiProduct): { price: number; salePrice: number | null } {
  const regular = product.regularPrice ?? 0;
  const sale =
    product.salePrice != null && product.salePrice > 0 && product.salePrice < regular
      ? product.salePrice
      : null;
  return { price: regular, salePrice: sale };
}

function stockForWarehouse(product: ApiProduct, warehouse: WarehouseCode): number {
  if (warehouse === WarehouseCode.WAREHOUSE_1) {
    return product.stockQuantityW1 ?? 0;
  }
  return product.stockQuantityW2 ?? 0;
}

function groupsForWarehouse(products: ApiProduct[], warehouse: WarehouseCode): CategoryGroup[] {
  const assigned = products.filter((product) => product.warehouse === warehouse);
  const byCategory = new Map<string, CategoryGroup>();

  for (const product of assigned) {
    const categories =
      product.categories.length > 0
        ? product.categories.map((row) => ({
            id: row.category.id,
            name: row.category.name,
          }))
        : [{ id: "__uncategorized__", name: "Uncategorized" }];

    // One category bucket per product (first category) to avoid duplicate rows.
    const primary = [...categories].sort((a, b) => a.name.localeCompare(b.name))[0]!;
    const existing = byCategory.get(primary.id) ?? {
      categoryId: primary.id,
      categoryName: primary.name,
      rows: [],
    };
    const { price, salePrice } = productPrice(product);
    existing.rows.push({
      id: product.id,
      name: product.name,
      sku: product.sku || "—",
      price,
      salePrice,
      stock: stockForWarehouse(product, warehouse),
    });
    byCategory.set(primary.id, existing);
  }

  return [...byCategory.values()]
    .map((group) => ({
      ...group,
      rows: [...group.rows].sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.categoryName.localeCompare(b.categoryName));
}

function WarehouseSummary({
  warehouse,
  products,
}: {
  warehouse: WarehouseCode;
  products: ApiProduct[];
}) {
  const groups = groupsForWarehouse(products, warehouse);
  const totalItems = groups.reduce((sum, group) => sum + group.rows.length, 0);
  const totalUnits = groups.reduce(
    (sum, group) => sum + group.rows.reduce((inner, row) => inner + row.stock, 0),
    0,
  );

  return (
    <section className="tile">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg text-emerald-400">{warehouseLabel(warehouse)}</h2>
        <p className="text-sm text-muted-foreground">
          {totalItems} product{totalItems === 1 ? "" : "s"} · {totalUnits} units in stock
        </p>
      </div>

      {groups.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No products assigned to this warehouse.</p>
      ) : (
        <div className="mt-4 space-y-6">
          {groups.map((group) => (
            <div key={group.categoryId}>
              <h3 className="rounded bg-emerald-900/50 px-3 py-2 text-sm font-semibold tracking-wide text-emerald-300">
                {group.categoryName}
                <span className="ml-2 font-normal text-emerald-400/80">
                  · {group.rows.length}
                </span>
              </h3>
              <div className="mt-2 overflow-x-auto pl-1">
                <table className="w-full text-left text-sm">
                  <thead className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-3">Product</th>
                      <th className="py-2 pr-3">SKU</th>
                      <th className="py-2 pr-3">Price</th>
                      <th className="py-2">Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row) => (
                      <tr key={row.id} className="border-t border-border/40">
                        <td className="py-2 pr-3">
                          <Link
                            href={`/admin/cms/products/${row.id}`}
                            className="font-medium text-signal hover:text-foreground"
                          >
                            {row.name}
                          </Link>
                        </td>
                        <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">
                          {row.sku}
                        </td>
                        <td className="py-2 pr-3 whitespace-nowrap">
                          {row.salePrice != null ? (
                            <span>
                              <span className="text-signal">{formatMoney(row.salePrice)}</span>
                              <span className="ml-2 text-muted-foreground line-through">
                                {formatMoney(row.price)}
                              </span>
                            </span>
                          ) : (
                            formatMoney(row.price)
                          )}
                        </td>
                        <td className="py-2 font-mono">{row.stock}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function ProductStockSummary({ products }: { products: ApiProduct[] }) {
  return (
    <div className="mt-6 grid gap-6 xl:grid-cols-2">
      <WarehouseSummary warehouse={WarehouseCode.WAREHOUSE_1} products={products} />
      <WarehouseSummary warehouse={WarehouseCode.WAREHOUSE_2} products={products} />
    </div>
  );
}
