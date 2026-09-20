"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ApiFulfillmentRequest, ApiProduct, ApiStockTransfer } from "@/lib/api-types";
import { warehouseLabel } from "@/lib/warehouse";
import { isFullAdmin } from "@/lib/roles";

export function TransferBoard({
  stockTransfers,
  fulfillmentRequests,
  products,
  role,
  requestEnabled,
}: {
  stockTransfers: ApiStockTransfer[];
  fulfillmentRequests: ApiFulfillmentRequest[];
  products: ApiProduct[];
  role: string;
  requestEnabled: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const admin = isFullAdmin(role);

  async function review(kind: "stock" | "fulfillment", id: string, action: "approve" | "reject") {
    setError("");
    const path =
      kind === "stock"
        ? `/api/admin/stock-transfers/${id}/review`
        : `/api/admin/fulfillment-requests/${id}/review`;
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      setError(payload?.error || "Could not review request.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-6 space-y-8">
      {requestEnabled ? (
        <form
          className="tile grid gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            const form = new FormData(event.currentTarget);
            const res = await fetch("/api/admin/stock-transfers", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                productId: String(form.get("productId") || ""),
                quantity: Number(form.get("quantity") || 0),
                toWarehouse: admin ? String(form.get("toWarehouse") || "") : undefined,
                note: String(form.get("note") || ""),
              }),
            });
            const payload = (await res.json().catch(() => null)) as { error?: string } | null;
            if (!res.ok) {
              setError(payload?.error || "Could not create request.");
              return;
            }
            event.currentTarget.reset();
            router.refresh();
          }}
        >
          <h2 className="text-lg">Ask the other warehouse for stock</h2>
          <p className="text-sm text-muted-foreground">
            You will not see their quantity. They (or an admin) can accept or reject.
          </p>
          <select className="field" name="productId" required>
            <option value="">Product</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
          <input className="field max-w-32" name="quantity" type="number" min={1} defaultValue={1} required />
          {admin ? (
            <select className="field max-w-56" name="toWarehouse" required>
              <option value="WAREHOUSE_1">Request into Warehouse 1</option>
              <option value="WAREHOUSE_2">Request into Warehouse 2</option>
            </select>
          ) : null}
          <input className="field" name="note" placeholder="Note (optional)" />
          <button className="gold-btn max-w-48" type="submit">
            Send request
          </button>
        </form>
      ) : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <section>
        <h2 className="text-lg">Stock requests</h2>
        <div className="mt-3 space-y-3">
          {stockTransfers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No stock requests.</p>
          ) : (
            stockTransfers.map((row) => (
              <article key={row.id} className="tile text-sm">
                <p>
                  {row.productName} × {row.quantity} · {warehouseLabel(row.fromWarehouse)} →{" "}
                  {warehouseLabel(row.toWarehouse)}
                </p>
                <p className="text-muted-foreground">
                  {row.status} · {row.requestedBy || "staff"}
                </p>
                {row.status === "pending" ? (
                  <div className="mt-3 flex gap-2">
                    <button className="gold-btn" type="button" onClick={() => review("stock", row.id, "approve")}>
                      Accept
                    </button>
                    <button className="ghost-btn" type="button" onClick={() => review("stock", row.id, "reject")}>
                      Reject
                    </button>
                  </div>
                ) : null}
              </article>
            ))
          )}
        </div>
      </section>
      <section>
        <h2 className="text-lg">Order fulfillment requests</h2>
        <div className="mt-3 space-y-3">
          {fulfillmentRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No fulfillment requests.</p>
          ) : (
            fulfillmentRequests.map((row) => (
              <article key={row.id} className="tile text-sm">
                <p>
                  {row.orderNumber}: {row.productName} × {row.quantity} ·{" "}
                  {warehouseLabel(row.fromWarehouse)} → {warehouseLabel(row.toWarehouse)}
                </p>
                <p className="text-muted-foreground">{row.status}</p>
                {row.status === "pending" ? (
                  <div className="mt-3 flex gap-2">
                    <button
                      className="gold-btn"
                      type="button"
                      onClick={() => review("fulfillment", row.id, "approve")}
                    >
                      Accept
                    </button>
                    <button
                      className="ghost-btn"
                      type="button"
                      onClick={() => review("fulfillment", row.id, "reject")}
                    >
                      Reject
                    </button>
                  </div>
                ) : null}
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
