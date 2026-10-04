"use client";

import { useEffect, useState } from "react";
import { analyticsApi, type RevenueAnalytics, type SalesTotals } from "@/lib/analytics";
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

function PeriodBreakdownRow({
  label,
  current,
  previous,
}: {
  label: string;
  current?: SalesTotals;
  previous?: SalesTotals;
}) {
  const curr = current?.grand_total ?? 0;
  const prev = previous?.grand_total ?? 0;
  const delta = prev > 0 ? ((curr - prev) / prev) * 100 : curr > 0 ? 100 : 0;
  return (
    <div className="border-b border-border/40 py-3 last:border-0">
      <div className="flex items-center justify-between">
        <span className="font-medium">{label}</span>
        <span className="font-semibold">{formatMoney(curr)}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Sales {formatMoney(current?.subtotal ?? 0)} · Shipping {formatMoney(current?.shipping ?? 0)}
        {previous ? ` · vs prior ${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%` : ""}
      </p>
    </div>
  );
}

export default function RevenueAnalyticsPage() {
  const [data, setData] = useState<RevenueAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const periodFilter = useAnalyticsPeriodFilter("month");
  const { queryParams } = periodFilter;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setLoading(true);
        const revenue = await analyticsApi.getRevenue(queryParams);
        if (!cancelled) setData(revenue);
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
    <AnalyticsSectionHeader title="Revenue">
      <AnalyticsPeriodFilterControls state={periodFilter} label={data?.label} />
    </AnalyticsSectionHeader>
  );

  if (loading) {
    return (
      <div>
        {header}
        <AnalyticsStatus message="Loading revenue analytics..." />
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

  return (
    <div>
      {header}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AnalyticsStat title="Product sales (subtotal)" value={formatMoney(data.totals.subtotal)} />
        <AnalyticsStat title="Shipping collected" value={formatMoney(data.totals.shipping)} tone="dash-tile-warning" />
        <AnalyticsStat title="Grand total" value={formatMoney(data.totals.grand_total)} tone="dash-tile-success" />
        <AnalyticsStat
          title="Average order value"
          value={formatMoney(data.average_order_value)}
          tone="dash-tile-primary"
        />
      </div>

      <section className="tile mt-8">
        <h3 className="mb-2 text-lg">Sales trend by period</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Bar shows grand total; each row lists product sales vs shipping for that bucket.
        </p>
        <SimpleChart data={data.revenue_chart} dataKey="revenue" money breakdown />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="tile">
          <h3 className="mb-4 text-lg">Period comparison</h3>
          <PeriodBreakdownRow
            label="Today"
            current={data.revenue_by_period_breakdown.today}
            previous={data.revenue_by_period_breakdown.yesterday}
          />
          <PeriodBreakdownRow
            label="This week"
            current={data.revenue_by_period_breakdown.this_week}
            previous={data.revenue_by_period_breakdown.last_week}
          />
          <PeriodBreakdownRow
            label="This month"
            current={data.revenue_by_period_breakdown.this_month}
            previous={data.revenue_by_period_breakdown.last_month}
          />
        </section>
        <section className="tile">
          <h3 className="mb-4 text-lg">Revenue by status</h3>
          {data.revenue_by_status.length ? (
            <div className="space-y-3">
              {data.revenue_by_status.map((item) => (
                <div key={item.status} className="flex items-center justify-between">
                  <span className="capitalize">{item.status.replaceAll("_", " ").toLowerCase()}</span>
                  <span className="font-semibold">{formatMoney(item.revenue)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No status data available</p>
          )}
        </section>
      </div>
    </div>
  );
}
