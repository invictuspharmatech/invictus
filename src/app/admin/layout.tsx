import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { Logo } from "@/components/site/Logo";
import { LogoutButton } from "@/components/shop/LogoutButton";
import { AdminNav, type AdminNavItem } from "@/components/admin/AdminNav";
import { ShopAsCustomerToggle } from "@/components/admin/ShopAsCustomerToggle";
import { isFullAdmin, roleLabel } from "@/lib/roles";

export const dynamic = "force-dynamic";

const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin", label: "Dashboard" },
  {
    href: "/admin/products",
    label: "Products",
    children: [
      { href: "/admin/products", label: "Product list" },
      { href: "/admin/cms/products/new", label: "Create product" },
      { href: "/admin/cms/test-results", label: "Test results" },
    ],
  },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/orders", label: "Orders" },
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
];

const WAREHOUSE_NAV: AdminNavItem[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/orders", label: "Orders" },
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
            <Logo />
            <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              {roleLabel(staff.role)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <ShopAsCustomerToggle />
            <Link href="/account" className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              My account
            </Link>
            <Link href="/" className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Store
            </Link>
            <LogoutButton />
          </div>
        </div>
        <AdminNav items={items} />
      </header>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">{children}</div>
    </div>
  );
}
