"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { PageHeader } from "@/components/site/PageHeader";
import { StockNotifyButton } from "@/components/shop/StockNotifyButton";
import { useCart } from "@/components/shop/CartProvider";
import { formatMoney, mediaUrl } from "@/lib/constants";
import {
  fetchCheckoutSettings,
  orderLimitAmount,
  readSavedShippingOptionId,
  resolveShippingFee,
  saveShippingOptionId,
  type CheckoutSettings,
} from "@/lib/checkout-settings";
import {
  couponsCoverShipping,
  couponsFreeShipping,
  couponsTotalDiscount,
  estimateChargedTotal,
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
  const [stackCoversShipping, setStackCoversShipping] = useState(false);
  const appliedCodesKey = appliedCoupons.map((row) => row.code).join(",");
  const [stockLines, setStockLines] = useState<Record<string, StockLine>>({});
  const [stockReady, setStockReady] = useState(false);

  const shippingOption = resolveShippingFee(settings, optionId);
  const shippingEstimate = items.length === 0 ? 0 : shippingOption.fee;

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
      setStackCoversShipping(false);
      return;
    }
    let cancelled = false;
    const codes = appliedCodesKey.split(",").filter(Boolean);
    (async () => {
      const kept: AppliedCoupon[] = [];
      let totalDiscount = 0;
      let freeShip = false;
      let coversShip = false;
      for (const code of codes) {
        const result = await validateCouponCode(code, merchandiseTotal, {
          existingCodes: kept.map((item) => item.code),
          shippingTotal: shippingEstimate,
        });
        if (!result.ok) {
          if (!cancelled) {
            setCouponError(result.error);
            setAppliedCoupons(kept);
            saveCoupons(kept);
            setStackDiscount(totalDiscount);
            setStackFreeShipping(freeShip);
            setStackCoversShipping(coversShip);
          }
          return;
        }
        kept.push(result.coupon);
        totalDiscount = result.totalDiscount;
        freeShip = result.freeShipping;
        coversShip = result.discountCoversShipping;
      }
      if (cancelled) return;
      setStackDiscount(totalDiscount);
      setStackFreeShipping(freeShip);
      setStackCoversShipping(coversShip);
      setAppliedCoupons(kept);
      saveCoupons(kept);
    })();
    return () => {
      cancelled = true;
    };
  }, [merchandiseTotal, appliedCodesKey, shippingEstimate]);

  const freeShipping = stackFreeShipping || couponsFreeShipping(appliedCoupons);
  const chargedShipping = freeShipping ? 0 : shippingEstimate;
  const discount = stackDiscount || couponsTotalDiscount(appliedCoupons);
  const coversShipping = stackCoversShipping || couponsCoverShipping(appliedCoupons);
  const estimatedTotal = estimateChargedTotal(merchandiseTotal, shippingEstimate, discount, {
    freeShipping,
    coversShipping,
  });
  const checkoutEnabled = settings?.checkoutEnabled === true;
  const minOrder = settings?.minOrderAmount ?? 100;
  const maxOrder = settings?.maxOrderAmount ?? null;
  const compared = orderLimitAmount(merchandiseTotal, chargedShipping, settings);
  const belowMin = merchandiseTotal > 0 && minOrder != null && compared < minOrder;
  const aboveMax = merchandiseTotal > 0 && maxOrder != null && compared > maxOrder;
  const stockBlocked = items.some((item) => stockLines[item.productId]?.ok === false);
  const blocked = !checkoutEnabled || belowMin || aboveMax || stockBlocked || !stockReady;
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
      shippingTotal: shippingEstimate,
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
    setStackCoversShipping(result.discountCoversShipping);
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

  function quantityControls(item: (typeof items)[number]) {
    const stock = stockLines[item.productId];
    const maxQty =
      stock?.maxPurchasable != null && stock.maxPurchasable > 0 ? stock.maxPurchasable : null;
    const atMin = item.quantity <= 1;
    const atMax = maxQty != null && item.quantity >= maxQty;
    const setQty = (next: number) => {
      let qty = Math.max(1, Math.floor(Number(next) || 1));
      if (maxQty != null) qty = Math.min(qty, maxQty);
      updateQuantity(item.productId, qty);
    };
    const btnClass =
      "inline-flex h-full w-11 shrink-0 cursor-pointer items-center justify-center border-0 bg-[#3a1414] text-xl font-bold leading-none text-[#e8c56a] transition hover:bg-[#4a1c1c] disabled:cursor-not-allowed disabled:opacity-40";
    return (
      <div className="inline-flex h-11 shrink-0 items-stretch overflow-hidden rounded-md border border-[#6b3220] bg-[#16080a]">
        <button
          type="button"
          className={btnClass}
          aria-label={`Decrease quantity for ${item.name}`}
          disabled={atMin}
          onClick={() => setQty(item.quantity - 1)}
        >
          -
        </button>
        <input
          className="h-full w-14 shrink-0 border-0 border-x border-[#6b3220] bg-[#080203] px-1 text-center text-base font-semibold text-[#e8c56a] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          type="number"
          inputMode="numeric"
          min={1}
          max={maxQty ?? undefined}
          value={item.quantity}
          aria-label={`Quantity for ${item.name}`}
          onChange={(event) => setQty(Number(event.target.value))}
        />
        <button
          type="button"
          className={btnClass}
          aria-label={`Increase quantity for ${item.name}`}
          disabled={atMax}
          onClick={() => setQty(item.quantity + 1)}
        >
          +
        </button>
      </div>
    );
  }

  function productThumb(item: (typeof items)[number], size: "sm" | "md" = "md") {
    const src = mediaUrl(item.image);
    const box = size === "sm" ? "h-16 w-16 sm:h-20 sm:w-20" : "h-20 w-20";
    if (!src) {
      return (
        <div
          className={`flex ${box} shrink-0 items-center justify-center rounded bg-muted/40 text-[10px] text-muted-foreground`}
        >
          No image
        </div>
      );
    }
    return (
      <div className={`relative ${box} shrink-0 overflow-hidden rounded`}>
        <Image src={src} alt={item.name} fill className="object-cover" sizes="80px" unoptimized />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
      <PageHeader title="Shopping Cart" />
      {items.length === 0 ? (
        <div className="tile py-16 text-center">
          <h2 className="text-xl">Your cart is empty</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Looks like you haven&apos;t added any products yet.
          </p>
          <Link href="/products" className="gold-btn mt-6 inline-flex">
            Continue shopping
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <section className="tile overflow-hidden p-0">
              {/* Mobile: stacked cards so price, qty, and line total do not overlap */}
              <div className="divide-y divide-border/40 md:hidden">
                {items.map((item) => {
                  const stock = stockLines[item.productId];
                  const unavailable = stockReady && stock && !stock.ok;
                  const lineTotal = item.unitPrice * item.quantity;
                  return (
                    <div key={item.productId} className="px-4 py-4 sm:px-5">
                      <div className="flex items-start gap-3">
                        <Link href={`/products/${item.slug}`} className="shrink-0">
                          {productThumb(item, "sm")}
                        </Link>
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/products/${item.slug}`}
                            className="break-words text-sm font-semibold leading-snug sm:text-base"
                          >
                            {item.name}
                          </Link>
                          {unavailable ? (
                            <p className="mt-2 text-sm text-brand-red">
                              {stock.error || "Not enough stock for this quantity."}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-1 gap-4 border-t border-border/40 pt-4 sm:grid-cols-2">
                        <div className="flex items-center justify-between gap-3 sm:block sm:space-y-1">
                          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Price
                          </span>
                          <span className="font-medium tabular-nums">
                            {formatMoney(item.unitPrice)}
                          </span>
                        </div>
                        <div className="flex flex-col gap-2 sm:items-start">
                          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Quantity
                          </span>
                          {quantityControls(item)}
                          <button
                            type="button"
                            className="mt-1 text-left text-sm font-medium text-brand-red underline-offset-2 hover:underline"
                            onClick={() => removeItem(item.productId)}
                          >
                            Remove
                          </button>
                        </div>
                        <div className="flex items-center justify-between gap-3 border-t border-border/40 pt-3 sm:col-span-2">
                          <span className="text-sm font-medium text-muted-foreground">Line total</span>
                          <span className="text-base font-semibold tabular-nums text-signal">
                            {formatMoney(lineTotal)}
                          </span>
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
                    </div>
                  );
                })}
              </div>

              {/* md+: table layout */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[640px] table-auto">
                  <thead className="bg-muted/20 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="min-w-0 px-4 py-3 sm:px-6">Product</th>
                      <th className="whitespace-nowrap px-3 py-3 text-right sm:px-4">Price</th>
                      <th className="whitespace-nowrap px-3 py-3 sm:px-4">Quantity</th>
                      <th className="whitespace-nowrap px-3 py-3 text-right sm:px-4">Subtotal</th>
                      <th className="whitespace-nowrap px-3 py-3 text-right sm:px-4">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {items.map((item) => {
                      const stock = stockLines[item.productId];
                      const unavailable = stockReady && stock && !stock.ok;
                      const lineTotal = item.unitPrice * item.quantity;
                      return (
                        <tr key={item.productId}>
                          <td className="min-w-0 max-w-md px-4 py-4 align-top sm:px-6">
                            <div className="flex items-start gap-3 sm:gap-4">
                              <Link href={`/products/${item.slug}`} className="shrink-0">
                                {productThumb(item, "md")}
                              </Link>
                              <div className="min-w-0 flex-1">
                                <Link
                                  href={`/products/${item.slug}`}
                                  className="break-words text-base font-semibold leading-snug"
                                >
                                  {item.name}
                                </Link>
                                {unavailable ? (
                                  <p className="mt-2 text-sm text-brand-red">
                                    {stock.error || "Not enough stock for this quantity."}
                                  </p>
                                ) : null}
                                {unavailable && !stock.allowBackorder ? (
                                  <StockNotifyButton
                                    productId={item.productId}
                                    variant="compact"
                                    className="mt-3"
                                    outOfStock
                                  />
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-right align-top tabular-nums sm:px-4">
                            <span className="font-medium">{formatMoney(item.unitPrice)}</span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 align-top sm:px-4">
                            {quantityControls(item)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-right align-top tabular-nums sm:px-4">
                            <span className="font-semibold text-signal">{formatMoney(lineTotal)}</span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-right align-top sm:px-4">
                            <button
                              type="button"
                              className="ghost-btn text-sm"
                              aria-label={`Remove ${item.name} from cart`}
                              onClick={() => removeItem(item.productId)}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="tile">
              <h3 className="text-lg font-semibold">Coupon</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter a coupon code. Applied discounts show in cart totals.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 sm:flex-nowrap">
                <input
                  className="field min-w-0 flex-1 uppercase"
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
                <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                  {appliedCoupons.map((row) => (
                    <li key={row.code} className="flex flex-wrap items-center gap-2">
                      <span>
                        {row.code} · {row.name}
                        {row.freeShipping ? " · free shipping" : ""}
                      </span>
                      <button
                        type="button"
                        className="underline"
                        onClick={() => removeCoupon(row.code)}
                      >
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
            </section>
          </div>

          <aside className="tile h-fit lg:sticky lg:top-4">
            <h2 className="text-xl font-semibold">Cart totals</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt>Subtotal</dt>
                <dd className="font-semibold tabular-nums">{formatMoney(merchandiseTotal)}</dd>
              </div>
              {discount > 0 ? (
                <div className="flex items-baseline justify-between gap-3 text-muted-foreground">
                  <dt>Discount</dt>
                  <dd className="font-semibold tabular-nums">−{formatMoney(discount)}</dd>
                </div>
              ) : null}
              <div className="border-t border-border/40 pt-3">
                <div className="mb-2 font-medium">Shipping</div>
                {fees.length > 1 ? (
                  <div className="space-y-2">
                    {fees.map((fee) => (
                      <label
                        key={fee.id}
                        className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                          shippingOption.id === fee.id
                            ? "border-border bg-muted/30"
                            : "border-border/40 hover:bg-muted/15"
                        }`}
                      >
                        <input
                          type="radio"
                          name="shipping-option"
                          className="mt-1"
                          checked={shippingOption.id === fee.id}
                          onChange={() => {
                            setOptionId(fee.id);
                            saveShippingOptionId(fee.id);
                          }}
                        />
                        <span className="flex-1">
                          {fee.name}{" "}
                          <span className="font-semibold tabular-nums">{formatMoney(fee.fee)}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-baseline justify-between gap-3">
                    <span>{shippingOption.name || "Shipping"}</span>
                    <span className="font-semibold tabular-nums">{formatMoney(chargedShipping)}</span>
                  </div>
                )}
              </div>
              <div className="flex items-baseline justify-between gap-3 border-t border-border/40 pt-3 text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums text-signal">{formatMoney(estimatedTotal)}</dd>
              </div>
            </dl>
            {settings && !checkoutEnabled ? (
              <p className="mt-4 text-sm text-signal">
                Checkout is temporarily closed. Please check back soon.
              </p>
            ) : null}
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
              Proceed to checkout
            </Link>
            <Link
              href="/products"
              className="mt-3 block text-center text-sm font-medium text-muted-foreground underline-offset-2 hover:underline"
            >
              Continue shopping
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}
