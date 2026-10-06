"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { ApiProduct } from "@/lib/api-types";

type Props = {
  product: ApiProduct;
  onCancel: () => void;
  onSaved: (updated: ApiProduct) => void;
};

function parseMoney(value: string, emptyAsNull = false): number | null | "invalid" {
  const trimmed = value.trim();
  if (trimmed === "") return emptyAsNull ? null : "invalid";
  const parsed = Number(trimmed);
  if (Number.isNaN(parsed) || parsed < 0) return "invalid";
  return parsed;
}

export function ProductQuickEditPanel({ product, onCancel, onSaved }: Props) {
  const canEditW1 = typeof product.stockQuantityW1 === "number";
  const canEditW2 = typeof product.stockQuantityW2 === "number";
  const [name, setName] = useState(product.name);
  const [regularPrice, setRegularPrice] = useState(String(product.regularPrice ?? ""));
  const [salePrice, setSalePrice] = useState(
    product.salePrice != null ? String(product.salePrice) : "",
  );
  const [w1, setW1] = useState(String(product.stockQuantityW1 ?? 0));
  const [w2, setW2] = useState(String(product.stockQuantityW2 ?? 0));
  const [allowBackorder, setAllowBackorder] = useState(product.allowBackorder);
  const [limitQty, setLimitQty] = useState(product.maxQuantityPerOrder != null);
  const [maxQty, setMaxQty] = useState(
    Math.max(1, Number(product.maxQuantityPerOrder ?? 1) || 1),
  );
  const [isFeatured, setIsFeatured] = useState(product.isFeatured);
  const [isNewArrival, setIsNewArrival] = useState(product.isNewArrival);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setName(product.name);
    setRegularPrice(String(product.regularPrice ?? ""));
    setSalePrice(product.salePrice != null ? String(product.salePrice) : "");
    setW1(String(product.stockQuantityW1 ?? 0));
    setW2(String(product.stockQuantityW2 ?? 0));
    setAllowBackorder(product.allowBackorder);
    setLimitQty(product.maxQuantityPerOrder != null);
    setMaxQty(Math.max(1, Number(product.maxQuantityPerOrder ?? 1) || 1));
    setIsFeatured(product.isFeatured);
    setIsNewArrival(product.isNewArrival);
    setError("");
  }, [product]);

  const draftW1 = canEditW1 ? Math.max(0, parseInt(w1, 10) || 0) : null;
  const draftW2 = canEditW2 ? Math.max(0, parseInt(w2, 10) || 0) : null;
  const draftTotal =
    (draftW1 ?? product.stockQuantityW1 ?? 0) + (draftW2 ?? product.stockQuantityW2 ?? 0);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required.");
      return;
    }
    const regular = parseMoney(regularPrice);
    if (regular === "invalid" || regular == null) {
      setError("Enter a valid regular price.");
      return;
    }
    const sale = parseMoney(salePrice, true);
    if (sale === "invalid") {
      setError("Enter a valid sale price or leave it empty to clear.");
      return;
    }

    const payload: Record<string, unknown> = {
      name: trimmed,
      regularPrice: regular,
      salePrice: sale,
      allowBackorder,
      isFeatured,
      isNewArrival,
      maxQuantityPerOrder: limitQty ? Math.max(1, Number(maxQty) || 1) : null,
    };
    if (canEditW1) payload.stockQuantityW1 = Math.max(0, parseInt(w1, 10) || 0);
    if (canEditW2) payload.stockQuantityW2 = Math.max(0, parseInt(w2, 10) || 0);

    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as ApiProduct & { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not save product.");
        return;
      }
      onSaved(data);
    } catch {
      setError("Could not save product.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="max-w-3xl bg-card/80 p-4">
      <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs sm:col-span-2">
          Product name
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="grid gap-1 text-xs">
          Price
          <input
            className="field"
            type="number"
            step="0.01"
            min={0}
            value={regularPrice}
            onChange={(e) => setRegularPrice(e.target.value)}
          />
        </label>
        <label className="grid gap-1 text-xs">
          Sale price
          <input
            className="field"
            type="number"
            step="0.01"
            min={0}
            placeholder="Clear"
            value={salePrice}
            onChange={(e) => setSalePrice(e.target.value)}
          />
        </label>
        {canEditW1 ? (
          <label className="grid gap-1 text-xs">
            Warehouse 1 qty
            <input
              className="field"
              type="number"
              min={0}
              value={w1}
              onChange={(e) => setW1(e.target.value)}
            />
          </label>
        ) : null}
        {canEditW2 ? (
          <label className="grid gap-1 text-xs">
            Warehouse 2 qty
            <input
              className="field"
              type="number"
              min={0}
              value={w2}
              onChange={(e) => setW2(e.target.value)}
            />
          </label>
        ) : null}
        {canEditW1 || canEditW2 ? (
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Quantity total: <strong className="text-foreground">{draftTotal}</strong>
          </p>
        ) : null}
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={allowBackorder}
            onChange={(e) => setAllowBackorder(e.target.checked)}
          />
          Allow backorder
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={limitQty}
            onChange={(e) => setLimitQty(e.target.checked)}
          />
          Limit per order
        </label>
        {limitQty ? (
          <label className="grid gap-1 text-xs">
            Max qty
            <input
              className="field"
              type="number"
              min={1}
              value={maxQty}
              onChange={(e) => setMaxQty(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>
        ) : null}
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={isFeatured}
            onChange={(e) => setIsFeatured(e.target.checked)}
          />
          Featured
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={isNewArrival}
            onChange={(e) => setIsNewArrival(e.target.checked)}
          />
          New arrival
        </label>
      </div>

      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}

      <div className="mt-4 flex items-center gap-2">
        <button type="button" className="ghost-btn" onClick={onCancel} disabled={saving}>
          Close
        </button>
        <button className="gold-btn" type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
