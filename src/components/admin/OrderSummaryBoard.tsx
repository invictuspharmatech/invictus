"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Calendar } from "lucide-react";
import { STAFF_ORDER_STATUSES, formatOrderStatus } from "@/lib/enums";

type SummaryRow = {
  id: string;
  orderNumber: string;
  customerName: string;
  status: string;
  createdAt: string;
  items: { productName: string; quantity: number }[];
};

/** Earliest selectable day on this page (inclusive). */
const SUMMARY_DATE_MIN = "2026-08-01";

function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function clampSummaryDate(value: string, min: string, max: string): string {
  if (!value) return "";
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function SummaryDateField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: string;
  min: string;
  max: string;
  onChange: (next: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    const picker = el as HTMLInputElement & { showPicker?: () => void };
    try {
      picker.showPicker?.();
    } catch {
      // Older browsers: focus is enough for the native control.
    }
  }

  return (
    <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
      {label}
      <div className="relative">
        <input
          ref={inputRef}
          className="field w-full pr-10"
          type="date"
          value={value}
          min={min}
          max={max}
          onChange={(event) => onChange(clampSummaryDate(event.target.value, min, max))}
          onClick={openPicker}
        />
        <button
          type="button"
          className="absolute right-1 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded text-signal hover:bg-signal/15"
          title={`Pick ${label.toLowerCase()} date`}
          aria-label={`Open ${label.toLowerCase()} calendar`}
          onClick={openPicker}
        >
          <Calendar className="size-4" aria-hidden />
        </button>
      </div>
    </label>
  );
}

export function OrderSummaryBoard() {
  const maxDate = useMemo(() => todayLocal(), []);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState<string[]>(["all"]);
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (!selected.includes("all")) {
      selected.forEach((status) => params.append("statuses", status));
    }
    const response = await fetch(`/api/admin/orders/summary?${params.toString()}`);
    const payload = (await response.json()) as
      | { orders: SummaryRow[]; totalOrders: number; error?: string }
      | { error?: string };
    setLoading(false);
    if (!response.ok || !payload || !("orders" in payload)) {
      setError(payload && "error" in payload ? payload.error || "Could not load summary." : "Could not load summary.");
      return;
    }
    setRows(payload.orders);
    setTotal(payload.totalOrders);
  }, [dateFrom, dateTo, selected]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateFrom(next: string) {
    const clamped = clampSummaryDate(next, SUMMARY_DATE_MIN, maxDate);
    setDateFrom(clamped);
    if (clamped && dateTo && clamped > dateTo) {
      setDateTo(clamped);
    }
  }

  function updateTo(next: string) {
    const fromFloor = dateFrom && dateFrom > SUMMARY_DATE_MIN ? dateFrom : SUMMARY_DATE_MIN;
    const clamped = clampSummaryDate(next, fromFloor, maxDate);
    setDateTo(clamped);
  }

  function toggleStatus(key: string) {
    if (key === "all") {
      setSelected(["all"]);
      return;
    }
    setSelected((current) => {
      const next = current.filter((item) => item !== "all");
      if (next.includes(key)) {
        const rest = next.filter((item) => item !== key);
        return rest.length ? rest : ["all"];
      }
      return [...next, key];
    });
  }

  async function downloadPdf() {
    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (!selected.includes("all")) {
      selected.forEach((status) => params.append("statuses", status));
    }
    const response = await fetch(`/api/admin/orders/summary/pdf?${params.toString()}`);
    if (!response.ok) {
      setError("Could not download PDF.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `order-summary-${todayLocal()}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="display-font text-3xl">Order summary</h1>
          <p className="mt-2 text-sm text-muted-foreground">{total} orders in this filter.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="ghost-btn" onClick={() => window.print()}>
            Print
          </button>
          <button type="button" className="gold-btn" onClick={() => void downloadPdf()}>
            Download PDF
          </button>
        </div>
      </div>

      <div className="tile mt-6 grid gap-3 md:grid-cols-4 print:hidden">
        <SummaryDateField
          label="From"
          value={dateFrom}
          min={SUMMARY_DATE_MIN}
          max={dateTo && dateTo < maxDate ? dateTo : maxDate}
          onChange={updateFrom}
        />
        <SummaryDateField
          label="To"
          value={dateTo}
          min={dateFrom && dateFrom > SUMMARY_DATE_MIN ? dateFrom : SUMMARY_DATE_MIN}
          max={maxDate}
          onChange={updateTo}
        />
        <div className="md:col-span-2 flex flex-wrap gap-2 text-sm">
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={selected.includes("all")} onChange={() => toggleStatus("all")} />
            All
          </label>
          {STAFF_ORDER_STATUSES.map((item) => (
            <label key={item} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={selected.includes(item.toLowerCase())}
                onChange={() => toggleStatus(item.toLowerCase())}
              />
              {formatOrderStatus(item)}
            </label>
          ))}
        </div>
        <p className="md:col-span-4 text-xs text-muted-foreground">
          Dates are selectable from {SUMMARY_DATE_MIN} through today ({maxDate}). Future days are locked.
        </p>
      </div>

      {error ? <p className="mt-4 text-sm text-brand-red print:hidden">{error}</p> : null}
      {loading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="tile mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              <tr>
                <th className="py-2">Order #</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Date</th>
                <th>Products (qty)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((order) => (
                <tr key={order.id} className="border-t border-border/40 align-top">
                  <td className="py-3">{order.orderNumber}</td>
                  <td>{order.customerName}</td>
                  <td className="capitalize">{formatOrderStatus(order.status)}</td>
                  <td>{order.createdAt.slice(0, 10)}</td>
                  <td>
                    {order.items.map((item) => (
                      <div key={`${order.id}-${item.productName}`}>
                        {item.productName} × {item.quantity}
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
