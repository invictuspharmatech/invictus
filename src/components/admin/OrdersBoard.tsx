"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { STAFF_ORDER_STATUSES, formatOrderStatus, orderStatusTab } from "@/lib/enums";
import { formatMoney } from "@/lib/constants";
import { isFullAdmin } from "@/lib/roles";
import { warehouseLabel, warehouseShort } from "@/lib/warehouse";
import { OrderStatusSelect } from "@/components/admin/OrderStatusSelect";
import { MAX_BTCPOSTAGE_LABEL_BATCH, PostageLabelModal } from "@/components/admin/PostageLabelModal";
import type { AdminOrdersResponse, ApiOrder } from "@/lib/api-types";

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "on_hold", label: "On hold" },
  { key: "processing", label: "Processing" },
  { key: "partially_filled", label: "Partially filled" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "refunded", label: "Refunded" },
  { key: "failed", label: "Failed" },
] as const;

const BULK_STATUSES = [...STAFF_ORDER_STATUSES];

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function OrdersBoard({
  role,
  initialStatus = "all",
  initialWarehouse = "BOTH",
}: {
  role: string;
  initialStatus?: string;
  initialWarehouse?: string;
}) {
  const admin = isFullAdmin(role);
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(orderStatusTab(initialStatus));
  const [warehouse, setWarehouse] = useState(initialWarehouse);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState("");
  const [labelOrders, setLabelOrders] = useState<ApiOrder[] | null>(null);
  const [trackingDraft, setTrackingDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (appliedSearch) params.set("q", appliedSearch);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (admin && warehouse !== "BOTH") params.set("warehouse", warehouse);
    const response = await fetch(`/api/admin/orders?${params.toString()}`);
    const payload = (await response.json().catch(() => null)) as
      | AdminOrdersResponse
      | { error?: string }
      | null;
    setLoading(false);
    if (!response.ok || !payload || !("orders" in payload)) {
      setError(
        payload && "error" in payload && payload.error
          ? payload.error
          : "Could not load orders.",
      );
      return;
    }
    setOrders(payload.orders);
    setCounts(payload.counts || {});
    setSelected([]);
  }, [admin, appliedSearch, dateFrom, dateTo, status, warehouse]);

  useEffect(() => {
    void load();
  }, [load]);

  const allSelected = orders.length > 0 && selected.length === orders.length;

  function selectedOrders() {
    return orders.filter((order) => selected.includes(order.id));
  }

  function openLabelModal(rows: ApiOrder[]) {
    if (rows.length === 0) return;
    if (rows.length > MAX_BTCPOSTAGE_LABEL_BATCH) {
      setError(
        `Select up to ${MAX_BTCPOSTAGE_LABEL_BATCH} orders per Bitcoin Postage label batch.`,
      );
      return;
    }
    setError("");
    setLabelOrders(rows);
  }

  async function applyBulk() {
    if (!bulkStatus || selected.length === 0) return;
    if (bulkStatus === "create_labels") {
      openLabelModal(selectedOrders());
      return;
    }
    const response = await fetch("/api/admin/orders/bulk-status", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: selected, status: bulkStatus }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error || "Bulk update failed.");
      return;
    }
    await load();
  }

  async function saveTracking(order: ApiOrder) {
    const trackingNumber = (trackingDraft[order.id] ?? order.trackingNumber ?? "").trim();
    const response = await fetch(`/api/admin/orders/${order.id}/tracking`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ trackingNumber, carrier: "USPS" }),
    });
    const payload = (await response.json().catch(() => null)) as ApiOrder | { error?: string } | null;
    if (!response.ok || !payload || !("orderNumber" in payload)) {
      setError(
        payload && "error" in payload && payload.error ? payload.error : "Could not save tracking.",
      );
      return;
    }
    setOrders((current) => current.map((row) => (row.id === order.id ? payload : row)));
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display-font text-3xl">Orders</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Filter, bulk-update status, add tracking, and buy Bitcoin Postage labels. Split
            checkouts share a group ID.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {admin ? (
            <Link href="/admin/orders/create" className="gold-btn">
              Create order
            </Link>
          ) : null}
          <Link href="/admin/orders/summary" className="ghost-btn">
            Order summary
          </Link>
          <p className="text-sm text-muted-foreground">{counts.all ?? orders.length} orders</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 border-b border-border/50 pb-px">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`px-3 py-2 text-[12px] uppercase tracking-[0.16em] ${
              status === tab.key
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground"
            }`}
            onClick={() => setStatus(tab.key)}
          >
            {tab.label}
            <span className="ml-2 text-muted-foreground">({counts[tab.key] ?? 0})</span>
          </button>
        ))}
      </div>

      <div className="tile mt-6 grid gap-3 md:grid-cols-4">
        <div className="md:col-span-2 flex gap-2">
          <input
            className="field"
            placeholder="Search order, customer, email, tracking"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") setAppliedSearch(search.trim());
            }}
          />
          <button type="button" className="gold-btn" onClick={() => setAppliedSearch(search.trim())}>
            Search
          </button>
        </div>
        <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
          From
          <input
            className="field"
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
          />
        </label>
        <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
          To
          <input
            className="field"
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
          />
        </label>
        {admin ? (
          <label className="grid gap-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Warehouse
            <select
              className="field"
              value={warehouse}
              onChange={(event) => setWarehouse(event.target.value)}
            >
              <option value="BOTH">Both</option>
              <option value="WAREHOUSE_1">Warehouse 1</option>
              <option value="WAREHOUSE_2">Warehouse 2</option>
            </select>
          </label>
        ) : null}
        <div className="md:col-span-4 flex flex-wrap items-center gap-2">
          <select
            className="field max-w-xs"
            value={bulkStatus}
            onChange={(event) => setBulkStatus(event.target.value)}
          >
            <option value="">Bulk actions</option>
            {BULK_STATUSES.map((item) => (
              <option key={item} value={item}>
                Mark {formatOrderStatus(item)}
              </option>
            ))}
            <option value="create_labels">Create Bitcoin Postage labels</option>
          </select>
          <button
            type="button"
            className="ghost-btn"
            disabled={!bulkStatus || selected.length === 0}
            onClick={() => void applyBulk()}
          >
            Apply
          </button>
          {selected.length > 0 ? (
            <>
              <span className="text-sm text-muted-foreground">
                {selected.length}/{MAX_BTCPOSTAGE_LABEL_BATCH} selected for label batch
              </span>
              <button
                type="button"
                className="gold-btn"
                onClick={() => openLabelModal(selectedOrders())}
              >
                Create Bitcoin Postage labels
              </button>
            </>
          ) : null}
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-brand-red">{error}</p> : null}

      {loading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading orders…</p>
      ) : orders.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">No orders found.</p>
      ) : (
        <div className="tile mt-6 overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              <tr>
                <th className="py-3 pr-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(event) =>
                      setSelected(event.target.checked ? orders.map((order) => order.id) : [])
                    }
                  />
                </th>
                <th>Order</th>
                <th>Date</th>
                <th>Status</th>
                <th>Total</th>
                <th>Actions</th>
                <th>Bitcoin Postage</th>
                <th>Shipment tracking</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const labels = order.shippingLabels ?? [];
                return (
                  <tr key={order.id} className="border-t border-border/40 align-top">
                    <td className="py-4 pr-3">
                      <input
                        type="checkbox"
                        checked={selected.includes(order.id)}
                        onChange={(event) =>
                          setSelected((current) =>
                            event.target.checked
                              ? [...current, order.id]
                              : current.filter((id) => id !== order.id),
                          )
                        }
                      />
                    </td>
                    <td className="py-4 pr-3">
                      <Link href={`/admin/orders/${order.id}`} className="font-mono text-xs">
                        {order.orderNumber}
                      </Link>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {warehouseShort(order.warehouse)} · {order.customerName}
                      </p>
                      <p className="text-xs text-muted-foreground">{order.customerEmail}</p>
                    </td>
                    <td className="py-4 pr-3 text-xs text-muted-foreground">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="py-4 pr-3">
                      <OrderStatusSelect id={order.id} status={order.status} onUpdated={() => void load()} />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {order.paymentStatus ? `pay ${order.paymentStatus.toLowerCase()}` : ""}
                      </p>
                    </td>
                    <td className="py-4 pr-3">
                      {formatMoney(order.grandTotal)}
                      <p className="text-xs text-muted-foreground">{warehouseLabel(order.warehouse)}</p>
                    </td>
                    <td className="py-4 pr-3">
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/admin/orders/${order.id}`} className="ghost-btn">
                          View
                        </Link>
                        <button
                          type="button"
                          className="gold-btn"
                          onClick={() => openLabelModal([order])}
                        >
                          Create label
                        </button>
                      </div>
                    </td>
                    <td className="py-4 pr-3">
                      <div className="space-y-2">
                        {labels.length === 0 ? (
                          <span className="text-xs text-muted-foreground">No label yet</span>
                        ) : (
                          labels.map((label) => (
                            <div key={label.id} className="text-xs">
                              {label.trackingUrl ? (
                                <a href={label.trackingUrl} target="_blank" rel="noreferrer">
                                  {label.trackingNumber || "Track"}
                                </a>
                              ) : (
                                <span>{label.trackingNumber || "Label"}</span>
                              )}
                              {label.labelUrl ? (
                                <>
                                  {" · "}
                                  <a href={label.labelUrl} target="_blank" rel="noreferrer">
                                    Print
                                  </a>
                                </>
                              ) : null}
                            </div>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="py-4">
                      <div className="flex gap-2">
                        <input
                          className="field"
                          placeholder="Tracking #"
                          value={trackingDraft[order.id] ?? order.trackingNumber ?? ""}
                          onChange={(event) =>
                            setTrackingDraft((current) => ({
                              ...current,
                              [order.id]: event.target.value,
                            }))
                          }
                        />
                        <button type="button" className="ghost-btn" onClick={() => void saveTracking(order)}>
                          Save
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {labelOrders?.length ? (
        <PostageLabelModal
          orders={labelOrders}
          onClose={() => setLabelOrders(null)}
          onCreated={(updated) => {
            setOrders((current) =>
              current.map((row) => updated.find((next) => next.id === row.id) ?? row),
            );
            setLabelOrders(null);
            setSelected([]);
          }}
        />
      ) : null}
    </div>
  );
}
