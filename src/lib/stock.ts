/**
 * Stock display rules aligned with GreatLife (`productStock.ts`):
 * - out of stock (and not backorder) → hide add, show notify
 * - backorder allowed → treat as purchasable (no OOS / notify)
 * - in stock with qty 0 → same as OOS
 */

export type StockProductFields = {
  stockStatus?: string | null;
  allowBackorder?: boolean | null;
  stockQuantity?: number | null;
};

function normalizeStatus(stockStatus?: string | null): string {
  return String(stockStatus || "")
    .toLowerCase()
    .replace(/[_-\s]/g, "");
}

/** GreatLife `productShowsAddToCart` — Invictus maps backorder flag → purchasable. */
export function productShowsAddToCart(product: StockProductFields): boolean {
  if (product.allowBackorder) return true;
  const status = normalizeStatus(product.stockStatus);
  if (status === "outofstock") return false;
  if (status === "instock") {
    return Math.max(0, Number(product.stockQuantity ?? 0)) > 0;
  }
  // onbackorder / other non-OOS statuses remain purchasable
  if (status === "onbackorder") return true;
  if (product.stockQuantity != null && Number.isFinite(Number(product.stockQuantity))) {
    return Number(product.stockQuantity) > 0;
  }
  return status !== "outofstock";
}

/** GreatLife `productShowsStockNotify` — show notify when the customer can’t buy. */
export function productShowsStockNotify(product: StockProductFields): boolean {
  return !productShowsAddToCart(product);
}

/** @deprecated Prefer {@link productShowsAddToCart} */
export function canPurchaseStock(
  opts: StockProductFields & { quantity?: number },
): boolean {
  if (!productShowsAddToCart(opts)) return false;
  if (opts.allowBackorder) return true;
  const qty = Math.max(1, Number(opts.quantity) || 1);
  if (opts.stockQuantity != null && Number.isFinite(Number(opts.stockQuantity))) {
    return Number(opts.stockQuantity) >= qty;
  }
  return true;
}

/** @deprecated Prefer {@link productShowsStockNotify} */
export function isOutOfStockNoBackorder(opts: StockProductFields): boolean {
  return productShowsStockNotify(opts);
}
