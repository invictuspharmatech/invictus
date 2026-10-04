/** Tabs for /admin/analytics/* (shared layout + sub-nav). */
export const ANALYTICS_TAB_ITEMS = [
  { name: "Overview", href: "/admin/analytics" },
  { name: "Charts", href: "/admin/analytics/charts" },
  { name: "Revenue", href: "/admin/analytics/revenue" },
  { name: "Products", href: "/admin/analytics/products" },
  { name: "Orders", href: "/admin/analytics/orders" },
  { name: "Variations", href: "/admin/analytics/variations" },
  { name: "Categories", href: "/admin/analytics/categories" },
  { name: "Coupons", href: "/admin/analytics/coupons" },
  { name: "Stock", href: "/admin/analytics/stock" },
] as const;
