"use client";

import { useEffect, useMemo, useState } from "react";
import { analyticsApi, type ProductsAnalytics } from "@/lib/analytics";
import { formatMoney } from "@/lib/constants";
import type { ApiCategory } from "@/lib/api-types";
import {
  AnalyticsPeriodFilterControls,
  useAnalyticsPeriodFilter,
} from "@/components/admin/analytics/AnalyticsPeriodFilter";
import {
  AnalyticsSectionHeader,
  AnalyticsStat,
  AnalyticsStatus,
} from "@/components/admin/analytics/AnalyticsWidgets";

export default function ProductsAnalyticsPage() {
  const [data, setData] = useState<ProductsAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [categoryId, setCategoryId] = useState("all");
  const periodFilter = useAnalyticsPeriodFilter("month");
  const { queryParams } = periodFilter;

  const fetchParams = useMemo(
    () => (categoryId === "all" ? queryParams : { ...queryParams, category_id: categoryId }),
    [queryParams, categoryId],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/categories");
        const list = (await res.json()) as ApiCategory[];
        if (!cancelled) setCategories(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setCategories([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setLoading(true);
        const products = await analyticsApi.getProducts(fetchParams);
        if (!cancelled) setData(products);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchParams]);

  const categoryLabel =
    categoryId !== "all"
      ? categories.find((item) => item.id === categoryId)?.name ?? data?.category_name ?? null
      : null;
  const showingLabel =
    data?.label && categoryLabel
      ? `${data.label} · ${categoryLabel}`
      : data?.label ?? categoryLabel;

  const header = (
    <AnalyticsSectionHeader title="Products">
      <div className="flex flex-col items-stretch gap-2 sm:items-end">
        <div className="flex flex-wrap items-end justify-end gap-2">
          <label className="text-sm text-muted-foreground">
            <span className="sr-only">Category</span>
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="field w-auto min-w-40 py-2"
            >
              <option value="all">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <AnalyticsPeriodFilterControls state={periodFilter} />
        </div>
        {showingLabel ? (
          <p className="text-right text-xs text-muted-foreground">
            Showing: <span className="font-medium text-foreground">{showingLabel}</span>
          </p>
        ) : null}
      </div>
    </AnalyticsSectionHeader>
  );

  if (loading) {
    return (
      <div>
        {header}
        <AnalyticsStatus message="Loading products analytics..." />
      </div>
    );
  }
  if (!data) {
    return (
      <div>
        {header}
        <AnalyticsStatus message="No data available" />
      </div>
    );
  }

  const maxRevenue = Math.max(...data.revenue_by_product.map((row) => row.revenue), 0);

  return (
    <div>
      {header}
      <div className="grid gap-3 sm:grid-cols-3">
        <AnalyticsStat title="Total products" value={String(data.total_products)} />
        <AnalyticsStat title="Active products" value={String(data.active_products)} tone="dash-tile-success" />
        <AnalyticsStat title="Low stock products" value={String(data.low_stock_products)} tone="dash-tile-warning" />
      </div>

      <section className="tile mt-8 overflow-x-auto">
        <h3 className="mb-4 text-lg">Top selling products</h3>
        {data.top_selling_products.length ? (
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              <tr>
                <th className="py-2">Product</th>
                <th>Quantity sold</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data.top_selling_products.map((product) => (
                <tr key={product.product_id ?? product.product.name} className="border-t border-border/40">
                  <td className="py-3">
                    <div className="font-medium">{product.product.name}</div>
                    <div className="text-xs text-muted-foreground">{product.product.sku || "N/A"}</div>
                  </td>
                  <td>{product.total_sold}</td>
                  <td className="font-semibold">{formatMoney(product.total_revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted-foreground">No products data available</p>
        )}
      </section>

      <section className="tile mt-6">
        <h3 className="mb-4 text-lg">Revenue by product</h3>
        {data.revenue_by_product.length ? (
          <div className="space-y-3">
            {data.revenue_by_product.map((product) => {
              const width = maxRevenue > 0 ? (product.revenue / maxRevenue) * 100 : 0;
              return (
                <div key={product.product_id ?? product.product.name} className="flex items-center gap-4">
                  <div className="w-48 truncate text-sm">{product.product.name}</div>
                  <div className="h-4 flex-1 rounded-full bg-secondary">
                    <div className="h-4 rounded-full bg-accent" style={{ width: `${width}%` }} />
                  </div>
                  <div className="w-24 text-right text-sm font-semibold">{formatMoney(product.revenue)}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No revenue data available</p>
        )}
      </section>

      <section className="tile mt-6">
        <h3 className="mb-4 text-lg">Products by category</h3>
        {data.products_by_category.length ? (
          <div className="space-y-2">
            {data.products_by_category.map((category) => (
              <div key={category.id} className="flex items-center justify-between text-sm">
                <span>{category.name}</span>
                <span className="text-muted-foreground">{category.products_count}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No category data available</p>
        )}
      </section>
    </div>
  );
}
