"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/site/PageHeader";
import { StockNotifyButton } from "@/components/shop/StockNotifyButton";
import { useCart } from "@/components/shop/CartProvider";
import { formatMoney } from "@/lib/constants";
import {
  fetchCheckoutSettings,
  orderLimitAmount,
  readSavedShippingOptionId,
  resolveShippingFee,
  saveShippingOptionId,
  type CheckoutSettings,
} from "@/lib/checkout-settings";
import {
  couponsFreeShipping,
  couponsTotalDiscount,
  readSavedCoupons,
  saveCoupons,
  validateCouponCode,
  type AppliedCoupon,
} from "@/lib/coupon-session";

type StockLine = {
  productId: string;
  ok: boolean;
  allowBackorder: boolean;
  stockStatus: string;
  stockQuantity: number;
  maxPurchasable: number | null;
  error?: string | null;
};

export default function CartPage() {
  const { items, merchandiseTotal, updateQuantity, removeItem } = useCart();
  const [settings, setSettings] = useState<CheckoutSettings | null>(null);
  const [optionId, setOptionId] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);
  const [appliedCoupons, setAppliedCoupons] = useState<AppliedCoupon[]>([]);
  const [stackDiscount, setStackDiscount] = useState(0);
  const [stackFreeShipping, setStackFreeShipping] = useState(false);
  const appliedCodesKey = appliedCoupons.map((row) => row.code).join(",");
  const [stockLines, setStockLines] = useState<Record<string, StockLine>>({});
  const [stockReady, setStockReady] = useState(false);

  const refreshStock = useCallback(async () => {
    if (!items.length) {
      setStockLines({});
      setStockReady(true);
      return;
    }
    setStockReady(false);
    const response = await fetch("/api/cart/stock-check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
      }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      lines?: StockLine[];
    };
    const map: Record<string, StockLine> = {};
    for (const line of data.lines || []) {
      map[line.productId] = line;
    }
    setStockLines(map);
    setStockReady(true);
  }, [items]);

  useEffect(() => {
    void fetchCheckoutSettings().then((data) => {
      setSettings(data);
      const saved = readSavedShippingOptionId();
      const resolved = resolveShippingFee(data, saved);
      setOptionId(resolved.id);
      saveShippingOptionId(resolved.id);
    });
    setAppliedCoupons(readSavedCoupons());
  }, []);

  useEffect(() => {
    void refreshStock();
  }, [refreshStock]);

  useEffect(() => {
    if (!appliedCodesKey) {
      setStackDiscount(0);
      setStackFreeShipping(false);
      return;
    }
    let cancelled = false;
    const codes = appliedCodesKey.split(",").filter(Boolean);
    (async () => {
      const kept: AppliedCoupon[] = [];
      let totalDiscount = 0;
      let freeShip = false;
      for (const code of codes) {
        const result = await validateCouponCode(code, merchandiseTotal, {
          existingCodes: kept.map((item) => item.code),
        });
        if (!result.ok) {
          if (!cancelled) {
            setCouponError(result.error);
            setAppliedCoupons(kept);
            saveCoupons(kept);
            setStackDiscount(totalDiscount);
            setStackFreeShipping(freeShip);
          }
          return;
        }
        kept.push(result.coupon);
        totalDiscount = result.totalDiscount;
        freeShip = result.freeShipping;
      }
      if (cancelled) return;
      setStackDiscount(totalDiscount);
      setStackFreeShipping(freeShip);
      setAppliedCoupons(kept);
      saveCoupons(kept);
    })();
    return () => {
      cancelled = true;
    };
  }, [merchandiseTotal, appliedCodesKey]);

  const shippingOption = resolveShippingFee(settings, optionId);
  const shippingEstimate = items.length === 0 ? 0 : shippingOption.fee;
  const chargedShipping = stackFreeShipping || couponsFreeShipping(appliedCoupons) ? 0 : shippingEstimate;
  const discount = stackDiscount || couponsTotalDiscount(appliedCoupons);
  const estimatedTotal = Math.max(0, merchandiseTotal - discount) + chargedShipping;
  const minOrder = settings?.minOrderAmount ?? 100;
  const maxOrder = settings?.maxOrderAmount ?? null;
  const compared = orderLimitAmount(merchandiseTotal, chargedShipping, settings);
  const belowMin = merchandiseTotal > 0 && minOrder != null && compared < minOrder;
  const aboveMax = merchandiseTotal > 0 && maxOrder != null && compared > maxOrder;
  const stockBlocked = items.some((item) => stockLines[item.productId]?.ok === false);
  const blocked = belowMin || aboveMax || stockBlocked || !stockReady;
  const remaining = minOrder != null ? Math.max(0, minOrder - compared) : 0;
  const fees = settings?.shippingFees ?? [];

  const minCopy = useMemo(() => {
    if (!belowMin || minOrder == null) return null;
    return `${formatMoney(minOrder)} minimum order. Add ${formatMoney(remaining)} more.`;
  }, [belowMin, minOrder, remaining]);

  async function applyCoupon() {
    setCouponError(null);
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    if (appliedCoupons.some((row) => row.code === code)) {
      setCouponError("That coupon is already applied.");
      return;
    }
    const result = await validateCouponCode(code, merchandiseTotal, {
      existingCodes: appliedCoupons.map((row) => row.code),
    });
    if (!result.ok) {
      setCouponError(result.error);
      return;
    }
    const next = [...appliedCoupons, result.coupon];
    setAppliedCoupons(next);
    saveCoupons(next);
    setStackDiscount(result.totalDiscount);
    setStackFreeShipping(result.freeShipping);
    setCouponInput("");
  }

  function removeCoupon(code: string) {
    const next = appliedCoupons.filter((row) => row.code !== code);
    setAppliedCoupons(next);
    saveCoupons(next);
    setCouponError(null);
  }

  function clearCoupons() {
    setAppliedCoupons([]);
    saveCoupons([]);
    setCouponInput("");
    setCouponError(null);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
      <PageHeader title="Shopping Cart" />
      {items.length === 0 ? (
        <div className="tile py-16 text-center">
          <h2 className="text-xl">Your cart is empty</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Looks like you haven&apos;t added any products yet.
          </p>
          <Link href="/products" className="gold-btn mt-6 inline-flex">
            Start shopping
          </Link>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1.4fr_0.8fr]">
          <section className="tile">
            <ul className="divide-y divide-border/40">
              {items.map((item) => {
                const stock = stockLines[item.productId];
                const unavailable = stockReady && stock && !stock.ok;
                return (
                  <li key={item.productId} className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <Link href={`/products/${item.slug}`} className="font-medium">
                          {item.name}
                        </Link>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {formatMoney(item.unitPrice)}
                        </p>
                        {unavailable ? (
                          <p className="mt-2 text-sm text-brand-red">
                            {stock.error || "Not enough stock for this quantity."}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          className="field w-16"
                          type="number"
                          min={1}
                          max={
                            stock?.maxPurchasable != null && stock.maxPurchasable > 0
                              ? stock.maxPurchasable
                              : undefined
                          }
                          value={item.quantity}
                          onChange={(event) =>
                            updateQuantity(item.productId, Number(event.target.value) || 1)
                          }
                        />
                        <button
                          type="button"
                          className="text-xs uppercase tracking-[0.14em] text-muted-foreground"
                          onClick={() => removeItem(item.productId)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    {unavailable && !stock.allowBackorder ? (
                      <StockNotifyButton
                        productId={item.productId}
                        variant="compact"
                        className="mt-3"
                        outOfStock
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
          <aside className="tile h-fit">
            <h2 className="text-lg">Summary</h2>
            {fees.length > 1 ? (
              <label className="mt-4 block text-sm">
                Shipping
                <select
                  className="field mt-1"
                  value={shippingOption.id}
                  onChange={(event) => {
                    setOptionId(event.target.value);
                    saveShippingOptionId(event.target.value);
                  }}
                >
                  {fees.map((fee) => (
                    <option key={fee.id} value={fee.id}>
                      {fee.name} · {formatMoney(fee.fee)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="mt-4 flex gap-2">
              <input
                className="field flex-1 uppercase"
                value={couponInput}
                onChange={(event) => setCouponInput(event.target.value)}
                placeholder="Coupon code"
                autoComplete="off"
              />
              <button className="ghost-btn" type="button" onClick={() => void applyCoupon()}>
                Apply
              </button>
            </div>
            {couponError ? <p className="mt-2 text-sm text-brand-red">{couponError}</p> : null}
            {appliedCoupons.length ? (
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {appliedCoupons.map((row) => (
                  <li key={row.code} className="flex flex-wrap items-center gap-2">
                    <span>
                      {row.code} · {row.name}
                      {row.freeShipping ? " · free shipping" : ""}
                    </span>
                    <button type="button" className="underline" onClick={() => removeCoupon(row.code)}>
                      Remove
                    </button>
                  </li>
                ))}
                {appliedCoupons.length > 1 ? (
                  <li>
                    <button type="button" className="underline" onClick={clearCoupons}>
                      Remove all coupons
                    </button>
                  </li>
                ) : null}
              </ul>
            ) : null}
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt>Merchandise</dt>
                <dd>{formatMoney(merchandiseTotal)}</dd>
              </div>
              {discount > 0 ? (
                <div className="flex justify-between text-muted-foreground">
                  <dt>Discount</dt>
                  <dd>−{formatMoney(discount)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt>{fees.length > 1 ? shippingOption.name : "Shipping"}</dt>
                <dd>{formatMoney(chargedShipping)}</dd>
              </div>
              <div className="flex justify-between border-t border-border/40 pt-3 font-medium">
                <dt>Estimated total</dt>
                <dd>{formatMoney(estimatedTotal)}</dd>
              </div>
            </dl>
            {minCopy ? <p className="mt-4 text-sm text-signal">{minCopy}</p> : null}
            {aboveMax && maxOrder != null ? (
              <p className="mt-4 text-sm text-signal">{formatMoney(maxOrder)} maximum order.</p>
            ) : null}
            {stockBlocked ? (
              <p className="mt-4 text-sm text-brand-red">
                Some items are out of stock or over available quantity. Update or remove them
                before checkout.
              </p>
            ) : null}
            <Link
              href="/checkout"
              className={`gold-btn mt-6 w-full ${blocked ? "pointer-events-none opacity-40" : ""}`}
              aria-disabled={blocked}
              onClick={(event) => {
                if (blocked) event.preventDefault();
              }}
            >
              Checkout
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}
