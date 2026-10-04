"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CouponType } from "@/lib/enums";
import { asCouponType, toDatetimeLocal } from "@/lib/coupons";
import type { ApiCoupon } from "@/lib/api-types";

function amountLabel(type: CouponType): string {
  switch (type) {
    case CouponType.PERCENT:
      return "Percent off";
    case CouponType.FIXED:
      return "Amount off ($)";
    case CouponType.FREE_SHIPPING:
      return "Amount";
    default: {
      const exhaustive: never = type;
      return exhaustive;
    }
  }
}

export function CouponForm({ coupon }: { coupon?: ApiCoupon }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [discountType, setDiscountType] = useState<CouponType>(
    asCouponType(coupon?.discountType || CouponType.PERCENT),
  );

  return (
    <form
      className="mt-6 grid max-w-xl gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        const form = new FormData(event.currentTarget);
        const payload = {
          code: String(form.get("code") || ""),
          name: String(form.get("name") || ""),
          discountType,
          amount: Number(form.get("amount") || 0),
          minimumAmount: Number(form.get("minimumAmount") || 0),
          usageLimit: String(form.get("usageLimit") || "").trim() || null,
          startsAt: String(form.get("startsAt") || "").trim() || null,
          expiresAt: String(form.get("expiresAt") || "").trim() || null,
          isActive: form.get("isActive") === "on",
        };
        const res = await fetch(
          coupon ? `/api/admin/coupons/${coupon.id}` : "/api/admin/coupons",
          {
            method: coupon ? "PUT" : "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(
            data && typeof data === "object" && "error" in data
              ? String(data.error)
              : "Could not save coupon.",
          );
          return;
        }
        router.push("/admin/promotions/coupons");
        router.refresh();
      }}
    >
      {error ? <p className="text-sm text-brand-red">{error}</p> : null}
      <label className="grid gap-1 text-sm">
        Code
        <input
          className="field uppercase"
          name="code"
          defaultValue={coupon?.code}
          required
          placeholder="SAVE10"
        />
      </label>
      <label className="grid gap-1 text-sm">
        Name
        <input className="field" name="name" defaultValue={coupon?.name} required />
      </label>
      <label className="grid gap-1 text-sm">
        Type
        <select
          className="field"
          name="discountType"
          value={discountType}
          onChange={(event) => setDiscountType(asCouponType(event.target.value))}
        >
          <option value={CouponType.PERCENT}>Percent off</option>
          <option value={CouponType.FIXED}>Fixed amount</option>
          <option value={CouponType.FREE_SHIPPING}>Free shipping</option>
        </select>
      </label>
      {discountType === CouponType.FREE_SHIPPING ? null : (
        <label className="grid gap-1 text-sm">
          {amountLabel(discountType)}
          <input
            className="field"
            name="amount"
            type="number"
            min={0}
            max={discountType === CouponType.PERCENT ? 100 : undefined}
            step="0.01"
            defaultValue={coupon?.amount ?? 0}
            required
          />
        </label>
      )}
      <label className="grid gap-1 text-sm">
        Minimum merchandise ($)
        <input
          className="field"
          name="minimumAmount"
          type="number"
          min={0}
          step="0.01"
          defaultValue={coupon?.minimumAmount ?? 0}
        />
      </label>
      <label className="grid gap-1 text-sm">
        Usage limit
        <input
          className="field"
          name="usageLimit"
          type="number"
          min={1}
          defaultValue={coupon?.usageLimit ?? ""}
          placeholder="Unlimited"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          Starts
          <input
            className="field"
            name="startsAt"
            type="datetime-local"
            defaultValue={toDatetimeLocal(coupon?.startsAt)}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Expires
          <input
            className="field"
            name="expiresAt"
            type="datetime-local"
            defaultValue={toDatetimeLocal(coupon?.expiresAt)}
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={coupon?.isActive ?? true} />
        Active
      </label>
      {coupon ? (
        <p className="text-sm text-muted-foreground">Used {coupon.usedCount} time(s).</p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button className="gold-btn w-fit" type="submit">
          {coupon ? "Save coupon" : "Create coupon"}
        </button>
        {coupon ? (
          <button
            className="ghost-btn"
            type="button"
            onClick={async () => {
              if (!window.confirm(`Delete coupon ${coupon.code}?`)) return;
              const res = await fetch(`/api/admin/coupons/${coupon.id}`, { method: "DELETE" });
              if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setError(
                  data && typeof data === "object" && "error" in data
                    ? String(data.error)
                    : "Could not delete coupon.",
                );
                return;
              }
              router.push("/admin/promotions/coupons");
              router.refresh();
            }}
          >
            Delete
          </button>
        ) : null}
      </div>
    </form>
  );
}
