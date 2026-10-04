"use client";

import { useMemo, useState } from "react";
import type { AnalyticsOverviewParams } from "@/lib/analytics";

export type AnalyticsPeriodFilterValue =
  | "day"
  | "week"
  | "month"
  | "year"
  | "custom_day"
  | "custom_week"
  | "custom_month"
  | "custom_year"
  | "custom_range";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function todayYmd(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function useAnalyticsPeriodFilter(defaultFilter: AnalyticsPeriodFilterValue = "month") {
  const [filter, setFilter] = useState<AnalyticsPeriodFilterValue>(defaultFilter);
  const [customDate, setCustomDate] = useState(todayYmd);
  const [customMonth, setCustomMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  });
  const [customYear, setCustomYear] = useState(() => new Date().getFullYear());
  const [rangeFrom, setRangeFrom] = useState(() => todayYmd(addDays(new Date(), -29)));
  const [rangeTo, setRangeTo] = useState(todayYmd);

  const yearOptions = useMemo(() => {
    const year = new Date().getFullYear();
    return Array.from({ length: Math.max(1, year - 2023) }, (_, index) => year - index);
  }, []);

  const queryParams = useMemo((): AnalyticsOverviewParams => {
    switch (filter) {
      case "day":
      case "week":
      case "month":
      case "year":
        return { period: filter };
      case "custom_day":
        return { period: "custom", custom_type: "day", date: customDate };
      case "custom_week":
        return { period: "custom", custom_type: "week", date: customDate };
      case "custom_month":
        return { period: "custom", custom_type: "month", month: customMonth };
      case "custom_year":
        return { period: "custom", custom_type: "year", year: customYear };
      case "custom_range":
        return { period: "custom", custom_type: "range", from: rangeFrom, to: rangeTo };
      default: {
        const exhaustive: never = filter;
        return exhaustive;
      }
    }
  }, [filter, customDate, customMonth, customYear, rangeFrom, rangeTo]);

  return {
    filter,
    setFilter,
    customDate,
    setCustomDate,
    customMonth,
    setCustomMonth,
    customYear,
    setCustomYear,
    rangeFrom,
    setRangeFrom,
    rangeTo,
    setRangeTo,
    yearOptions,
    queryParams,
  };
}

type FilterState = ReturnType<typeof useAnalyticsPeriodFilter>;

export function AnalyticsPeriodFilterControls({
  state,
  label,
}: {
  state: FilterState;
  label?: string | null;
}) {
  const {
    filter,
    setFilter,
    customDate,
    setCustomDate,
    customMonth,
    setCustomMonth,
    customYear,
    setCustomYear,
    rangeFrom,
    setRangeFrom,
    rangeTo,
    setRangeTo,
    yearOptions,
  } = state;

  return (
    <div className="flex flex-col items-stretch gap-1 sm:items-end">
      <div className="flex flex-wrap items-end justify-end gap-2">
        <label className="text-sm text-muted-foreground">
          <span className="sr-only">Period</span>
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as AnalyticsPeriodFilterValue)}
            className="field w-auto min-w-40 py-2"
          >
            <option value="day">Today</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
            <option value="year">This year</option>
            <option value="custom_day">Custom day</option>
            <option value="custom_week">Custom week</option>
            <option value="custom_month">Custom month</option>
            <option value="custom_year">Custom year</option>
            <option value="custom_range">Date range</option>
          </select>
        </label>

        {(filter === "custom_day" || filter === "custom_week") && (
          <label className="text-sm text-muted-foreground">
            {filter === "custom_week" ? "Any day in week" : "Date"}
            <input
              type="date"
              value={customDate}
              onChange={(event) => setCustomDate(event.target.value)}
              className="field ml-2 w-auto py-2"
            />
          </label>
        )}

        {filter === "custom_month" && (
          <label className="text-sm text-muted-foreground">
            Month
            <input
              type="month"
              value={customMonth}
              onChange={(event) => setCustomMonth(event.target.value)}
              className="field ml-2 w-auto py-2"
            />
          </label>
        )}

        {filter === "custom_year" && (
          <label className="text-sm text-muted-foreground">
            Year
            <select
              value={customYear}
              onChange={(event) => setCustomYear(Number(event.target.value))}
              className="field ml-2 w-auto py-2"
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
        )}

        {filter === "custom_range" && (
          <>
            <label className="text-sm text-muted-foreground">
              From
              <input
                type="date"
                value={rangeFrom}
                onChange={(event) => setRangeFrom(event.target.value)}
                className="field ml-2 w-auto py-2"
              />
            </label>
            <label className="text-sm text-muted-foreground">
              To
              <input
                type="date"
                value={rangeTo}
                onChange={(event) => setRangeTo(event.target.value)}
                className="field ml-2 w-auto py-2"
              />
            </label>
          </>
        )}
      </div>
      {label ? (
        <p className="text-right text-xs text-muted-foreground">
          Showing: <span className="font-medium text-foreground">{label}</span>
        </p>
      ) : null}
    </div>
  );
}
