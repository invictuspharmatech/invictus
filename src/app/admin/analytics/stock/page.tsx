"use client";

import { useEffect, useState } from "react";
import { analyticsApi, type StockAnalytics } from "@/lib/analytics";
import { formatMoney } from "@/lib/constants";
import {
  AnalyticsSectionHeader,
  AnalyticsStat,
  AnalyticsStatus,
} from "@/components/admin/analytics/AnalyticsWidgets";

export default function StockAnalyticsPage() {
  const [data, setData] = useState<StockAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setLoading(true);
        const result = await analyticsApi.getStock();
        if (!cancelled) setData(result);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <AnalyticsStatus message="Loading stock analytics..." />;
  }
  if (!data) {
    return <AnalyticsStatus message="No data available" />;
  }

  const maxStock = Math.max(...data.stock_by_category.map((row) => row.total_stock), 0);

  return (
    <div>
      <AnalyticsSectionHeader title="Stock" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AnalyticsStat title="Total products" value={String(data.total_products)} />
        <AnalyticsStat title="In stock" value={String(data.in_stock)} tone="dash-tile-success" />
        <AnalyticsStat title="Out of stock" value={String(data.out_of_stock)} tone="dash-tile-danger" />
        <AnalyticsStat title="Total stock value" value={formatMoney(data.total_value)} tone="dash-tile-primary" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="tile overflow-x-auto">
          <h3 className="mb-4 text-lg">Low stock products</h3>
          {data.low_stock_products.length ? (
            <table className="w-full text-left text-sm">
              <thead className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                <tr>
                  <th className="py-2">Product</th>
                  <th>SKU</th>
                  <th>Stock</th>
                  <th>Categories</th>
                </tr>
              </thead>
              <tbody>
                {data.low_stock_products.map((product) => (
                  <tr key={product.id} className="border-t border-border/40">
                    <td className="py-3 font-medium">{product.name}</td>
                    <td>{product.sku || "—"}</td>
                    <td>
                      {product.stock_quantity}{" "}
                      <span className="text-xs text-muted-foreground">
                        (W1 {product.stock_quantity_w1} / W2 {product.stock_quantity_w2})
                      </span>
                    </td>
                    <td className="text-muted-foreground">
                      {product.categories.map((cat) => cat.name).join(", ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted-foreground">No low-stock products</p>
          )}
        </section>
        <section className="tile">
          <h3 className="mb-4 text-lg">Stock by category</h3>
          {data.stock_by_category.length ? (
            <div className="space-y-3">
              {data.stock_by_category.map((category) => {
                const width = maxStock > 0 ? (category.total_stock / maxStock) * 100 : 0;
                return (
                  <div key={category.id}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span>{category.name}</span>
                      <span className="text-muted-foreground">
                        {category.total_stock} · {formatMoney(category.total_value)}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-secondary">
                      <div className="h-2 rounded-full bg-accent" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No category stock data</p>
          )}
        </section>
      </div>
    </div>
  );
}
