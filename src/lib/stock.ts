/** True when the customer may add/buy this qty (backorder allowed, or enough sellable stock). */
export function canPurchaseStock(opts: {
  stockStatus?: string | null;
  allowBackorder?: boolean | null;
  stockQuantity?: number | null;
  quantity?: number;
}): boolean {
  if (opts.allowBackorder) return true;
  const qty = Math.max(1, Number(opts.quantity) || 1);
  const status = String(opts.stockStatus || "")
    .toLowerCase()
    .replace(/[_-\s]/g, "");
  if (status === "outofstock") return false;
  if (opts.stockQuantity != null && Number.isFinite(Number(opts.stockQuantity))) {
    return Number(opts.stockQuantity) >= qty;
  }
  // No quantity on the payload — only allow clear in-stock / backorder statuses.
  return status === "instock" || status === "onbackorder";
}

export function isOutOfStockNoBackorder(opts: {
  stockStatus?: string | null;
  allowBackorder?: boolean | null;
  stockQuantity?: number | null;
}): boolean {
  return !canPurchaseStock({ ...opts, quantity: 1 });
}
