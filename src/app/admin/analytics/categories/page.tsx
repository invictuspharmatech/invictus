"use client";

import { useEffect, useState } from "react";
import { analyticsApi, type CategoriesAnalytics } from "@/lib/analytics";
import { formatMoney } from "@/lib/constants";
import {
  AnalyticsPeriodFilterControls,
  useAnalyticsPeriodFilter,
} from "@/components/admin/analytics/AnalyticsPeriodFilter";
import {
  AnalyticsSectionHeader,
  AnalyticsStat,
  AnalyticsStatus,
} from "@/components/admin/analytics/AnalyticsWidgets";

export default function CategoriesAnalyticsPage() {
  const [data, setData] = useState<CategoriesAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const periodFilter = useAnalyticsPeriodFilter("month");
  const { queryParams } = periodFilter;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setLoading(true);
        const result = await analyticsApi.getCategories(queryParams);
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
  }, [queryParams]);

  const header = (
    <AnalyticsSectionHeader title="Categories">
      <AnalyticsPeriodFilterControls state={periodFilter} label={data?.label} />
    </AnalyticsSectionHeader>
  );

  if (loading) {
    return (
      <div>
        {header}
        <AnalyticsStatus message="Loading categories analytics..." />
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

  const totalProducts = data.products_by_category.reduce((sum, row) => sum + row.products_count, 0);
  const avg = data.total_categories > 0 ? totalProducts / data.total_categories : 0;
  const topSold = data.top_categories[0];
  const topRevenue = data.revenue_by_category[0];
  const maxRevenue = Math.max(...data.revenue_by_category.map((row) => row.revenue), 0);

  return (
    <div>
      {header}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AnalyticsStat title="Total categories" value={String(data.total_categories)} />
        <AnalyticsStat title="Avg products / category" value={avg.toFixed(1)} tone="dash-tile-primary" />
        <AnalyticsStat title="Top category units" value={String(topSold?.total_sold ?? 0)} tone="dash-tile-orange" />
        <AnalyticsStat
          title="Top category revenue"
          value={formatMoney(topRevenue?.revenue ?? 0)}
          tone="dash-tile-success"
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
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
            <p className="text-sm text-muted-foreground">No sales by category in this window</p>
          )}
        </section>
        <section className="tile">
          <h3 className="mb-4 text-lg">Revenue by category</h3>
          {data.revenue_by_category.length ? (
            <div className="space-y-3">
              {data.revenue_by_category.map((category) => {
                const width = maxRevenue > 0 ? (category.revenue / maxRevenue) * 100 : 0;
                return (
                  <div key={category.id} className="flex items-center gap-3">
                    <div className="w-36 truncate text-sm">{category.name}</div>
                    <div className="h-4 flex-1 rounded-full bg-secondary">
                      <div className="h-4 rounded-full bg-accent" style={{ width: `${width}%` }} />
                    </div>
                    <div className="w-24 text-right text-sm">{formatMoney(category.revenue)}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No revenue data available</p>
          )}
        </section>
      </div>

      <section className="tile mt-6">
        <h3 className="mb-4 text-lg">Products by category</h3>
        {data.products_by_category.length ? (
          <div className="space-y-2">
            {data.products_by_category.map((category) => (
              <div key={category.id} className="flex items-center justify-between text-sm">
                <span>{category.name}</span>
                <span className="text-muted-foreground">{category.products_count} products</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No categories yet</p>
        )}
      </section>
    </div>
  );
}
