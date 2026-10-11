"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const DESKTOP_LINK =
  "text-[13px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground";

export function AccountNav({
  isAffiliate,
  staff,
}: {
  isAffiliate: boolean;
  staff: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  const links = [
    { href: "/account", label: "Account" },
    { href: "/account/orders", label: "Orders" },
    { href: "/account/profile", label: "Profile" },
    ...(isAffiliate ? [{ href: "/account/affiliate", label: "Affiliate tracking" }] : []),
    ...(staff ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  function isActive(href: string) {
    if (href === "/account") return pathname === "/account";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="hidden border-b border-border/50 xl:block">
      <nav className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 sm:px-6">
        {links.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`${DESKTOP_LINK} ${isActive(item.href) ? "text-foreground" : ""}`}
          >
            {item.label}
          </Link>
        ))}
        <button type="button" className={DESKTOP_LINK} onClick={() => void signOut()}>
          Sign out
        </button>
      </nav>
    </div>
  );
}
