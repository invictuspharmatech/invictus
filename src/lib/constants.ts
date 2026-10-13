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

export const HOME_PROTOCOL_SLUGS = [
  "aminos",
  "orals",
  "oils",
  "peptides-glps",
  "pct-medications",
];

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

/** Catalog photos shipped in `public/images/products` and served same-origin. */
const LOCAL_PRODUCT_IMAGE_DIR = "/images/products";

const LOCAL_PRODUCT_IMAGES = new Set([
  "anastrozole-adex-1mg-10-pack.jpg",
  "cabergoline-250mcg-4-pack.png",
  "cabergoline-500mcg-4-pack.jpg",
  "clenbuterol-clen-40mcg-10-pack.jpg",
  "clomiphene-clomid-50mg-10-pack.jpg",
  "enhanced-cock-bombs-10ct.jpg",
  "exemestane-aromasin-25mg-10-pack.jpg",
  "ezetimibe-10mg-10-pack.jpg",
  "humalog-rapid-kwikpen-100iu-3ml.jpg",
  "hydrochlorothiazide-hctz-25mg-15-pack.jpg",
  "isotretinoin-accutane-20mg-10-pack.jpg",
  "lantus-long-acting-solostar-1-pen-100iu-3ml-1.jpg",
  "metformin-500mg-10-pack.jpg",
  "modafinil-100mg-10-pack.jpg",
  "nebivolol-5mg-10-pack.jpg",
  "progesterone-100mg-10-pack.jpg",
  "sildenafil-viagra-100mg-10-pack.jpg",
  "tadalafil-cialis-10mg-10-pack.png",
  "tadalafil-cialis-20mg-10-pack.jpg",
  "tamoxifen-citrate-nolva-20mg-10-pack.jpg",
  "telmisartan-80mg-15-pack.jpg",
]);

const LOCAL_PRODUCT_IMAGE_ALIASES: Record<string, string> = {
  "cock-bombs.png": "enhanced-cock-bombs-10ct.jpg",
};

export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (normalized.startsWith("/images/")) return normalized;
  const filename = normalized.split("/").pop() ?? "";
  const localName = LOCAL_PRODUCT_IMAGE_ALIASES[filename] ?? filename;
  if (LOCAL_PRODUCT_IMAGES.has(localName)) {
    return `${LOCAL_PRODUCT_IMAGE_DIR}/${localName}`;
  }
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
