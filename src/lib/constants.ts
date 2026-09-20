export const SITE_NAME = "Invictus Pharma";
export const MIN_ORDER_USD = 100;
export const SHIPPING_USD = 20;
export const FIRST_ORDER_AFFILIATE_DISCOUNT = 0.1;
export const IMAGE_ORIGIN =
  process.env.IMAGE_ORIGIN ?? "https://greatlifepharma.com";

export const WAREHOUSE_1_CATEGORIES = ["peptides-glps", "aminos", "peptides"];

export const CATEGORY_IMAGES: Record<string, string> = {
  oils: "/images/oils.jpg",
  orals: "/images/orals.png",
  aminos: "/images/aminos.jpg",
  "peptides-glps": "/images/peptides.jpg",
  peptides: "/images/peptides.jpg",
  "pct-medications": "/images/featured-display.jpg",
  injectables: "/images/featured-display.jpg",
};

export const HOME_PROTOCOL_SLUGS = ["oils", "orals", "peptides-glps", "aminos"];

export const CATEGORY_BLURBS: Record<string, string> = {
  injectables: "Precision protocols for measured performance.",
  oils: "Clean, consistent daily essentials.",
  orals: "Targeted formulas for the long view.",
  "peptides-glps": "Advanced compounds, clearly documented.",
  peptides: "Advanced compounds, clearly documented.",
  aminos: "Recovery and performance amino blends.",
  "pct-medications": "Support compounds for a complete protocol.",
  "gift-cards": "Credit toward the next protocol.",
  "womens-line": "Formulas selected for a focused women's line.",
};

export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${IMAGE_ORIGIN}${normalized}`;
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/&/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function productPrice(product: {
  regularPrice: number;
  salePrice?: number | null;
}): number {
  if (product.salePrice != null && product.salePrice > 0) {
    return product.salePrice;
  }
  return product.regularPrice;
}
