"use client";

import { useEffect, useState } from "react";
import { analyticsApi, type CouponsAnalytics } from "@/lib/analytics";
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

export default function CouponsAnalyticsPage() {
  const [data, setData] = useState<CouponsAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const periodFilter = useAnalyticsPeriodFilter("month");
  const { queryParams } = periodFilter;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setLoading(true);
        const result = await analyticsApi.getCoupons(queryParams);
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
    <AnalyticsSectionHeader title="Coupons">
      <AnalyticsPeriodFilterControls state={periodFilter} label={data?.label} />
    </AnalyticsSectionHeader>
  );

  if (loading) {
    return (
      <div>
        {header}
        <AnalyticsStatus message="Loading coupons analytics..." />
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

  const totalUses = data.coupon_usage.reduce((sum, row) => sum + row.usage_count, 0);

  return (
    <div>
      {header}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AnalyticsStat title="Total coupons" value={String(data.total_coupons)} />
        <AnalyticsStat title="Active coupons" value={String(data.active_coupons)} tone="dash-tile-success" />
        <AnalyticsStat title="Uses in window" value={String(totalUses)} tone="dash-tile-primary" />
        <AnalyticsStat title="Discount given" value={formatMoney(data.discount_amount)} tone="dash-tile-warning" />
      </div>

      <section className="tile mt-8 overflow-x-auto">
        <h3 className="mb-4 text-lg">Coupon usage</h3>
        {data.coupon_usage.length ? (
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              <tr>
                <th className="py-2">Code</th>
                <th>Uses</th>
                <th>Discount</th>
              </tr>
            </thead>
            <tbody>
              {data.coupon_usage.map((row) => (
                <tr key={row.code} className="border-t border-border/40">
                  <td className="py-3 font-medium">{row.code}</td>
                  <td>{row.usage_count}</td>
                  <td>{formatMoney(row.total_discount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted-foreground">No coupon usage in this window</p>
        )}
      </section>
    </div>
  );
}
