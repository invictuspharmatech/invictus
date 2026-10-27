"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { formatMoney } from "@/lib/constants";
import { warehouseLabel } from "@/lib/warehouse";
import type { ApiOrder, ApiProduct } from "@/lib/api-types";

export function OrderItemsQuickEdit({
  order,
  onCancel,
  onSaved,
}: {
  order: ApiOrder;
  onCancel: () => void;
  onSaved: (next: ApiOrder) => void;
}) {
  const [liveOrder, setLiveOrder] = useState(order);
  const [qty, setQty] = useState<Record<string, number>>(() =>
    Object.fromEntries(order.items.map((item) => [item.id, item.quantity])),
  );
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [productHits, setProductHits] = useState<ApiProduct[]>([]);

  useEffect(() => {
    setLiveOrder(order);
    setQty(Object.fromEntries(order.items.map((item) => [item.id, item.quantity])));
    setError("");
    setProductQuery("");
    setProductHits([]);
  }, [order]);

  const dirty = useMemo(
    () => liveOrder.items.some((item) => (qty[item.id] ?? item.quantity) !== item.quantity),
    [liveOrder.items, qty],
  );

  function applyOrder(next: ApiOrder) {
    setLiveOrder(next);
    setQty(Object.fromEntries(next.items.map((item) => [item.id, item.quantity])));
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
    if (adding) return;
    setAdding(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/orders/${liveOrder.id}/add-item`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId: product.id, quantity: 1 }),
      });
      const data = (await res.json().catch(() => ({}))) as ApiOrder & { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not add product.");
        return;
      }
      applyOrder(data);
      setProductQuery("");
      setProductHits([]);
    } finally {
      setAdding(false);
    }
  }

  function removeItem(itemId: string) {
    setQty((prev) => ({ ...prev, [itemId]: 0 }));
  }

  async function save() {
    if (!dirty) return;
    const nextItems = liveOrder.items.map((item) => ({
      id: item.id,
      quantity: Math.max(0, Number(qty[item.id] ?? item.quantity) || 0),
    }));
    if (!nextItems.some((row) => row.quantity > 0)) {
      setError("The order must keep at least one line item.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/orders/${liveOrder.id}/line-items`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: nextItems }),
      });
      const data = (await res.json().catch(() => ({}))) as ApiOrder & { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not update line items.");
        return;
      }
      onSaved(data);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-t border-border/40 bg-muted/20 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">
          Quick edit items · {liveOrder.orderNumber}
        </p>
        <div className="flex gap-2">
          <button type="button" className="ghost-btn" onClick={onCancel} disabled={saving || adding}>
            Cancel
          </button>
          <button
            type="button"
            className="gold-btn"
            disabled={saving || (!dirty && liveOrder.items.length === order.items.length && liveOrder.items.every((item, i) => item.id === order.items[i]?.id && item.quantity === order.items[i]?.quantity))}
            onClick={() => {
              if (dirty) {
                void save();
                return;
              }
              onSaved(liveOrder);
            }}
          >
            {saving ? "Saving…" : dirty ? "Save items" : "Done"}
          </button>
        </div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Change quantities, remove lines, or add a product from the catalog. Stock updates when you
        save or add.
      </p>
      {error ? <p className="mt-2 text-sm text-brand-red">{error}</p> : null}

      <ul className="mt-3 space-y-2">
        {liveOrder.items.map((item) => {
          const draftQty = qty[item.id] ?? item.quantity;
          const markedRemove = draftQty === 0;
          return (
            <li
              key={item.id}
              className={`flex flex-wrap items-center justify-between gap-3 border-t border-border/30 pt-2 first:border-0 first:pt-0 ${
                markedRemove ? "opacity-50" : ""
              }`}
            >
              <div className="min-w-0">
                <p className="font-medium text-foreground">
                  {item.name}
                  {markedRemove ? (
                    <span className="ml-2 text-xs font-normal text-brand-red">will be removed</span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.sku || "—"} · {warehouseLabel(item.warehouse)} ·{" "}
                  {formatMoney(item.unitPrice)} each
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  Qty
                  <input
                    className="field w-20"
                    type="number"
                    min={0}
                    disabled={saving}
                    value={draftQty}
                    onChange={(event) =>
                      setQty((prev) => ({
                        ...prev,
                        [item.id]: Math.max(0, Number(event.target.value) || 0),
                      }))
                    }
                  />
                </label>
                <span className="min-w-16 text-right text-sm font-medium">
                  {formatMoney(item.unitPrice * draftQty)}
                </span>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded border border-border text-brand-red hover:bg-brand-red/15 disabled:opacity-40"
                  title="Remove item"
                  disabled={saving}
                  onClick={() => removeItem(item.id)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 border-t border-border/40 pt-4">
        <label className="grid gap-1 text-xs">
          Add product
          <input
            className="field max-w-md"
            value={productQuery}
            disabled={adding}
            onChange={(event) => void searchProducts(event.target.value)}
            placeholder="Search catalog by name or SKU…"
          />
        </label>
        {productHits.length > 0 ? (
          <ul className="mt-2 max-w-xl divide-y divide-border/40 rounded border border-border/50">
            {productHits.map((product) => (
              <li
                key={product.id}
                className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
              >
                <span>
                  {product.name}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {formatMoney(product.salePrice ?? product.regularPrice)}
                  </span>
                </span>
                <button
                  type="button"
                  className="ghost-btn"
                  disabled={adding}
                  onClick={() => void addProduct(product)}
                >
                  {adding ? "Adding…" : "Add"}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
