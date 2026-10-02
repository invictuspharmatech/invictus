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
  { href: "/admin", label: "Overview" },
  { href: "/admin/orders", label: "Orders" },
  {
    href: "/admin/products",
    label: "Catalog",
    children: [
      { href: "/admin/products", label: "Products" },
      { href: "/admin/cms/test-results", label: "Test results" },
    ],
  },
  {
    href: "/admin/transfers",
    label: "Warehouses",
    children: [
      { href: "/admin/transfers", label: "Transfers & requests" },
      { href: "/admin/cms/warehouses", label: "Warehouse settings" },
    ],
  },
  {
    href: "/admin/cms",
    label: "CMS",
    children: [
      { href: "/admin/cms/pages", label: "Pages" },
      { href: "/admin/cms/faq", label: "FAQ" },
      { href: "/admin/cms/banners", label: "Banners / promo bar" },
      { href: "/admin/cms/email", label: "Email & notifications" },
      { href: "/admin/cms/btcpay", label: "BTCPay / Bitcoin" },
      { href: "/admin/cms/btcpostage", label: "Bitcoin Postage" },
      { href: "/admin/cms/settings", label: "Site settings" },
    ],
  },
  { href: "/admin/accounting", label: "Accounting" },
  { href: "/admin/affiliates", label: "Affiliates" },
  { href: "/admin/users", label: "Users" },
];

const WAREHOUSE_NAV: AdminNavItem[] = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/products", label: "Inventory" },
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
