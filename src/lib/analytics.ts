export type SalesTotals = {
  subtotal: number;
  shipping: number;
  grand_total: number;
};

export type AnalyticsPeriod =
  | "day"
  | "week"
  | "month"
  | "year"
  | "custom";

export type AnalyticsOverviewParams = {
  period?: AnalyticsPeriod | string;
  custom_type?: "day" | "week" | "month" | "year" | "range";
  date?: string;
  month?: string;
  year?: number | string;
  from?: string;
  to?: string;
  category_id?: string;
  view?: "daily" | "month_compare" | "year_compare";
};

export type AnalyticsOverview = {
  period: string;
  chart_period?: string;
  start_date: string;
  end_date?: string;
  label?: string;
  summary: {
    revenue: number;
    grand_total: number;
    subtotal: number;
    shipping: number;
    orders: number;
    products_sold: number;
    customers: number;
  };
  revenue_chart: Array<{ period: string; revenue: number; subtotal?: number; shipping?: number }>;
  orders_chart: Array<{ period: string; orders: number }>;
  top_products: Array<{
    product_id: string | null;
    total_sold: number;
    total_revenue: number;
    product: { name: string; sku: string };
  }>;
  top_categories: Array<{
    id: string;
    name: string;
    total_sold: number;
    total_revenue: number;
  }>;
};

export type RevenueAnalytics = {
  period: string;
  chart_period?: string;
  start_date: string;
  end_date?: string;
  label?: string;
  total_revenue: number;
  totals: SalesTotals;
  revenue_by_period: {
    today: number;
    yesterday: number;
    this_week: number;
    last_week: number;
    this_month: number;
    last_month: number;
  };
  revenue_by_period_breakdown: Record<string, SalesTotals>;
  revenue_by_status: Array<{ status: string; revenue: number }>;
  average_order_value: number;
  revenue_chart: Array<{ period: string; revenue: number; subtotal: number; shipping: number }>;
};

export type ProductsAnalytics = {
  period: string;
  label?: string;
  category_id?: string | null;
  category_name?: string | null;
  total_products: number;
  active_products: number;
  low_stock_products: number;
  top_selling_products: AnalyticsOverview["top_products"];
  products_by_category: Array<{ id: string; name: string; products_count: number }>;
  revenue_by_product: Array<{
    product_id: string | null;
    revenue: number;
    quantity_sold: number;
    product: { name: string; sku: string };
  }>;
};

export type OrdersAnalytics = {
  period: string;
  label?: string;
  total_orders: number;
  orders_by_status: Array<{ status: string; count: number }>;
  orders_chart: Array<{ period: string; orders: number }>;
  average_order_value: number;
  orders_by_payment_status: Array<{ payment_status: string; count: number }>;
};

export type VariationsAnalytics = {
  period: string;
  label?: string;
  top_variations: Array<{
    sku: string;
    name: string;
    product_id: string | null;
    total_sold: number;
    total_revenue: number;
  }>;
  variations_performance: Array<{
    sku: string;
    name: string;
    product_id: string | null;
    total_sold: number;
    total_revenue: number;
  }>;
};

export type CategoriesAnalytics = {
  period: string;
  label?: string;
  total_categories: number;
  top_categories: AnalyticsOverview["top_categories"];
  revenue_by_category: Array<{ id: string; name: string; revenue: number }>;
  products_by_category: Array<{ id: string; name: string; products_count: number }>;
};

export type CouponsAnalytics = {
  period: string;
  label?: string;
  total_coupons: number;
  active_coupons: number;
  coupon_usage: Array<{ code: string; usage_count: number; total_discount: number }>;
  top_coupons: Array<{ code: string; usage_count: number; total_discount: number }>;
  discount_amount: number;
};

export type StockAnalytics = {
  total_products: number;
  in_stock: number;
  out_of_stock: number;
  low_stock: number;
  total_value: number;
  stock_by_category: Array<{
    id: string;
    name: string;
    total_stock: number;
    total_value: number;
  }>;
  low_stock_products: Array<{
    id: string;
    name: string;
    sku: string;
    stock_quantity: number;
    stock_quantity_w1: number;
    stock_quantity_w2: number;
    categories: Array<{ id: string; name: string }>;
  }>;
};

export type SalesMetric = "subtotal" | "shipping" | "grand_total";

export type DailySalesPoint = {
  date: string;
  subtotal: number;
  shipping: number;
  grand_total: number;
  orders_count: number;
};

export type SalesChartsDailyResponse = {
  view: "daily";
  from: string;
  to: string;
  days: DailySalesPoint[];
};

export type SalesChartsYearCompareResponse = {
  view: "year_compare";
  primary_year: number;
  compare_year: number;
  months: Array<{
    month: number;
    month_name: string;
    primary_year: number;
    compare_year: number;
    primary: SalesTotals;
    compare: SalesTotals;
  }>;
};

function toQuery(params: AnalyticsOverviewParams = {}): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    qs.set(key, String(value));
  }
  const encoded = qs.toString();
  return encoded ? `?${encoded}` : "";
}

async function analyticsGet<T>(path: string, params: AnalyticsOverviewParams = {}): Promise<T> {
  const res = await fetch(`/api/admin/analytics/${path}${toQuery(params)}`, { cache: "no-store" });
  const payload = (await res.json().catch(() => null)) as
    | { data?: T; error?: string; message?: string }
    | null;
  if (!res.ok) {
    throw new Error(payload?.message || payload?.error || "Failed to load analytics");
  }
  if (!payload || payload.data == null) {
    throw new Error("No analytics data returned");
  }
  return payload.data;
}

export const analyticsApi = {
  getOverview: (params: AnalyticsOverviewParams = {}) =>
    analyticsGet<AnalyticsOverview>("overview", params),
  getRevenue: (params: AnalyticsOverviewParams = {}) =>
    analyticsGet<RevenueAnalytics>("revenue", params),
  getProducts: (params: AnalyticsOverviewParams = {}) =>
    analyticsGet<ProductsAnalytics>("products", params),
  getOrders: (params: AnalyticsOverviewParams = {}) =>
    analyticsGet<OrdersAnalytics>("orders", params),
  getVariations: (params: AnalyticsOverviewParams = {}) =>
    analyticsGet<VariationsAnalytics>("variations", params),
  getCategories: (params: AnalyticsOverviewParams = {}) =>
    analyticsGet<CategoriesAnalytics>("categories", params),
  getCoupons: (params: AnalyticsOverviewParams = {}) =>
    analyticsGet<CouponsAnalytics>("coupons", params),
  getStock: () => analyticsGet<StockAnalytics>("stock"),
  getDailyCharts: (from?: string, to?: string) =>
    analyticsGet<SalesChartsDailyResponse>("sales-charts", {
      view: "daily",
      from,
      to,
    }),
  getYearCompare: (year?: number) =>
    analyticsGet<SalesChartsYearCompareResponse>("sales-charts", {
      view: "year_compare",
      year,
    }),
};
