"use client";

import { useCallback, useEffect, useState } from "react";
import { STAFF_ORDER_STATUSES, formatOrderStatus } from "@/lib/enums";

type SummaryRow = {
  id: string;
  orderNumber: string;
  customerName: string;
  status: string;
  createdAt: string;
  items: { productName: string; quantity: number }[];
};

export function OrderSummaryBoard() {
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
    link.download = `order-summary-${new Date().toISOString().slice(0, 10)}.pdf`;
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
        <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
          From
          <input className="field" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        </label>
        <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
          To
          <input className="field" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        </label>
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
