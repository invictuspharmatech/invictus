export const TELEGRAM_URL = "https://t.me/invictuspharma";

export const NAV_LINK_CLASS =
  "font-mono text-[20px] font-bold uppercase tracking-[0.1em] text-muted-foreground transition hover:text-signal";

export const SHOP_CATEGORIES: { href: string; label: string }[] = [
  { href: "/products", label: "All products" },
  { href: "/products?category=oils", label: "Oils" },
  { href: "/products?category=orals", label: "Orals" },
  { href: "/products?category=peptides-glps", label: "Peptides & GLPs" },
  { href: "/products?category=aminos", label: "Aminos" },
  { href: "/products?category=pct-medications", label: "PCT / Medications" },
  { href: "/products?category=injectables", label: "Injectables" },
  { href: "/products?category=gift-cards", label: "Gift cards" },
  { href: "/products?category=womens-line", label: "Women's line" },
];

export const TOOL_LINKS: { href: string; label: string }[] = [
  { href: "/bitcoin-tutorial", label: "Bitcoin tutorial" },
  { href: "/peptide-calculator", label: "Peptide calculator" },
  { href: "/peptide-protocol", label: "Peptide protocol" },
  { href: "/crashed-gear-protocol", label: "Crashed gear protocol" },
  { href: "/test-results", label: "Test results" },
];

export const DEFAULT_PROMO_ITEMS = [
  "Paid orders process the same business day when received before 2pm ET.",
  "Bitcoin checkout only — see the tutorial under FAQ → Tools.",
  "$100 minimum order · $20 shipping per warehouse shipment.",
];
