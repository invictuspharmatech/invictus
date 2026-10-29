"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/site/PageHeader";
import { readReferralCode } from "@/components/shop/ReferralCapture";
import { useCart } from "@/components/shop/CartProvider";
import { BtcPayInvoiceModal } from "@/components/shop/BtcPayInvoiceModal";
import { formatMoney } from "@/lib/constants";
import {
  fetchCheckoutSettings,
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

type CheckoutOrder = {
  id: string;
  orderNumber: string;
  warehouse: string;
  grandTotal: number;
  checkoutLink?: string | null;
  payUrl?: string | null;
};

export default function CheckoutPage() {
  const router = useRouter();
  const { items, merchandiseTotal, clear } = useCart();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);
  const [appliedCoupons, setAppliedCoupons] = useState<AppliedCoupon[]>([]);
  const [stackDiscount, setStackDiscount] = useState(0);
  const [stackFreeShipping, setStackFreeShipping] = useState(false);
  const appliedCodesKey = appliedCoupons.map((row) => row.code).join(",");
  const [settings, setSettings] = useState<CheckoutSettings | null>(null);
  const [optionId, setOptionId] = useState<string | null>(null);
  const [invoiceLink, setInvoiceLink] = useState<string | null>(null);
  const [placedGroup, setPlacedGroup] = useState("");

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
  const shippingTotal = items.length > 0 ? shippingOption.fee : 0;
  const minOrder = settings?.minOrderAmount ?? 100;
  const fees = settings?.shippingFees ?? [];

  const discount = stackDiscount || couponsTotalDiscount(appliedCoupons);
  const chargedShipping =
    stackFreeShipping || couponsFreeShipping(appliedCoupons) ? 0 : shippingTotal;
  const chargedTotal = Math.max(0, merchandiseTotal - discount) + chargedShipping;

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

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") || ""),
      email: String(form.get("email") || ""),
      line1: String(form.get("line1") || ""),
      line2: String(form.get("line2") || ""),
      city: String(form.get("city") || ""),
      state: String(form.get("state") || ""),
      postal: String(form.get("postal") || ""),
      notes: String(form.get("notes") || ""),
      referralCode: readReferralCode(),
      couponCodes: appliedCoupons.map((row) => row.code),
      couponCode: appliedCoupons.map((row) => row.code).join(",") || couponInput.trim(),
      shippingOptionId: shippingOption.id,
      items: items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
    };

    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await response.json()) as {
      error?: string;
      groupId?: string;
      checkoutLink?: string | null;
      orders?: CheckoutOrder[];
    };
    setPending(false);
    if (!response.ok) {
      setError(data.error || "Checkout failed.");
      return;
    }
    const orders = data.orders || [];
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("invictus-checkout-pay", JSON.stringify(orders));
    }
    const checkoutLink = data.checkoutLink || orders.find((order) => order.checkoutLink)?.checkoutLink || null;
    setPlacedGroup(data.groupId || "");
    clear();
    saveCoupons([]);
    if (checkoutLink) {
      setInvoiceLink(checkoutLink);
      return;
    }
    router.push(`/checkout/complete?group=${encodeURIComponent(data.groupId || "")}`);
  }

  const closeInvoice = useCallback(() => {
    const group = placedGroup;
    setInvoiceLink(null);
    router.push(`/checkout/complete?group=${encodeURIComponent(group)}`);
  }, [placedGroup, router]);

  if (invoiceLink) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="display-font text-3xl">Pay with Bitcoin</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Complete the invoice in the popup. Close it when you are finished.
        </p>
        <BtcPayInvoiceModal
          checkoutLink={invoiceLink}
          onClose={closeInvoice}
          footer="Close when finished — you will be taken to your order summary."
        />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="display-font text-3xl">Nothing to check out</h1>
        <a href="/products" className="gold-btn mt-6 inline-flex">
          Shop products
        </a>
      </div>
    );
  }

  const minLabel = minOrder != null ? `${formatMoney(minOrder)} minimum. ` : "";

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
      <PageHeader
        title="Checkout"
        lede={`${minLabel}Bitcoin is the accepted payment method. After you place the order, the BTCPay invoice opens in a popup on this page.`}
      />
      <form onSubmit={onSubmit} className="grid gap-8 lg:grid-cols-2">
        <div className="tile space-y-4">
          <h2 className="text-lg">Shipping</h2>
          <input className="field" name="name" placeholder="Full name" required />
          <input className="field" name="email" type="email" placeholder="Email" required />
          <input className="field" name="line1" placeholder="Address" required />
          <input className="field" name="line2" placeholder="Apartment, suite (optional)" />
          <div className="grid grid-cols-2 gap-3">
            <input className="field" name="city" placeholder="City" required />
            <input className="field" name="state" placeholder="State" required />
          </div>
          <input className="field" name="postal" placeholder="ZIP" required />
          {fees.length > 1 ? (
            <label className="text-sm">
              Shipping method
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
          <textarea className="field min-h-24" name="notes" placeholder="Order notes (optional)" />
        </div>
        <div className="tile">
          <h2 className="text-lg">Order summary</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {items.map((item) => (
              <li key={item.productId} className="flex justify-between gap-3">
                <span>
                  {item.name} × {item.quantity}
                </span>
                <span>{formatMoney(item.unitPrice * item.quantity)}</span>
              </li>
            ))}
          </ul>
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
            </ul>
          ) : null}
          {discount > 0 ? (
            <p className="mt-4 flex justify-between text-sm text-muted-foreground">
              <span>Discount</span>
              <span>−{formatMoney(discount)}</span>
            </p>
          ) : null}
          <p className="mt-4 flex justify-between text-sm text-muted-foreground">
            <span>{fees.length > 1 ? shippingOption.name : "Shipping"}</span>
            <span>{formatMoney(chargedShipping)}</span>
          </p>
          <p className="mt-2 flex justify-between text-sm">
            <span>Total</span>
            <span>{formatMoney(chargedTotal)}</span>
          </p>
          {error ? <p className="mt-3 text-sm text-brand-red">{error}</p> : null}
          <button className="gold-btn mt-6 w-full" type="submit" disabled={pending}>
            {pending ? "Opening Bitcoin payment…" : "Place order and pay with Bitcoin"}
          </button>
        </div>
      </form>
    </div>
  );
}
