"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  analyticsApi,
  type DailySalesPoint,
  type SalesChartsYearCompareResponse,
  type SalesMetric,
} from "@/lib/analytics";
import { formatMoney } from "@/lib/constants";
import { addDays, todayYmd } from "@/components/admin/analytics/AnalyticsPeriodFilter";

const DAY_BAR_PX = 52;
const VISIBLE_DAYS_HINT = 7;
const CHART_PLOT_H = 160;
const Y_TICK_COUNT = 5;
const CHARTS_MIN_YEAR = 2025;

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const QUARTERS = [
  { q: 1, label: "1st Qtr (Jan–Mar)" },
  { q: 2, label: "2nd Qtr (Apr–Jun)" },
  { q: 3, label: "3rd Qtr (Jul–Sep)" },
  { q: 4, label: "4th Qtr (Oct–Dec)" },
] as const;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function ymd(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseYmd(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatBarLabel(value: string) {
  const date = parseYmd(value);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function periodRange(
  mode: "month" | "quarter",
  monthIdx: number,
  quarter: number,
  year: number,
): { from: string; to: string } {
  const startMonth = mode === "month" ? monthIdx : (quarter - 1) * 3;
  const monthSpan = mode === "month" ? 1 : 3;
  const from = new Date(year, startMonth, 1);
  const to = new Date(year, startMonth + monthSpan, 0);
  return { from: ymd(from), to: ymd(to) };
}

function moneyAxis(value: number) {
  if (value >= 1000) return `$${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
  if (value >= 100) return `$${Math.round(value)}`;
  return `$${value.toFixed(value % 1 === 0 ? 0 : 2)}`;
}

function niceAxisMax(rawMax: number): number {
  const max = Math.max(1, rawMax);
  const exp = Math.floor(Math.log10(max));
  const base = 10 ** exp;
  const norm = max / base;
  let niceNorm: number;
  if (norm <= 1) niceNorm = 1;
  else if (norm <= 2) niceNorm = 2;
  else if (norm <= 2.5) niceNorm = 2.5;
  else if (norm <= 5) niceNorm = 5;
  else niceNorm = 10;
  return niceNorm * base;
}

function yAxisTicks(axisMax: number, count = Y_TICK_COUNT): number[] {
  const n = Math.max(2, count);
  return Array.from({ length: n }, (_, i) => (axisMax * i) / (n - 1));
}

function metricValue(point: DailySalesPoint, metric: SalesMetric): number {
  switch (metric) {
    case "subtotal":
      return point.subtotal;
    case "shipping":
      return point.shipping;
    case "grand_total":
      return point.grand_total;
    default: {
      const exhaustive: never = metric;
      return exhaustive;
    }
  }
}

function ChartYAxis({ axisMax, plotHeight = CHART_PLOT_H }: { axisMax: number; plotHeight?: number }) {
  const ticks = useMemo(() => yAxisTicks(axisMax), [axisMax]);
  return (
    <div className="relative w-14 flex-shrink-0 select-none" style={{ height: plotHeight }} aria-hidden>
      {ticks.map((tick) => {
        const bottomPct = axisMax > 0 ? (tick / axisMax) * 100 : 0;
        return (
          <div
            key={`y-${tick}`}
            className="absolute right-0 flex w-full items-center justify-end pr-1.5"
            style={{ bottom: `${bottomPct}%`, transform: "translateY(50%)" }}
          >
            <span className="text-[10px] leading-none text-muted-foreground tabular-nums">{moneyAxis(tick)}</span>
          </div>
        );
      })}
    </div>
  );
}

function ChartGridLines({ axisMax, plotHeight = CHART_PLOT_H }: { axisMax: number; plotHeight?: number }) {
  const ticks = useMemo(() => yAxisTicks(axisMax), [axisMax]);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: plotHeight }} aria-hidden>
      {ticks.map((tick) => {
        const bottomPct = axisMax > 0 ? (tick / axisMax) * 100 : 0;
        return (
          <div
            key={`g-${tick}`}
            className={`absolute inset-x-0 border-t ${tick === 0 ? "border-border" : "border-border/40 border-dashed"}`}
            style={{ bottom: `${bottomPct}%` }}
          />
        );
      })}
    </div>
  );
}

function DailySalesScrollChart({ days, metric }: { days: DailySalesPoint[]; metric: SalesMetric }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ active: boolean; startX: number; startScroll: number } | null>(null);
  const axisMax = useMemo(() => {
    let max = 1;
    for (const day of days) {
      max = Math.max(max, day.subtotal, day.shipping, day.grand_total);
    }
    return niceAxisMax(max);
  }, [days]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el) return;
    el.setPointerCapture(event.pointerId);
    drag.current = { active: true, startX: event.clientX, startScroll: el.scrollLeft };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    const el = scrollRef.current;
    if (!state?.active || !el) return;
    el.scrollLeft = state.startScroll - (event.clientX - state.startX);
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (el?.hasPointerCapture?.(event.pointerId)) el.releasePointerCapture(event.pointerId);
    if (drag.current) drag.current.active = false;
  };

  const innerWidth = Math.max(days.length * DAY_BAR_PX, 320);
  const labelH = 28;

  return (
    <div>
      <p className="mb-2 text-sm text-muted-foreground">
        About {VISIBLE_DAYS_HINT} days fit across the card at once. Scroll the chart or drag horizontally to browse the
        range.
      </p>
      <div className="flex items-stretch gap-1 border border-border/60 bg-ink/40">
        <div className="flex flex-col pt-4 pl-1" style={{ paddingBottom: labelH + 16 }}>
          <ChartYAxis axisMax={axisMax} />
        </div>
        <div
          ref={scrollRef}
          className="relative min-w-0 flex-1 cursor-grab touch-pan-x overflow-x-auto overscroll-x-contain select-none active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="relative px-2 py-4" style={{ minWidth: innerWidth }}>
            <ChartGridLines axisMax={axisMax} />
            <div className="relative z-[1] flex items-end gap-1" style={{ height: CHART_PLOT_H + labelH }}>
              {days.map((day) => {
                const value = metricValue(day, metric);
                const height = Math.max((value / axisMax) * 100, value > 0 ? 4 : 0);
                return (
                  <div
                    key={day.date}
                    className="flex flex-shrink-0 flex-col items-center justify-end"
                    style={{ width: DAY_BAR_PX, height: CHART_PLOT_H + labelH }}
                    title={`${day.date}\nSales ${formatMoney(day.subtotal)}\nShipping ${formatMoney(day.shipping)}\nGrand ${formatMoney(day.grand_total)}\nOrders ${day.orders_count}`}
                  >
                    <div className="flex w-full items-end justify-center" style={{ height: CHART_PLOT_H }}>
                      <div
                        className="min-h-[2px] w-[70%] rounded-t bg-accent"
                        style={{ height: `${height}%` }}
                      />
                    </div>
                    <div className="w-full truncate px-0.5 text-center text-[10px] text-muted-foreground" style={{ height: labelH, paddingTop: 4 }}>
                      {formatBarLabel(day.date)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function YearMonthlyChart({ data, metric }: { data: SalesChartsYearCompareResponse; metric: SalesMetric }) {
  const monthValue = (row: (typeof data.months)[0]) => {
    switch (metric) {
      case "subtotal":
        return row.primary.subtotal;
      case "shipping":
        return row.primary.shipping;
      case "grand_total":
        return row.primary.grand_total;
      default: {
        const exhaustive: never = metric;
        return exhaustive;
      }
    }
  };
  const axisMax = useMemo(() => {
    let max = 1;
    for (const month of data.months) {
      max = Math.max(max, month.primary.subtotal, month.primary.shipping, month.primary.grand_total);
    }
    return niceAxisMax(max);
  }, [data.months]);
  const labelH = 28;

  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">
        Monthly sales for <span className="font-semibold text-foreground">{data.primary_year}</span>.
      </p>
      <div className="flex items-stretch gap-1 border border-border/60 bg-ink/40 px-1 pt-4">
        <div className="flex flex-col pl-1" style={{ paddingBottom: labelH }}>
          <ChartYAxis axisMax={axisMax} />
        </div>
        <div className="relative min-w-0 flex-1 overflow-x-auto pb-2">
          <div className="relative min-w-[640px]">
            <ChartGridLines axisMax={axisMax} />
            <div className="relative z-[1] flex items-end gap-2" style={{ height: CHART_PLOT_H + labelH }}>
              {data.months.map((row) => {
                const value = monthValue(row);
                const height = Math.max((value / axisMax) * 100, value > 0 ? 6 : 0);
                return (
                  <div
                    key={row.month}
                    className="flex min-w-[44px] flex-1 flex-col items-center justify-end"
                    style={{ height: CHART_PLOT_H + labelH }}
                  >
                    <div className="flex w-full items-end justify-center" style={{ height: CHART_PLOT_H }}>
                      <div
                        className="min-h-[2px] w-5 rounded-t bg-sky-600"
                        style={{ height: `${height}%` }}
                        title={`${data.primary_year} ${row.month_name}: ${formatMoney(value)}`}
                      />
                    </div>
                    <div className="w-full text-center text-[10px] text-muted-foreground" style={{ height: labelH, paddingTop: 4 }}>
                      {row.month_name.slice(0, 3)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsChartsPage() {
  const [metric, setMetric] = useState<SalesMetric>("subtotal");
  const [rangePreset, setRangePreset] = useState<"30" | "90" | "365" | "custom">("30");
  const [from, setFrom] = useState(() => todayYmd(addDays(new Date(), -29)));
  const [to, setTo] = useState(() => todayYmd());
  const [daily, setDaily] = useState<DailySalesPoint[]>([]);
  const [yearCmp, setYearCmp] = useState<SalesChartsYearCompareResponse | null>(null);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [loadingDaily, setLoadingDaily] = useState(true);
  const [loadingYear, setLoadingYear] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const [periodMode, setPeriodMode] = useState<"month" | "quarter">("month");
  const [selMonth, setSelMonth] = useState(() => new Date().getMonth());
  const [selQuarter, setSelQuarter] = useState(() => Math.floor(new Date().getMonth() / 3) + 1);
  const [periodData, setPeriodData] = useState<DailySalesPoint[]>([]);
  const [loadingPeriod, setLoadingPeriod] = useState(true);

  function applyDayRange(daysInclusive: number, preset: "30" | "90" | "365") {
    const end = new Date();
    setFrom(todayYmd(addDays(end, -(daysInclusive - 1))));
    setTo(todayYmd(end));
    setRangePreset(preset);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoadingDaily(true);
      setErr(null);
      try {
        const res = await analyticsApi.getDailyCharts(from, to);
        if (!cancelled) setDaily(res.days ?? []);
      } catch {
        if (!cancelled) {
          setDaily([]);
          setErr("Could not load daily sales.");
        }
      } finally {
        if (!cancelled) setLoadingDaily(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoadingPeriod(true);
      const range = periodRange(periodMode, selMonth, selQuarter, currentYear);
      try {
        const res = await analyticsApi.getDailyCharts(range.from, range.to);
        if (!cancelled) setPeriodData(res.days ?? []);
      } catch {
        if (!cancelled) setPeriodData([]);
      } finally {
        if (!cancelled) setLoadingPeriod(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [periodMode, selMonth, selQuarter, currentYear]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoadingYear(true);
      try {
        const res = await analyticsApi.getYearCompare(year);
        if (!cancelled) setYearCmp(res);
      } catch {
        if (!cancelled) setYearCmp(null);
      } finally {
        if (!cancelled) setLoadingYear(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [year]);

  const yearOptions = useMemo(() => {
    const latest = Math.max(new Date().getFullYear(), CHARTS_MIN_YEAR);
    const opts: number[] = [];
    for (let yr = latest; yr >= CHARTS_MIN_YEAR; yr -= 1) opts.push(yr);
    return opts;
  }, []);

  const periodTotals = useMemo(
    () =>
      periodData.reduce(
        (acc, day) => {
          acc.subtotal += day.subtotal;
          acc.shipping += day.shipping;
          acc.grand_total += day.grand_total;
          acc.orders += day.orders_count;
          return acc;
        },
        { subtotal: 0, shipping: 0, grand_total: 0, orders: 0 },
      ),
    [periodData],
  );

  const periodLabel =
    periodMode === "month" ? `${MONTH_NAMES[selMonth]} ${currentYear}` : `${QUARTERS[selQuarter - 1].label} ${currentYear}`;
  const periodMetricTotal = metricValue(
    {
      date: "",
      subtotal: periodTotals.subtotal,
      shipping: periodTotals.shipping,
      grand_total: periodTotals.grand_total,
      orders_count: periodTotals.orders,
    },
    metric,
  );

  return (
    <div>
      <div className="mb-6">
        <h2 className="m-0 text-xl font-semibold">Charts</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Daily bars with scroll/drag, monthly or quarterly totals for the current year, and monthly totals for a
          selected year (from {CHARTS_MIN_YEAR}).
        </p>
      </div>

      <section className="tile mb-8">
        <h3 className="mb-2 text-lg">Metric for all charts</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          {(
            [
              ["subtotal", "Product sales (no shipping)"],
              ["shipping", "Shipping"],
              ["grand_total", "Grand total (includes shipping)"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex cursor-pointer items-center gap-2">
              <input type="radio" name="metric" checked={metric === value} onChange={() => setMetric(value)} />
              {label}
            </label>
          ))}
        </div>
      </section>

      {err ? <p className="mb-4 text-sm text-red-400">{err}</p> : null}

      <section className="tile mb-8">
        <h3 className="mb-3 text-lg">Daily sales</h3>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="mr-2 text-sm text-muted-foreground">Range:</span>
          {(["30", "90", "365"] as const).map((preset) => {
            const days = preset === "30" ? 30 : preset === "90" ? 90 : 365;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => applyDayRange(days, preset)}
                className={rangePreset === preset ? "gold-btn" : "ghost-btn"}
              >
                Last {preset} days
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setRangePreset("custom")}
            className={rangePreset === "custom" ? "gold-btn" : "ghost-btn"}
          >
            Custom
          </button>
        </div>
        {rangePreset === "custom" ? (
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <label className="text-sm text-muted-foreground">
              From
              <input
                type="date"
                value={from}
                onChange={(event) => {
                  setFrom(event.target.value);
                  setRangePreset("custom");
                }}
                className="field mt-1 w-auto py-2"
              />
            </label>
            <label className="text-sm text-muted-foreground">
              To
              <input
                type="date"
                value={to}
                onChange={(event) => {
                  setTo(event.target.value);
                  setRangePreset("custom");
                }}
                className="field mt-1 w-auto py-2"
              />
            </label>
          </div>
        ) : null}
        {loadingDaily ? (
          <p className="py-8 text-sm text-muted-foreground">Loading daily data…</p>
        ) : daily.length === 0 ? (
          <p className="text-sm text-muted-foreground">No orders in this range.</p>
        ) : (
          <DailySalesScrollChart days={daily} metric={metric} />
        )}
      </section>

      <section className="tile mb-8">
        <h3 className="mb-3 text-lg">Monthly &amp; quarterly</h3>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="inline-flex overflow-hidden border border-border">
            <button
              type="button"
              onClick={() => setPeriodMode("month")}
              className={periodMode === "month" ? "gold-btn" : "ghost-btn"}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setPeriodMode("quarter")}
              className={periodMode === "quarter" ? "gold-btn" : "ghost-btn"}
            >
              Quarterly
            </button>
          </div>
          {periodMode === "month" ? (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              Month
              <select
                value={selMonth}
                onChange={(event) => setSelMonth(Number(event.target.value))}
                className="field w-auto py-2"
              >
                {MONTH_NAMES.map((name, index) => (
                  <option key={name} value={index}>
                    {name} {currentYear}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              Quarter
              <select
                value={selQuarter}
                onChange={(event) => setSelQuarter(Number(event.target.value))}
                className="field w-auto py-2"
              >
                {QUARTERS.map((qtr) => (
                  <option key={qtr.q} value={qtr.q}>
                    {qtr.label} {currentYear}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {loadingPeriod ? (
          <p className="py-8 text-sm text-muted-foreground">Loading…</p>
        ) : periodData.length === 0 ? (
          <p className="text-sm text-muted-foreground">No orders in {periodLabel}.</p>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap gap-6 text-sm">
              <div>
                <span className="text-muted-foreground">Total (selected metric)</span>
                <div className="text-lg font-semibold">{formatMoney(periodMetricTotal)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Product sales</span>
                <div className="text-lg font-semibold">{formatMoney(periodTotals.subtotal)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Shipping</span>
                <div className="text-lg font-semibold">{formatMoney(periodTotals.shipping)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Grand total</span>
                <div className="text-lg font-semibold">{formatMoney(periodTotals.grand_total)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Orders</span>
                <div className="text-lg font-semibold">{periodTotals.orders}</div>
              </div>
            </div>
            <DailySalesScrollChart days={periodData} metric={metric} />
          </>
        )}
      </section>

      <section className="tile mb-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="m-0 text-lg">Year (by month)</h3>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Year
            <select value={year} onChange={(event) => setYear(Number(event.target.value))} className="field w-auto py-2">
              {yearOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
        {loadingYear ? (
          <p className="py-8 text-sm text-muted-foreground">Loading…</p>
        ) : yearCmp ? (
          <YearMonthlyChart data={yearCmp} metric={metric} />
        ) : (
          <p className="text-sm text-muted-foreground">No data.</p>
        )}
      </section>
    </div>
  );
}
