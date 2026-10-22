"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";
import { ArrowRightCircle, Check, Eye, Pencil, Printer } from "lucide-react";
import { STAFF_ORDER_STATUSES, formatOrderStatus, orderStatusTab } from "@/lib/enums";
import { formatMoney } from "@/lib/constants";
import { isFullAdmin } from "@/lib/roles";
import { warehouseLabel, warehouseShort } from "@/lib/warehouse";
import { OrderAddressQuickEdit } from "@/components/admin/OrderAddressQuickEdit";
import { OrderItemsQuickEdit } from "@/components/admin/OrderItemsQuickEdit";
import { OrderStatusBadge } from "@/components/admin/OrderStatusBadge";
import { MAX_BTCPOSTAGE_LABEL_BATCH, PostageLabelModal } from "@/components/admin/PostageLabelModal";
import { ShippingLabelActions } from "@/components/admin/ShippingLabelActions";
import type { AdminOrdersResponse, ApiOrder } from "@/lib/api-types";

type QuickEditMode = "address" | "items" | null;

/** Compact icon action chip for the orders list */
const actionIconBtn =
  "inline-flex h-8 w-8 items-center justify-center rounded border border-border bg-card text-signal hover:bg-signal/15";

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
  const [quickEdit, setQuickEdit] = useState<{ id: string; mode: Exclude<QuickEditMode, null> } | null>(
    null,
  );

  function toggleQuickEdit(id: string, mode: Exclude<QuickEditMode, null>) {
    setQuickEdit((current) =>
      current?.id === id && current.mode === mode ? null : { id, mode },
    );
  }

  function patchOrder(next: ApiOrder) {
    setOrders((current) => current.map((row) => (row.id === next.id ? next : row)));
    setQuickEdit(null);
  }

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

  async function setStatuses(ids: string[], nextStatus: string, confirmMessage: string) {
    if (ids.length === 0) return;
    if (!window.confirm(confirmMessage)) return;
    setError("");
    const response = await fetch("/api/admin/orders/bulk-status", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids, status: nextStatus }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error || "Could not update status.");
      return;
    }
    setSelected([]);
    await load();
  }

  function canCreateLabel(order: ApiOrder) {
    const key = order.status.toUpperCase();
    return key === "PROCESSING" || key === "COMPLETED" || key === "PARTIALLY_FILLED";
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display-font text-3xl">Orders</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Eye quick-edits the ship-to address; pencil quick-edits line items. Click the order
            number for the full order page. Status changes use row actions or bulk menu.
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
                className="ghost-btn inline-flex items-center gap-2"
                onClick={() => {
                  const urls = selectedOrders()
                    .flatMap((order) => order.shippingLabels ?? [])
                    .map((label) => label.labelUrl)
                    .filter((url) => url.trim());
                  if (urls.length === 0) {
                    setError("No shipping labels on the selected orders.");
                    return;
                  }
                  setError("");
                  for (const url of urls) {
                    window.open(url, "_blank", "noopener,noreferrer");
                  }
                }}
              >
                <Printer className="size-4" aria-hidden />
                Print labels
              </button>
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
        <div className="tile mt-6 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-separate border-spacing-0 text-left text-sm">
              <thead className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                <tr className="[&>th]:border-b [&>th]:border-border/50">
                  <th className="sticky left-0 z-20 min-w-[7.5rem] border-r border-border/50 bg-card px-2 py-2 align-middle">
                    <label className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-border bg-card">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={(event) =>
                          setSelected(event.target.checked ? orders.map((order) => order.id) : [])
                        }
                        aria-label="Select all orders"
                      />
                    </label>
                  </th>
                  <th className="px-3 py-2 align-middle">Order</th>
                  <th className="px-3 py-2 align-middle">Date</th>
                  <th className="px-3 py-2 align-middle">Status</th>
                  <th className="px-3 py-2 align-middle">Total</th>
                  <th className="px-3 py-2 align-middle">Bitcoin Postage</th>
                  <th className="px-3 py-2 align-middle">Shipment tracking</th>
                  <th className="px-3 py-2 align-middle">Warehouse</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const labels = order.shippingLabels ?? [];
                  const statusIds = selected.length > 0 ? selected : [order.id];
                  const addressOpen = quickEdit?.id === order.id && quickEdit.mode === "address";
                  const itemsOpen = quickEdit?.id === order.id && quickEdit.mode === "items";
                  return (
                    <Fragment key={order.id}>
                    <tr className="group [&>td]:border-b [&>td]:border-border/40 hover:bg-muted/30">
                      <td className="sticky left-0 z-10 min-w-[7.5rem] border-r border-border/40 bg-card px-2 py-2 align-middle group-hover:bg-muted/30">
                        <div className="flex shrink-0 items-center gap-1">
                          <label className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-border bg-card">
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
                              aria-label={`Select order ${order.orderNumber}`}
                            />
                          </label>
                          <div className="grid shrink-0 grid-cols-[2rem_2rem] gap-1">
                            <button
                              type="button"
                              className={`${actionIconBtn} ${addressOpen ? "bg-signal/20" : ""}`}
                              title="Quick edit customer address"
                              onClick={() => toggleQuickEdit(order.id, "address")}
                            >
                              <Eye className="size-4" aria-hidden />
                            </button>
                            <button
                              type="button"
                              className={`${actionIconBtn} ${itemsOpen ? "bg-signal/20" : ""}`}
                              title="Quick edit order items"
                              onClick={() => toggleQuickEdit(order.id, "items")}
                            >
                              <Pencil className="size-4" aria-hidden />
                            </button>
                            <button
                              type="button"
                              className={actionIconBtn}
                              title={
                                statusIds.length > 1
                                  ? `Move ${statusIds.length} selected to processing`
                                  : "Move to processing"
                              }
                              onClick={() =>
                                void setStatuses(
                                  statusIds,
                                  "PROCESSING",
                                  statusIds.length > 1
                                    ? `Move ${statusIds.length} selected orders to processing?`
                                    : `Move order ${order.orderNumber} to processing?`,
                                )
                              }
                            >
                              <ArrowRightCircle className="size-4" aria-hidden />
                            </button>
                            <button
                              type="button"
                              className={actionIconBtn}
                              title={
                                statusIds.length > 1
                                  ? `Mark ${statusIds.length} selected as completed`
                                  : "Mark as complete"
                              }
                              onClick={() =>
                                void setStatuses(
                                  statusIds,
                                  "COMPLETED",
                                  statusIds.length > 1
                                    ? `Mark ${statusIds.length} selected orders as completed?`
                                    : `Mark order ${order.orderNumber} as completed?`,
                                )
                              }
                            >
                              <Check className="size-4" aria-hidden />
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="font-mono text-xs font-semibold text-signal hover:underline"
                          title="Open full order"
                        >
                          {order.orderNumber}
                        </Link>
                        <p className="mt-1 text-xs text-muted-foreground">{order.customerName}</p>
                        <p className="text-xs text-muted-foreground">{order.customerEmail}</p>
                      </td>
                      <td className="px-3 py-2 align-middle text-xs whitespace-nowrap text-muted-foreground">
                        {formatDate(order.createdAt)}
                      </td>
                      <td className="px-3 py-2 align-middle whitespace-nowrap">
                        <OrderStatusBadge status={order.status} />
                        {order.paymentStatus ? (
                          <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                            pay {order.paymentStatus.toLowerCase()}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 align-middle whitespace-nowrap font-medium">
                        {formatMoney(order.grandTotal)}
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <div className="flex flex-col items-start gap-1.5">
                          {canCreateLabel(order) ? (
                            <button
                              type="button"
                              className="inline-flex items-center rounded bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:opacity-90"
                              onClick={() => openLabelModal([order])}
                            >
                              Create Label
                            </button>
                          ) : null}
                          <ShippingLabelActions
                            orderId={order.id}
                            labels={labels}
                            onDeleted={(next) =>
                              setOrders((current) =>
                                current.map((row) => (row.id === next.id ? next : row)),
                              )
                            }
                            onError={setError}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2 align-middle">
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
                          <button
                            type="button"
                            className="ghost-btn"
                            onClick={() => void saveTracking(order)}
                          >
                            Save
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-2 align-middle text-xs text-muted-foreground">
                        <span title={warehouseLabel(order.warehouse)}>
                          {warehouseShort(order.warehouse)}
                        </span>
                      </td>
                    </tr>
                    {addressOpen || itemsOpen ? (
                      <tr className="[&>td]:border-b [&>td]:border-border/40">
                        <td colSpan={8} className="p-0">
                          {addressOpen ? (
                            <OrderAddressQuickEdit
                              order={order}
                              onCancel={() => setQuickEdit(null)}
                              onSaved={patchOrder}
                            />
                          ) : null}
                          {itemsOpen ? (
                            <OrderItemsQuickEdit
                              order={order}
                              onCancel={() => setQuickEdit(null)}
                              onSaved={patchOrder}
                            />
                          ) : null}
                        </td>
                      </tr>
                    ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
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
