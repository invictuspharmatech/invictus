import Link from "next/link";
import { formatMoney } from "@/lib/constants";
import type { ApiDashboardOverview } from "@/lib/api-types";

function daysInCurrentMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

function salesTone(amount: number, dayMultiplier: number) {
  if (amount <= 0) return "dash-tile-danger";
  if (amount <= 500 * dayMultiplier) return "dash-tile-warning";
  if (amount <= 1000 * dayMultiplier) return "dash-tile-info";
  return "dash-tile-success";
}

function Tile({
  href,
  tone,
  value,
  label,
}: {
  href: string;
  tone: string;
  value: string;
  label: string;
}) {
  return (
    <Link href={href} className={`dash-tile ${tone}`}>
      <h3>{value}</h3>
      <p>{label}</p>
    </Link>
  );
}

export function DashboardTiles({ overview }: { overview: ApiDashboardOverview }) {
  const monthDays = daysInCurrentMonth();
  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Tile
        href="/admin/accounting"
        tone={salesTone(overview.salesToday, 1)}
        value={formatMoney(overview.salesToday)}
        label="Sales today"
      />
      <Tile
        href="/admin/accounting"
        tone={salesTone(overview.salesThisMonth, monthDays)}
        value={formatMoney(overview.salesThisMonth)}
        label="Sales this month"
      />
      <Tile
        href="/admin/accounting"
        tone={overview.shippingSinceReset > 0 ? "dash-tile-info" : "dash-tile-success"}
        value={formatMoney(overview.shippingSinceReset)}
        label="Shipping since reset"
      />
      <Tile
        href="/admin/accounting"
        tone={overview.shippingThisWeek > 0 ? "dash-tile-info" : "dash-tile-success"}
        value={formatMoney(overview.shippingThisWeek)}
        label="Shipping this week"
      />
      <Tile
        href="/admin/orders?status=pending"
        tone="dash-tile-orange"
        value={String(overview.ordersPending)}
        label="Orders pending"
      />
      <Tile
        href="/admin/orders?status=processing"
        tone="dash-tile-orange"
        value={String(overview.ordersProcessing)}
        label="Orders processing"
      />
      <Tile
        href="/admin/orders?status=delivered"
        tone="dash-tile-orange"
        value={String(overview.ordersCompleted)}
        label="Orders completed"
      />
      <Tile
        href="/admin/categories"
        tone="dash-tile-primary"
        value={overview.topCategoryMonth.name}
        label={`Top category · ${overview.topCategoryMonth.count} this month`}
      />
      <Tile
        href="/admin/products"
        tone="dash-tile-info"
        value={String(overview.productCount)}
        label="Products"
      />
      <Tile
        href="/admin/inventory"
        tone={overview.lowStockCount > 0 ? "dash-tile-warning" : "dash-tile-success"}
        value={String(overview.lowStockCount)}
        label="Products low stock"
      />
      <Tile
        href="/admin/categories"
        tone="dash-tile-primary"
        value={String(overview.categoriesTotal)}
        label="Categories"
      />
      <Tile
        href="/admin/warehouses"
        tone="dash-tile-info"
        value={String(overview.warehousesTotal)}
        label="Warehouses"
      />
      <Tile
        href="/admin/promotions"
        tone="dash-tile-info"
        value={String(overview.couponsTotal)}
        label="Coupons"
      />
      <Tile
        href="/admin/promotions"
        tone="dash-tile-dark"
        value={String(overview.giftCardsTotal)}
        label="Gift cards"
      />
      <Tile
        href="/admin/users"
        tone="dash-tile-primary"
        value={String(overview.customersTotal)}
        label="Customers"
      />
      <Tile
        href="/admin/users"
        tone="dash-tile-primary"
        value={formatMoney(overview.storeCreditAvailable)}
        label="Store credit available"
      />
    </div>
  );
}
