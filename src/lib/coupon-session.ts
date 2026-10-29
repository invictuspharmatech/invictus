export type AppliedCoupon = {
  code: string;
  name: string;
  discount: number;
  freeShipping: boolean;
  stackableWithOtherCoupons?: boolean;
};

const COUPON_KEY = "invictus-coupons";
const LEGACY_COUPON_KEY = "invictus-coupon";

export function readSavedCoupons(): AppliedCoupon[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(COUPON_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppliedCoupon[] | AppliedCoupon;
      const list = Array.isArray(parsed) ? parsed : parsed?.code ? [parsed] : [];
      return list
        .filter((row) => row?.code)
        .map((row) => ({
          code: String(row.code).toUpperCase(),
          name: String(row.name || row.code),
          discount: Number(row.discount) || 0,
          freeShipping: Boolean(row.freeShipping),
          stackableWithOtherCoupons: Boolean(row.stackableWithOtherCoupons),
        }));
    }
    // Migrate single-coupon key from earlier cart work.
    const legacy = window.sessionStorage.getItem(LEGACY_COUPON_KEY);
    if (!legacy) return [];
    const one = JSON.parse(legacy) as AppliedCoupon;
    if (!one?.code) return [];
    const migrated = [
      {
        code: String(one.code).toUpperCase(),
        name: String(one.name || one.code),
        discount: Number(one.discount) || 0,
        freeShipping: Boolean(one.freeShipping),
      },
    ];
    saveCoupons(migrated);
    window.sessionStorage.removeItem(LEGACY_COUPON_KEY);
    return migrated;
  } catch {
    return [];
  }
}

/** @deprecated Prefer {@link readSavedCoupons} */
export function readSavedCoupon(): AppliedCoupon | null {
  return readSavedCoupons()[0] ?? null;
}

export function saveCoupons(coupons: AppliedCoupon[]) {
  if (typeof window === "undefined") return;
  if (!coupons.length) {
    window.sessionStorage.removeItem(COUPON_KEY);
    window.sessionStorage.removeItem(LEGACY_COUPON_KEY);
    return;
  }
  window.sessionStorage.setItem(COUPON_KEY, JSON.stringify(coupons));
}

/** @deprecated Prefer {@link saveCoupons} */
export function saveCoupon(coupon: AppliedCoupon | null) {
  saveCoupons(coupon ? [coupon] : []);
}

export function couponsTotalDiscount(coupons: AppliedCoupon[]): number {
  return coupons.reduce((sum, row) => sum + (Number(row.discount) || 0), 0);
}

export function couponsFreeShipping(coupons: AppliedCoupon[]): boolean {
  return coupons.some((row) => row.freeShipping);
}

export async function validateCouponCode(
  code: string,
  merchandiseTotal: number,
  options?: { existingCodes?: string[]; email?: string },
): Promise<
  | {
      ok: true;
      coupon: AppliedCoupon;
      appliedCodes: string[];
      totalDiscount: number;
      freeShipping: boolean;
    }
  | { ok: false; error: string }
> {
  const response = await fetch("/api/coupons/validate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      code,
      merchandiseTotal,
      existingCodes: options?.existingCodes || [],
      email: options?.email || undefined,
    }),
  });
  const data = (await response.json()) as AppliedCoupon & {
    error?: string;
    appliedCodes?: string[];
    totalDiscount?: number;
    stackableWithOtherCoupons?: boolean;
  };
  if (!response.ok) {
    return { ok: false, error: data.error || "This coupon is not valid." };
  }
  return {
    ok: true,
    coupon: {
      code: data.code,
      name: data.name,
      discount: Number(data.discount) || 0,
      freeShipping: Boolean(data.freeShipping),
      stackableWithOtherCoupons: Boolean(data.stackableWithOtherCoupons),
    },
    appliedCodes: Array.isArray(data.appliedCodes) ? data.appliedCodes : [data.code],
    totalDiscount: Number(data.totalDiscount ?? data.discount) || 0,
    freeShipping: Boolean(data.freeShipping),
  };
}
