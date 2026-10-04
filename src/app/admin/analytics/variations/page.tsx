"use client";

import { useEffect, useState } from "react";
import { analyticsApi, type VariationsAnalytics } from "@/lib/analytics";
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

export default function VariationsAnalyticsPage() {
  const [data, setData] = useState<VariationsAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const periodFilter = useAnalyticsPeriodFilter("month");
  const { queryParams } = periodFilter;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setLoading(true);
        const result = await analyticsApi.getVariations(queryParams);
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
    <AnalyticsSectionHeader title="Variations">
      <AnalyticsPeriodFilterControls state={periodFilter} label={data?.label} />
    </AnalyticsSectionHeader>
  );

  if (loading) {
    return (
      <div>
        {header}
        <AnalyticsStatus message="Loading SKU analytics..." />
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

  const totalUnits = data.top_variations.reduce((sum, row) => sum + row.total_sold, 0);
  const totalRevenue = data.top_variations.reduce((sum, row) => sum + row.total_revenue, 0);
  const maxSold = Math.max(...data.variations_performance.map((row) => row.total_sold), 0);

  return (
    <div>
      {header}
      <p className="mb-6 text-sm text-muted-foreground">
        Invictus sells at SKU level, so this tab is SKU performance — the same role as Great Life variations.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <AnalyticsStat title="SKUs with sales" value={String(data.top_variations.length)} />
        <AnalyticsStat title="Units sold" value={String(totalUnits)} tone="dash-tile-primary" />
        <AnalyticsStat title="SKU revenue" value={formatMoney(totalRevenue)} tone="dash-tile-success" />
      </div>

      <section className="tile mt-8 overflow-x-auto">
        <h3 className="mb-4 text-lg">Top SKUs</h3>
        {data.top_variations.length ? (
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              <tr>
                <th className="py-2">SKU</th>
                <th>Name</th>
                <th>Sold</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data.top_variations.map((row) => (
                <tr key={`${row.sku}-${row.name}`} className="border-t border-border/40">
                  <td className="py-3 font-medium">{row.sku}</td>
                  <td>{row.name}</td>
                  <td>{row.total_sold}</td>
                  <td className="font-semibold">{formatMoney(row.total_revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted-foreground">No SKU sales in this window</p>
        )}
      </section>

      <section className="tile mt-6">
        <h3 className="mb-4 text-lg">SKU performance</h3>
        {data.variations_performance.length ? (
          <div className="space-y-3">
            {data.variations_performance.map((row) => {
              const width = maxSold > 0 ? (row.total_sold / maxSold) * 100 : 0;
              return (
                <div key={`${row.sku}-perf`} className="flex items-center gap-4">
                  <div className="w-48 truncate text-sm">
                    {row.sku} · {row.name}
                  </div>
                  <div className="h-4 flex-1 rounded-full bg-secondary">
                    <div className="h-4 rounded-full bg-accent" style={{ width: `${width}%` }} />
                  </div>
                  <div className="w-16 text-right text-sm">{row.total_sold}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No performance data available</p>
        )}
      </section>
    </div>
  );
}
