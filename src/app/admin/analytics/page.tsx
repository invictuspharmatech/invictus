"use client";

import { useEffect, useState } from "react";
import { analyticsApi, type AnalyticsOverview } from "@/lib/analytics";
import { formatMoney } from "@/lib/constants";
import {
  AnalyticsPeriodFilterControls,
  useAnalyticsPeriodFilter,
} from "@/components/admin/analytics/AnalyticsPeriodFilter";
import {
  AnalyticsSectionHeader,
  AnalyticsStat,
  AnalyticsStatus,
  SimpleChart,
} from "@/components/admin/analytics/AnalyticsWidgets";

export default function AnalyticsOverviewPage() {
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const periodFilter = useAnalyticsPeriodFilter("month");
  const { queryParams } = periodFilter;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setError(null);
        setLoading(true);
        const overview = await analyticsApi.getOverview(queryParams);
        if (!cancelled) setData(overview);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load analytics");
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [queryParams]);

  const header = (
    <AnalyticsSectionHeader title="Overview">
      <AnalyticsPeriodFilterControls state={periodFilter} label={data?.label} />
    </AnalyticsSectionHeader>
  );

  if (loading) {
    return (
      <div>
        {header}
        <AnalyticsStatus message="Loading analytics..." />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div>
        {header}
        <AnalyticsStatus message={error || "No data available"} />
      </div>
    );
  }

  const summary = data.summary;

  return (
    <div>
      {header}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <AnalyticsStat title="Product sales (subtotal)" value={formatMoney(summary.subtotal)} tone="dash-tile-info" />
        <AnalyticsStat title="Shipping collected" value={formatMoney(summary.shipping)} tone="dash-tile-warning" />
        <AnalyticsStat title="Grand total" value={formatMoney(summary.grand_total)} tone="dash-tile-success" />
        <AnalyticsStat title="Total orders" value={String(summary.orders)} tone="dash-tile-orange" />
        <AnalyticsStat title="Products sold" value={String(summary.products_sold)} tone="dash-tile-primary" />
        <AnalyticsStat title="New customers" value={String(summary.customers)} tone="dash-tile-dark" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="tile">
          <h3 className="mb-4 text-lg">Sales trend (grand total)</h3>
          <SimpleChart data={data.revenue_chart} dataKey="revenue" money breakdown />
        </section>
        <section className="tile">
          <h3 className="mb-4 text-lg">Orders trend</h3>
          <SimpleChart data={data.orders_chart} dataKey="orders" />
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="tile">
          <h3 className="mb-4 text-lg">Top products</h3>
          {data.top_products.length ? (
            <div className="space-y-3">
              {data.top_products.map((product) => (
                <div key={product.product_id ?? product.product.name} className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-medium">{product.product.name}</div>
                    <div className="text-sm text-muted-foreground">{product.total_sold} sold</div>
                  </div>
                  <div className="font-semibold">{formatMoney(product.total_revenue)}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No products data available</p>
          )}
        </section>
        <section className="tile">
          <h3 className="mb-4 text-lg">Top categories</h3>
          {data.top_categories.length ? (
            <div className="space-y-3">
              {data.top_categories.map((category) => (
                <div key={category.id} className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-medium">{category.name}</div>
                    <div className="text-sm text-muted-foreground">{category.total_sold} sold</div>
                  </div>
                  <div className="font-semibold">{formatMoney(category.total_revenue)}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No categories data available</p>
          )}
        </section>
      </div>
    </div>
  );
}
