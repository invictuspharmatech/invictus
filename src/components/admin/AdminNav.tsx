"use client";

import Link from "next/link";
import { useState } from "react";

export type AdminNavItem = {
  href: string;
  label: string;
  children?: { href: string; label: string }[];
};

export function AdminNav({ items }: { items: AdminNavItem[] }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <nav className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-2 overflow-x-auto px-4 pb-3 sm:px-6">
      {items.map((item) => {
        if (!item.children?.length) {
          return (
            <Link
              key={item.href}
              href={item.href}
              className="text-[13px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
            >
              {item.label}
            </Link>
          );
        }
        return (
          <div
            key={item.label}
            className="relative"
            onMouseEnter={() => setOpen(item.label)}
            onMouseLeave={() => setOpen(null)}
          >
            <button
              type="button"
              className="text-[13px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
              onClick={() => setOpen((current) => (current === item.label ? null : item.label))}
            >
              {item.label}
            </button>
            {open === item.label ? (
              <div className="absolute left-0 top-full z-40 min-w-48 border border-border bg-background py-1 shadow-xl">
                {item.children.map((child) => (
                  <Link
                    key={child.href}
                    href={child.href}
                    className="block px-4 py-2 text-[12px] uppercase tracking-[0.16em] text-muted-foreground hover:bg-card hover:text-foreground"
                  >
                    {child.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
