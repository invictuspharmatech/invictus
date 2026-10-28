export type AppliedCoupon = {
  code: string;
  name: string;
  discount: number;
  freeShipping: boolean;
};

const COUPON_KEY = "invictus-coupon";

export function readSavedCoupon(): AppliedCoupon | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(COUPON_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppliedCoupon;
    if (!parsed?.code) return null;
    return {
      code: String(parsed.code),
      name: String(parsed.name || parsed.code),
      discount: Number(parsed.discount) || 0,
      freeShipping: Boolean(parsed.freeShipping),
    };
  } catch {
    return null;
  }
}

export function saveCoupon(coupon: AppliedCoupon | null) {
  if (typeof window === "undefined") return;
  if (!coupon) {
    window.sessionStorage.removeItem(COUPON_KEY);
    return;
  }
  window.sessionStorage.setItem(COUPON_KEY, JSON.stringify(coupon));
}

export async function validateCouponCode(
  code: string,
  merchandiseTotal: number,
): Promise<{ ok: true; coupon: AppliedCoupon } | { ok: false; error: string }> {
  const response = await fetch("/api/coupons/validate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, merchandiseTotal }),
  });
  const data = (await response.json()) as AppliedCoupon & { error?: string };
  if (!response.ok) {
    return { ok: false, error: data.error || "This coupon is not valid." };
  }
  return {
    ok: true,
    coupon: {
      code: data.code,
      name: data.name,
      discount: data.discount,
      freeShipping: data.freeShipping,
    },
  };
}
