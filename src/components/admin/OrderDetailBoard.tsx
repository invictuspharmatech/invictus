"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/constants";
import { isFullAdmin } from "@/lib/roles";
import { warehouseLabel } from "@/lib/warehouse";
import { OrderStatusSelect } from "@/components/admin/OrderStatusSelect";
import { OrderFulfillmentControls } from "@/components/admin/OrderFulfillmentControls";
import { PostageLabelModal } from "@/components/admin/PostageLabelModal";
import { ShippingLabelActions } from "@/components/admin/ShippingLabelActions";
import type { ApiOrder, ApiProduct, ApiWarehouseSettings } from "@/lib/api-types";

type ShippingDraft = {
  customerName: string;
  customerEmail: string;
  shippingLine1: string;
  shippingLine2: string;
  shippingCity: string;
  shippingState: string;
  shippingPostal: string;
  shippingCountry: string;
};

function shippingFromOrder(order: ApiOrder): ShippingDraft {
  return {
    customerName: order.customerName || "",
    customerEmail: order.customerEmail || "",
    shippingLine1: order.shippingLine1 || "",
    shippingLine2: order.shippingLine2 || "",
    shippingCity: order.shippingCity || "",
    shippingState: order.shippingState || "",
    shippingPostal: order.shippingPostal || "",
    shippingCountry: order.shippingCountry || "US",
  };
}

export function OrderDetailBoard({
  initial,
  policy,
  role,
  editMode = false,
}: {
  initial: ApiOrder;
  policy: ApiWarehouseSettings;
  role: string;
  editMode?: boolean;
}) {
  const [order, setOrder] = useState(initial);
  const [labelOpen, setLabelOpen] = useState(false);
  const [tracking, setTracking] = useState(initial.trackingNumber || "");
  const [labelError, setLabelError] = useState("");
  const [error, setError] = useState("");
  const [shippingDraft, setShippingDraft] = useState(shippingFromOrder(initial));
  const [qtyDraft, setQtyDraft] = useState<Record<string, number>>(() =>
    Object.fromEntries(initial.items.map((item) => [item.id, item.quantity])),
  );
  const [shippingSaving, setShippingSaving] = useState(false);
  const [itemsSaving, setItemsSaving] = useState(false);
  const [productQuery, setProductQuery] = useState("");
  const [productHits, setProductHits] = useState<ApiProduct[]>([]);
  const [addingProduct, setAddingProduct] = useState(false);
  // Admin / superuser may edit regardless of order status; warehouse staff still blocked on terminal statuses.
  const blocked =
    !isFullAdmin(role) &&
    ["CANCELLED", "REFUNDED", "FAILED"].includes(order.status.toUpperCase());

  async function reload() {
    const response = await fetch(`/api/admin/orders/${order.id}`);
    const next = (await response.json().catch(() => null)) as ApiOrder | { error?: string } | null;
    if (response.ok && next && "orderNumber" in next) {
      setOrder(next);
      setTracking(next.trackingNumber || "");
      setShippingDraft(shippingFromOrder(next));
      setQtyDraft(Object.fromEntries(next.items.map((item) => [item.id, item.quantity])));
    }
  }

  const shippingDirty = useMemo(() => {
    const base = shippingFromOrder(order);
    return (Object.keys(base) as (keyof ShippingDraft)[]).some(
      (key) => shippingDraft[key].trim() !== (base[key] || "").trim(),
    );
  }, [order, shippingDraft]);

  const itemsDirty = useMemo(() => {
    return order.items.some((item) => (qtyDraft[item.id] ?? item.quantity) !== item.quantity);
  }, [order.items, qtyDraft]);

  async function saveShipping() {
    if (blocked || !shippingDirty) return;
    if (
      !shippingDraft.shippingLine1.trim() ||
      !shippingDraft.shippingCity.trim() ||
      !shippingDraft.shippingState.trim() ||
      !shippingDraft.shippingPostal.trim()
    ) {
      setError("Address line 1, city, state, and postal code are required.");
      return;
    }
    setShippingSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/shipping`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(shippingDraft),
      });
      const data = (await res.json().catch(() => ({}))) as ApiOrder & { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not save shipping address.");
        return;
      }
      setOrder(data);
      setShippingDraft(shippingFromOrder(data));
    } finally {
      setShippingSaving(false);
    }
  }

  async function saveLineItems() {
    if (blocked || !itemsDirty) return;
    setItemsSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/line-items`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: order.items.map((item) => ({
            id: item.id,
            quantity: Math.max(0, Number(qtyDraft[item.id] ?? item.quantity) || 0),
          })),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as ApiOrder & { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not update line items.");
        return;
      }
      setOrder(data);
      setQtyDraft(Object.fromEntries(data.items.map((item) => [item.id, item.quantity])));
    } finally {
      setItemsSaving(false);
    }
  }

  async function searchProducts(query: string) {
    setProductQuery(query);
    if (query.trim().length < 2) {
      setProductHits([]);
      return;
    }
    const res = await fetch(`/api/admin/products?q=${encodeURIComponent(query.trim())}`);
    const data = (await res.json().catch(() => [])) as ApiProduct[] | { error?: string };
    setProductHits(Array.isArray(data) ? data.slice(0, 8) : []);
  }

  async function addProduct(product: ApiProduct) {
    if (blocked || addingProduct) return;
    setAddingProduct(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/add-item`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId: product.id, quantity: 1 }),
      });
      const data = (await res.json().catch(() => ({}))) as ApiOrder & { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not add product.");
        return;
      }
      setOrder(data);
      setQtyDraft(Object.fromEntries(data.items.map((item) => [item.id, item.quantity])));
      setProductQuery("");
      setProductHits([]);
    } finally {
      setAddingProduct(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/orders" className="text-sm text-muted-foreground">
          ← Orders
        </Link>
        {editMode ? (
          <Link href={`/admin/orders/${order.id}`} className="text-sm text-signal">
            Exit edit mode
          </Link>
        ) : (
          <Link href={`/admin/orders/${order.id}?edit=1`} className="text-sm text-signal">
            Edit order
          </Link>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="display-font text-3xl">
            {editMode ? "Edit order" : "Order"} {order.orderNumber}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {warehouseLabel(order.warehouse)} · {order.customerName} · {order.customerEmail}
          </p>
          <p className="text-xs text-muted-foreground">Group {order.groupId}</p>
        </div>
        <div className="text-right">
          <p>{formatMoney(order.grandTotal)}</p>
          <p className="text-xs text-muted-foreground">
            Merch {formatMoney(order.merchandiseTotal)} · Ship {formatMoney(order.shippingTotal)}
            {order.couponCode
              ? ` · ${order.couponCode}${order.discountTotal ? ` −${formatMoney(order.discountTotal)}` : ""}`
              : ""}
          </p>
        </div>
      </div>

      {editMode ? (
        <div className="tile mt-4 border-signal/30 bg-signal/5 p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Order edit mode</p>
          <p className="mt-1">
            Update shipping, adjust quantities (0 removes a line), or add products. Stock is deducted when
            you add or increase, and returned when you reduce or remove. Warehouse fulfill / move stays
            available below.
          </p>
          {blocked ? (
            <p className="mt-2 text-brand-red">This order status cannot be edited.</p>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="mt-4 text-sm text-brand-red">{error}</p> : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="tile">
            <h2 className="text-lg">Order information</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Customer</p>
                <p className="mt-1 font-medium">{order.customerName}</p>
                <p className="text-muted-foreground">{order.customerEmail}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Payment</p>
                <p className="mt-1 capitalize">{order.paymentMethod || "—"}</p>
                <p className="text-muted-foreground">{order.paymentStatus || "—"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Warehouse</p>
                <p className="mt-1">{warehouseLabel(order.warehouse)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Status</p>
                <div className="mt-2">
                  <OrderStatusSelect id={order.id} status={order.status} onUpdated={() => void reload()} />
                </div>
              </div>
            </div>
            {order.btcInvoice?.checkoutLink ? (
              <a
                className="mt-4 inline-block text-xs uppercase tracking-[0.18em] text-muted-foreground"
                href={order.btcInvoice.checkoutLink}
                target="_blank"
                rel="noreferrer"
              >
                Open BTCPay invoice
              </a>
            ) : null}
          </section>

          <section className="tile">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg">Ship to</h2>
              {editMode && !blocked ? (
                <button
                  type="button"
                  className="ghost-btn"
                  disabled={shippingSaving || !shippingDirty}
                  onClick={() => void saveShipping()}
                >
                  {shippingSaving ? "Saving…" : "Save address"}
                </button>
              ) : null}
            </div>
            {editMode && !blocked ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["customerName", "Customer name"],
                    ["customerEmail", "Email"],
                    ["shippingLine1", "Address line 1"],
                    ["shippingLine2", "Address line 2"],
                    ["shippingCity", "City"],
                    ["shippingState", "State"],
                    ["shippingPostal", "Postal code"],
                    ["shippingCountry", "Country"],
                  ] as const
                ).map(([key, label]) => (
                  <label
                    key={key}
                    className={`grid gap-1 text-xs ${
                      key === "shippingLine1" || key === "shippingLine2" ? "sm:col-span-2" : ""
                    }`}
                  >
                    {label}
                    <input
                      className="field"
                      value={shippingDraft[key]}
                      onChange={(event) =>
                        setShippingDraft((prev) => ({ ...prev, [key]: event.target.value }))
                      }
                    />
                  </label>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                {order.shippingLine1}
                {order.shippingLine2 ? (
                  <>
                    <br />
                    {order.shippingLine2}
                  </>
                ) : null}
                <br />
                {order.shippingCity}, {order.shippingState} {order.shippingPostal}
                <br />
                {order.shippingCountry}
              </p>
            )}
          </section>

          <section className="tile">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg">Items</h2>
              {editMode && !blocked ? (
                <button
                  type="button"
                  className="ghost-btn"
                  disabled={itemsSaving || !itemsDirty}
                  onClick={() => void saveLineItems()}
                >
                  {itemsSaving ? "Saving…" : "Save line items"}
                </button>
              ) : null}
            </div>
            <ul className="mt-3 space-y-3 text-sm">
              {order.items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-3 first:border-0 first:pt-0"
                >
                  <div>
                    <p className="font-medium text-foreground">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.sku || "—"} · {warehouseLabel(item.warehouse)} ·{" "}
                      {formatMoney(item.unitPrice)} each
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {editMode && !blocked ? (
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        Qty
                        <input
                          className="field w-20"
                          type="number"
                          min={0}
                          value={qtyDraft[item.id] ?? item.quantity}
                          onChange={(event) =>
                            setQtyDraft((prev) => ({
                              ...prev,
                              [item.id]: Math.max(0, Number(event.target.value) || 0),
                            }))
                          }
                        />
                      </label>
                    ) : (
                      <span>× {item.quantity}</span>
                    )}
                    <span className="font-medium">{formatMoney(item.lineTotal)}</span>
                  </div>
                </li>
              ))}
            </ul>

            {editMode && !blocked ? (
              <div className="mt-4 border-t border-border/40 pt-4">
                <label className="grid gap-1 text-xs">
                  Add product
                  <input
                    className="field"
                    value={productQuery}
                    onChange={(event) => void searchProducts(event.target.value)}
                    placeholder="Search catalog…"
                  />
                </label>
                {productHits.length > 0 ? (
                  <ul className="mt-2 divide-y divide-border/40 rounded border border-border/50">
                    {productHits.map((product) => (
                      <li key={product.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                        <span>
                          {product.name}
                          <span className="ml-2 text-xs text-muted-foreground">
                            {formatMoney(product.salePrice ?? product.regularPrice)}
                          </span>
                        </span>
                        <button
                          type="button"
                          className="ghost-btn"
                          disabled={addingProduct}
                          onClick={() => void addProduct(product)}
                        >
                          Add
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            <OrderFulfillmentControls
              order={order}
              policy={policy}
              role={role}
              onUpdated={() => void reload()}
            />
          </section>
        </div>

        <div className="space-y-4">
          <section className="tile">
            <h2 className="text-lg">Bitcoin Postage & tracking</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <input
                className="field max-w-xs"
                placeholder="Tracking number"
                value={tracking}
                onChange={(event) => setTracking(event.target.value)}
              />
              <button
                type="button"
                className="ghost-btn"
                onClick={async () => {
                  const response = await fetch(`/api/admin/orders/${order.id}/tracking`, {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ trackingNumber: tracking, carrier: "USPS" }),
                  });
                  if (response.ok) await reload();
                }}
              >
                Save tracking
              </button>
              <button type="button" className="gold-btn" onClick={() => setLabelOpen(true)}>
                Create Bitcoin Postage label
              </button>
            </div>
            {labelError ? <p className="mt-3 text-sm text-brand-red">{labelError}</p> : null}
            <div className="mt-4">
              <ShippingLabelActions
                orderId={order.id}
                labels={order.shippingLabels ?? []}
                onDeleted={(next) => {
                  setLabelError("");
                  setOrder(next);
                  setTracking(next.trackingNumber || "");
                }}
                onError={setLabelError}
              />
            </div>
          </section>
        </div>
      </div>

      {labelOpen ? (
        <PostageLabelModal
          orders={[order]}
          onClose={() => setLabelOpen(false)}
          onCreated={(updated) => {
            const next = updated[0];
            if (!next) return;
            setOrder(next);
            setTracking(next.trackingNumber || "");
            setLabelOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
