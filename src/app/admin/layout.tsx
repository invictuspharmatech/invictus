import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { Logo } from "@/components/site/Logo";
import { LogoutButton } from "@/components/shop/LogoutButton";
import { isFullAdmin, roleLabel } from "@/lib/roles";

const ALL_LINKS = [
  { href: "/admin", label: "Overview", adminOnly: false },
  { href: "/admin/orders", label: "Orders", adminOnly: false },
  { href: "/admin/products", label: "Products", adminOnly: false },
  { href: "/admin/transfers", label: "Transfers", adminOnly: false },
  { href: "/admin/cms", label: "CMS", adminOnly: true },
  { href: "/admin/accounting", label: "Accounting", adminOnly: true },
  { href: "/admin/affiliates", label: "Affiliates", adminOnly: true },
  { href: "/admin/users", label: "Users", adminOnly: true },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await requireStaff();
  if (!staff) redirect("/login?next=/admin");
  const admin = isFullAdmin(staff.role);
  const links = ALL_LINKS.filter((link) => admin || !link.adminOnly);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Logo />
            <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              {roleLabel(staff.role)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Store
            </Link>
            <LogoutButton />
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-5 overflow-x-auto px-4 pb-3 sm:px-6">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">{children}</div>
    </div>
  );
}
