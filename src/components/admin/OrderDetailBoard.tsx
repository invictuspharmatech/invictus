"use client";

import Link from "next/link";
import { useState } from "react";
import { formatMoney } from "@/lib/constants";
import { warehouseLabel } from "@/lib/warehouse";
import { OrderStatusSelect } from "@/components/admin/OrderStatusSelect";
import { OrderFulfillmentControls } from "@/components/admin/OrderFulfillmentControls";
import { PostageLabelModal } from "@/components/admin/PostageLabelModal";
import { ShippingLabelActions } from "@/components/admin/ShippingLabelActions";
import type { ApiOrder, ApiWarehouseSettings } from "@/lib/api-types";

export function OrderDetailBoard({
  initial,
  policy,
  role,
}: {
  initial: ApiOrder;
  policy: ApiWarehouseSettings;
  role: string;
}) {
  const [order, setOrder] = useState(initial);
  const [labelOpen, setLabelOpen] = useState(false);
  const [tracking, setTracking] = useState(initial.trackingNumber || "");
  const [labelError, setLabelError] = useState("");

  async function reload() {
    const response = await fetch(`/api/admin/orders/${order.id}`);
    const next = (await response.json().catch(() => null)) as ApiOrder | { error?: string } | null;
    if (response.ok && next && "orderNumber" in next) {
      setOrder(next);
      setTracking(next.trackingNumber || "");
    }
  }

  return (
    <div>
      <Link href="/admin/orders" className="text-sm text-muted-foreground">
        ← Orders
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="display-font text-3xl">{order.orderNumber}</h1>
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
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <section className="tile">
          <h2 className="text-lg">Status</h2>
          <div className="mt-3">
            <OrderStatusSelect id={order.id} status={order.status} onUpdated={() => void reload()} />
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
          <h2 className="text-lg">Ship to</h2>
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
        </section>
      </div>
      <section className="tile mt-4">
        <h2 className="text-lg">Items</h2>
        <ul className="mt-3 text-sm text-muted-foreground">
          {order.items.map((item) => (
            <li key={item.id}>
              {item.name} × {item.quantity} · {formatMoney(item.lineTotal)} ·{" "}
              {warehouseLabel(item.warehouse)}
            </li>
          ))}
        </ul>
        <OrderFulfillmentControls
          order={order}
          policy={policy}
          role={role}
          onUpdated={() => void reload()}
        />
      </section>
      <section className="tile mt-4">
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
