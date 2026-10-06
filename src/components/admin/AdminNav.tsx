"use client";

import Link from "next/link";

export type AdminNavItem = {
  href: string;
  label: string;
  children?: { href: string; label: string }[];
};

export function AdminNav({ items }: { items: AdminNavItem[] }) {
  return (
    <nav className="relative z-40 mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-2 px-4 pb-3 sm:px-6">
      {items.map((item) => {
        if (!item.children?.length) {
          return (
            <Link
              key={item.href}
              href={item.href}
              className="cursor-pointer text-[13px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
            >
              {item.label}
            </Link>
          );
        }
        return (
          <div key={item.label} className="group relative">
            <Link
              href={item.href}
              className="inline-flex cursor-pointer items-center text-[13px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
            >
              {item.label}
            </Link>
            <div className="invisible absolute left-0 top-full z-50 min-w-52 pt-2 opacity-0 transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
              <div className="border border-border bg-background py-1 shadow-xl">
                {item.children.map((child) => (
                  <Link
                    key={child.href}
                    href={child.href}
                    className="block cursor-pointer px-4 py-2 text-[12px] uppercase tracking-[0.16em] text-muted-foreground hover:bg-card hover:text-foreground"
                  >
                    {child.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
