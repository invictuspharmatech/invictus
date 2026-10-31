"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/constants";
import { WarehouseCode } from "@/lib/enums";
import { warehouseLabel } from "@/lib/warehouse";
import type { ApiCategory, ApiProduct } from "@/lib/api-types";

type WarehouseView = "BOTH" | WarehouseCode;
type StockFilter = "" | "in_stock" | "out_of_stock" | "on_backorder";
type StatusFilter = "all" | "active" | "inactive";

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

function stockKeyForWarehouse(product: ApiProduct, warehouse: WarehouseCode): StockFilter {
  const stock = stockForWarehouse(product, warehouse);
  if (stock > 0) return "in_stock";
  if (product.allowBackorder) return "on_backorder";
  return "out_of_stock";
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
        <p className="mt-4 text-sm text-muted-foreground">No products match these filters.</p>
      ) : (
        <div className="mt-4 space-y-6">
          {groups.map((group) => (
            <div key={group.categoryId}>
              <h3 className="rounded bg-emerald-900/50 px-3 py-2 text-sm font-semibold tracking-wide text-emerald-300">
                {group.categoryName}
                <span className="ml-2 font-normal text-emerald-400/80">· {group.rows.length}</span>
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

export function ProductStockSummary({
  products,
  categories,
}: {
  products: ApiProduct[];
  categories: ApiCategory[];
}) {
  const [warehouseView, setWarehouseView] = useState<WarehouseView>("BOTH");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [stockStatus, setStockStatus] = useState<StockFilter>("");

  const statusCounts = useMemo(() => {
    const all = products.length;
    const active = products.filter((row) => row.status === "publish").length;
    return { all, active, inactive: all - active };
  }, [products]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      if (query && !`${product.name} ${product.sku}`.toLowerCase().includes(query)) return false;
      if (categoryId && !product.categories.some((row) => row.category.id === categoryId)) {
        return false;
      }
      if (status === "active" && product.status !== "publish") return false;
      if (status === "inactive" && product.status === "publish") return false;

      if (warehouseView === "BOTH") {
        if (stockStatus) {
          const w1 = stockKeyForWarehouse(product, WarehouseCode.WAREHOUSE_1);
          const w2 = stockKeyForWarehouse(product, WarehouseCode.WAREHOUSE_2);
          // Match if the assigned warehouse stock status matches.
          const assignedKey =
            product.warehouse === WarehouseCode.WAREHOUSE_1
              ? w1
              : product.warehouse === WarehouseCode.WAREHOUSE_2
                ? w2
                : w1;
          if (assignedKey !== stockStatus) return false;
        }
        return true;
      }

      if (product.warehouse !== warehouseView) return false;
      if (stockStatus && stockKeyForWarehouse(product, warehouseView) !== stockStatus) {
        return false;
      }
      return true;
    });
  }, [products, search, categoryId, status, stockStatus, warehouseView]);

  const filtersOn =
    Boolean(search || categoryId || stockStatus) ||
    status !== "all" ||
    warehouseView !== "BOTH";

  function clearFilters() {
    setWarehouseView("BOTH");
    setSearch("");
    setCategoryId("");
    setStatus("all");
    setStockStatus("");
  }

  const showW1 = warehouseView === "BOTH" || warehouseView === WarehouseCode.WAREHOUSE_1;
  const showW2 = warehouseView === "BOTH" || warehouseView === WarehouseCode.WAREHOUSE_2;

  return (
    <div className="mt-6 space-y-4">
      <div className="tile p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {(
            [
              { value: "BOTH" as const, label: "Both warehouses" },
              { value: WarehouseCode.WAREHOUSE_1, label: "Warehouse 1" },
              { value: WarehouseCode.WAREHOUSE_2, label: "Warehouse 2" },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              className={warehouseView === option.value ? "gold-btn" : "ghost-btn"}
              onClick={() => setWarehouseView(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <select
            className="field"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select
            className="field"
            value={status}
            onChange={(event) => setStatus(event.target.value as StatusFilter)}
          >
            <option value="all">All status ({statusCounts.all})</option>
            <option value="active">Active ({statusCounts.active})</option>
            <option value="inactive">Inactive ({statusCounts.inactive})</option>
          </select>
          <select
            className="field"
            value={stockStatus}
            onChange={(event) => setStockStatus(event.target.value as StockFilter)}
          >
            <option value="">Filter by stock status</option>
            <option value="in_stock">In stock</option>
            <option value="out_of_stock">Out of stock</option>
            <option value="on_backorder">On backorder</option>
          </select>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="field min-w-0 flex-1"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search products..."
            />
            {filtersOn ? (
              <button type="button" className="ghost-btn shrink-0" onClick={clearFilters}>
                Clear
              </button>
            ) : null}
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Showing {filtered.length} product{filtered.length === 1 ? "" : "s"}
          {warehouseView === "BOTH"
            ? " across both warehouses"
            : ` assigned to ${warehouseLabel(warehouseView)}`}
          .
        </p>
      </div>

      <div
        className={`grid gap-6 ${showW1 && showW2 ? "xl:grid-cols-2" : "grid-cols-1"}`}
      >
        {showW1 ? (
          <WarehouseSummary warehouse={WarehouseCode.WAREHOUSE_1} products={filtered} />
        ) : null}
        {showW2 ? (
          <WarehouseSummary warehouse={WarehouseCode.WAREHOUSE_2} products={filtered} />
        ) : null}
      </div>
    </div>
  );
}
