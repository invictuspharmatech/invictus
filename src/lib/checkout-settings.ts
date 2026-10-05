export type ShippingFeeOption = {
  id: string;
  name: string;
  fee: number;
  sortOrder: number;
};

export type CheckoutSettings = {
  minOrderAmount: number | null;
  maxOrderAmount: number | null;
  includeShippingInOrderLimit: boolean;
  shippingFees: ShippingFeeOption[];
};

export const SHIPPING_OPTION_KEY = "invictus-shipping-option";

export async function fetchCheckoutSettings(): Promise<CheckoutSettings> {
  const response = await fetch("/api/checkout-settings", { cache: "no-store" });
  if (!response.ok) {
    return {
      minOrderAmount: 100,
      maxOrderAmount: null,
      includeShippingInOrderLimit: false,
      shippingFees: [{ id: "standard", name: "Standard", fee: 20, sortOrder: 0 }],
    };
  }
  return (await response.json()) as CheckoutSettings;
}

export function readSavedShippingOptionId(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(SHIPPING_OPTION_KEY);
}

export function saveShippingOptionId(id: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(SHIPPING_OPTION_KEY, id);
}

export function resolveShippingFee(
  settings: CheckoutSettings | null,
  optionId: string | null,
): ShippingFeeOption {
  const fees = settings?.shippingFees ?? [];
  if (fees.length === 0) {
    return { id: "standard", name: "Standard", fee: 20, sortOrder: 0 };
  }
  const match = optionId ? fees.find((row) => row.id === optionId) : null;
  return match ?? fees[0];
}

export function orderLimitAmount(
  merchandise: number,
  shipping: number,
  settings: CheckoutSettings | null,
): number {
  return settings?.includeShippingInOrderLimit ? merchandise + shipping : merchandise;
}
