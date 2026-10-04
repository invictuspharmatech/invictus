import type { ReactNode } from "react";
import { formatMoney } from "@/lib/constants";

export function AnalyticsStat({
  title,
  value,
  tone = "dash-tile-info",
}: {
  title: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className={`dash-tile ${tone}`}>
      <h3>{value}</h3>
      <p>{title}</p>
    </div>
  );
}

export function AnalyticsSectionHeader({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <h2 className="m-0 text-xl font-semibold">{title}</h2>
      {children}
    </div>
  );
}

export function AnalyticsStatus({ message }: { message: string }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{message}</p>;
}

type ChartRow = {
  period?: string;
  revenue?: number;
  orders?: number;
  subtotal?: number;
  shipping?: number;
};

export function SimpleChart({
  data,
  dataKey,
  money = false,
  breakdown = false,
}: {
  data: ChartRow[];
  dataKey: "revenue" | "orders";
  money?: boolean;
  breakdown?: boolean;
}) {
  if (!data.length) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No data available</p>;
  }
  const values = data.map((row) => Number(row[dataKey]) || 0);
  const maxValue = Math.max(...values, 0);

  return (
    <div className="space-y-2">
      {data.map((item, index) => {
        const numVal = Number(item[dataKey]) || 0;
        const percentage = maxValue > 0 ? (numVal / maxValue) * 100 : 0;
        const sub = Number(item.subtotal);
        const ship = Number(item.shipping);
        const showBreakdown =
          breakdown && (Number.isFinite(sub) || Number.isFinite(ship)) && (sub > 0 || ship > 0 || numVal > 0);
        const barLabel = money ? formatMoney(numVal) : String(Math.round(numVal));
        return (
          <div key={`${item.period ?? index}-${dataKey}`} className="flex items-start gap-4">
            <div className="w-24 truncate pt-1 text-xs text-muted-foreground">{item.period ?? ""}</div>
            <div className="min-w-0 flex-1">
              <div className="h-6 w-full rounded-full bg-secondary">
                <div
                  className="flex h-6 items-center justify-end rounded-full bg-accent pr-2"
                  style={{ width: `${Math.max(percentage, numVal > 0 ? 8 : 0)}%` }}
                >
                  <span className="text-[10px] font-medium text-accent-foreground">{barLabel}</span>
                </div>
              </div>
              {showBreakdown ? (
                <div className="mt-1 text-xs text-muted-foreground">
                  Sales {formatMoney(Number.isFinite(sub) ? sub : 0)} · Shipping{" "}
                  {formatMoney(Number.isFinite(ship) ? ship : 0)} · Grand {formatMoney(numVal)}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function PercentBars({
  rows,
  toneClass = "bg-accent",
}: {
  rows: Array<{ label: string; count: number }>;
  toneClass?: string;
}) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  if (!rows.length) {
    return <p className="text-sm text-muted-foreground">No data available</p>;
  }
  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const percentage = total > 0 ? (row.count / total) * 100 : 0;
        return (
          <div key={row.label}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="capitalize">{row.label.replaceAll("_", " ").toLowerCase()}</span>
              <span className="text-muted-foreground">
                {row.count} ({percentage.toFixed(1)}%)
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-secondary">
              <div className={`${toneClass} h-2 rounded-full`} style={{ width: `${percentage}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
