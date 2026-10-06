"use client";

import { useEffect, useState } from "react";
import { analyticsApi, type CategoriesAnalytics, type OrdersAnalytics } from "@/lib/analytics";

const ORDER_COLORS = ["#3b82f6", "#22c55e", "#f97316", "#eab308", "#ef4444", "#6b7280"];
const CATEGORY_COLORS = ["#8b5cf6", "#0ea5e9", "#22c55e", "#f97316", "#ef4444", "#6b7280"];

function PieChart({
  title,
  segments,
}: {
  title: string;
  segments: { label: string; value: number; color: string }[];
}) {
  const total = segments.reduce((sum, item) => sum + (item.value || 0), 0);
  let currentAngle = 0;
  const gradient =
    total > 0
      ? segments
          .map((item) => {
            const angle = (item.value / total) * 360;
            const start = currentAngle;
            const end = currentAngle + angle;
            currentAngle = end;
            return `${item.color} ${start}deg ${end}deg`;
          })
          .join(", ")
      : "";

  return (
    <section className="tile">
      <h3 className="mb-4 text-lg">{title}</h3>
      <div className="flex flex-col items-center gap-6 md:flex-row">
        <div
          className="size-36 shrink-0 rounded-full"
          style={{ background: total > 0 ? `conic-gradient(${gradient})` : "var(--secondary)" }}
        />
        <ul className="w-full space-y-1">
          {segments.length === 0 || total === 0 ? (
            <li className="text-sm text-muted-foreground">No data for this period.</li>
          ) : (
            segments.map((item) => {
              const pct = ((item.value / total) * 100).toFixed(1);
              return (
                <li key={item.label} className="flex items-center gap-2 text-sm">
                  <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: item.color }} />
                  <span>{item.label}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{pct}%</span>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </section>
  );
}

export function DashboardPieCharts() {
  const [orders, setOrders] = useState<OrdersAnalytics | null>(null);
  const [categories, setCategories] = useState<CategoriesAnalytics | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [ordersData, categoriesData] = await Promise.all([
          analyticsApi.getOrders({ period: "month" }),
          analyticsApi.getCategories({ period: "month" }),
        ]);
        if (!cancelled) {
          setOrders(ordersData);
          setCategories(categoriesData);
        }
      } catch {
        if (!cancelled) {
          setOrders(null);
          setCategories(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <PieChart
        title="Orders by status (this month)"
        segments={(orders?.orders_by_status || []).map((row, index) => ({
          label: row.status,
          value: row.count,
          color: ORDER_COLORS[index % ORDER_COLORS.length],
        }))}
      />
      <PieChart
        title="Revenue by category (this month)"
        segments={(categories?.revenue_by_category || []).map((row, index) => ({
          label: row.name,
          value: row.revenue,
          color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
        }))}
      />
    </div>
  );
}
