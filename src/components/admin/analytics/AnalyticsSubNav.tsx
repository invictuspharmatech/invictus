"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ANALYTICS_TAB_ITEMS } from "@/lib/admin-analytics-tabs";

function tabIsActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/admin/analytics") return pathname === "/admin/analytics";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AnalyticsSubNav() {
  const pathname = usePathname();

  return (
    <nav className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9" aria-label="Analytics sections">
      {ANALYTICS_TAB_ITEMS.map((tab) => {
        const active = tabIsActive(pathname, tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            scroll={false}
            prefetch
            className={active ? "gold-btn text-center text-[11px]" : "ghost-btn text-center text-[11px]"}
          >
            {tab.name}
          </Link>
        );
      })}
    </nav>
  );
}
