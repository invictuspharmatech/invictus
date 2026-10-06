import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { Logo } from "@/components/site/Logo";
import { AdminAccountMenu } from "@/components/admin/AdminAccountMenu";
import { AdminNav, type AdminNavItem } from "@/components/admin/AdminNav";
import { isFullAdmin, roleLabel } from "@/lib/roles";

export const dynamic = "force-dynamic";

const ADMIN_NAV: AdminNavItem[] = [
  {
    href: "/admin",
    label: "Dashboard",
    children: [
      { href: "/admin", label: "Overview" },
      { href: "/admin/dashboard/tiles", label: "Tile layout" },
    ],
  },
  {
    href: "/admin/products",
    label: "Products",
    children: [
      { href: "/admin/products", label: "Product list" },
      { href: "/admin/cms/products/new", label: "Create product" },
      { href: "/admin/stock-alerts", label: "Stock alerts" },
      { href: "/admin/products?import=1", label: "Import from CSV" },
      { href: "/admin/products?export=1", label: "Export to CSV" },
      { href: "/admin/cms/test-results", label: "Test results" },
    ],
  },
  {
    href: "/admin/categories",
    label: "Categories",
    children: [
      { href: "/admin/categories", label: "Category list" },
      { href: "/admin/categories/new", label: "Add category" },
      { href: "/admin/categories?import=1", label: "Import from CSV" },
      { href: "/admin/categories?export=1", label: "Export to CSV" },
    ],
  },
  {
    href: "/admin/orders",
    label: "Orders",
    children: [
      { href: "/admin/orders", label: "Order list" },
      { href: "/admin/orders/summary", label: "Order summary" },
      { href: "/admin/orders/create", label: "Create order" },
    ],
  },
  {
    href: "/admin/email",
    label: "Email",
    children: [
      { href: "/admin/email", label: "Bulk email" },
      { href: "/admin/cms/email", label: "Settings & templates" },
    ],
  },
  {
    href: "/admin/users",
    label: "Users",
    children: [
      { href: "/admin/users", label: "User list" },
      { href: "/admin/users/new", label: "Add user" },
    ],
  },
  { href: "/admin/inventory", label: "Inventory" },
  {
    href: "/admin/warehouses",
    label: "Warehouses",
    children: [
      { href: "/admin/warehouses", label: "All warehouses" },
      { href: "/admin/warehouses/WAREHOUSE_1", label: "Warehouse 1" },
      { href: "/admin/warehouses/WAREHOUSE_2", label: "Warehouse 2" },
      { href: "/admin/transfers", label: "Transfers" },
    ],
  },
  {
    href: "/admin/promotions",
    label: "Promotions",
    children: [
      { href: "/admin/promotions/coupons", label: "Coupons" },
      { href: "/admin/affiliates", label: "Affiliates" },
    ],
  },
  { href: "/admin/cms/btcpostage", label: "Btcpostage" },
  { href: "/admin/accounting", label: "Accounting" },
  {
    href: "/admin/analytics",
    label: "Analytics",
    children: [
      { href: "/admin/analytics", label: "Overview" },
      { href: "/admin/analytics/charts", label: "Charts" },
      { href: "/admin/analytics/revenue", label: "Revenue" },
      { href: "/admin/analytics/products", label: "Products" },
      { href: "/admin/analytics/orders", label: "Orders" },
      { href: "/admin/analytics/variations", label: "Variations" },
      { href: "/admin/analytics/categories", label: "Categories" },
      { href: "/admin/analytics/coupons", label: "Coupons" },
      { href: "/admin/analytics/stock", label: "Stock" },
    ],
  },
  {
    href: "/admin/cms",
    label: "Content",
    children: [
      { href: "/admin/cms/pages", label: "Pages" },
      { href: "/admin/cms/faq", label: "FAQ" },
      { href: "/admin/cms/banners", label: "Banners / promo bar" },
      { href: "/admin/cms/email", label: "Email settings & templates" },
      { href: "/admin/cms/btcpay", label: "BTCPay / Bitcoin" },
      { href: "/admin/cms/settings", label: "Site settings" },
      { href: "/admin/cms/test-results", label: "Test results" },
    ],
  },
  {
    href: "/admin/settings",
    label: "Settings",
    children: [
      { href: "/admin/settings", label: "Store settings" },
      { href: "/admin/profile", label: "Staff profile" },
    ],
  },
];

const WAREHOUSE_NAV: AdminNavItem[] = [
  { href: "/admin", label: "Dashboard" },
  {
    href: "/admin/orders",
    label: "Orders",
    children: [
      { href: "/admin/orders", label: "Order list" },
      { href: "/admin/orders/summary", label: "Order summary" },
    ],
  },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/warehouses", label: "Warehouses" },
  { href: "/admin/transfers", label: "Transfers" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await requireStaff();
  if (!staff) redirect("/login?next=/admin");
  const admin = isFullAdmin(staff.role);
  const items = admin ? ADMIN_NAV : WAREHOUSE_NAV;

  return (
    <div className="min-h-screen bg-background">
      <header className="relative z-30 border-b border-border/50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Logo href="/admin" />
            <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              {roleLabel(staff.role)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <a href="/" className="ghost-btn">
              View store
            </a>
            <AdminAccountMenu
              name={staff.name}
              email={staff.email}
              showSettings={admin}
            />
          </div>
        </div>
        <AdminNav items={items} />
      </header>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">{children}</div>
    </div>
  );
}
