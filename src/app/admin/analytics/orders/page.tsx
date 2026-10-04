"use client";

import { useEffect, useState } from "react";
import { analyticsApi, type OrdersAnalytics } from "@/lib/analytics";
import { formatMoney } from "@/lib/constants";
import {
  AnalyticsPeriodFilterControls,
  useAnalyticsPeriodFilter,
} from "@/components/admin/analytics/AnalyticsPeriodFilter";
import {
  AnalyticsSectionHeader,
  AnalyticsStat,
  AnalyticsStatus,
  PercentBars,
  SimpleChart,
} from "@/components/admin/analytics/AnalyticsWidgets";

export default function OrdersAnalyticsPage() {
  const [data, setData] = useState<OrdersAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const periodFilter = useAnalyticsPeriodFilter("month");
  const { queryParams } = periodFilter;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setLoading(true);
        const orders = await analyticsApi.getOrders(queryParams);
        if (!cancelled) setData(orders);
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
    <AnalyticsSectionHeader title="Orders">
      <AnalyticsPeriodFilterControls state={periodFilter} label={data?.label} />
    </AnalyticsSectionHeader>
  );

  if (loading) {
    return (
      <div>
        {header}
        <AnalyticsStatus message="Loading orders analytics..." />
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
      <div className="grid gap-3 sm:grid-cols-2">
        <AnalyticsStat title="Total orders" value={String(data.total_orders)} />
        <AnalyticsStat
          title="Average order value"
          value={formatMoney(data.average_order_value)}
          tone="dash-tile-success"
        />
      </div>

      <section className="tile mt-8">
        <h3 className="mb-4 text-lg">Orders trend</h3>
        <SimpleChart data={data.orders_chart} dataKey="orders" />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="tile">
          <h3 className="mb-4 text-lg">Orders by status</h3>
          <PercentBars
            rows={data.orders_by_status.map((row) => ({ label: row.status, count: row.count }))}
          />
        </section>
        <section className="tile">
          <h3 className="mb-4 text-lg">Orders by payment status</h3>
          <PercentBars
            rows={data.orders_by_payment_status.map((row) => ({
              label: row.payment_status,
              count: row.count,
            }))}
            toneClass="bg-emerald-600"
          />
        </section>
      </div>
    </div>
  );
}
