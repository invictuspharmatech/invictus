"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, Search, ShoppingCart, X } from "lucide-react";
import { Logo } from "@/components/site/Logo";
import { useCart } from "@/components/shop/CartProvider";
import { isStaff } from "@/lib/roles";
import type { SessionUser } from "@/lib/types";

const NAV = [
  { href: "/products", label: "Products" },
  { href: "/test-results", label: "Test Results" },
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
];

const EXTRA = [
  { href: "/bitcoin-tutorial", label: "Bitcoin Tutorial" },
  { href: "/peptide-calculator", label: "Peptide Calculator" },
  { href: "/peptide-protocol", label: "Peptide Protocol" },
  { href: "/crashed-gear-protocol", label: "Crashed Gear Protocol" },
  { href: "/affiliate", label: "Affiliate" },
];

export function SiteHeader({ session }: { session: SessionUser | null }) {
  const pathname = usePathname();
  const { count } = useCart();
  const staff = session ? isStaff(session.role) : false;
  const [open, setOpen] = useState(false);

  if (pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
        <Logo />
        <nav className="hidden items-center gap-8 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground transition hover:text-signal"
            >
              {item.label}
            </Link>
          ))}
          <div className="group relative">
            <button
              type="button"
              className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground transition hover:text-signal"
            >
              Tools
            </button>
            <div className="invisible absolute left-0 top-full z-50 min-w-56 border border-border bg-background opacity-0 shadow-xl transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
              {EXTRA.filter((item) => item.href !== "/affiliate").map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block px-4 py-2.5 font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground hover:bg-card hover:text-signal"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <Link
            href="/affiliate"
            className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground transition hover:text-signal"
          >
            Affiliate
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/search"
            aria-label="Search products"
            className="hidden p-2 text-muted-foreground transition hover:text-signal sm:block"
          >
            <Search className="size-4" />
          </Link>
          {session ? (
            <Link
              href={staff ? "/admin" : "/account"}
              className="hidden border-b border-border px-2 py-2 font-mono text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground transition hover:border-signal hover:text-signal sm:block"
            >
              {staff ? "Admin" : "Account"}
            </Link>
          ) : (
            <Link
              href="/login"
              className="hidden border-b border-border px-2 py-2 font-mono text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground transition hover:border-signal hover:text-signal sm:block"
            >
              Sign in
            </Link>
          )}
          <Link
            href="/cart"
            aria-label={`Cart with ${count} items`}
            className="relative p-2 text-foreground transition hover:text-signal"
          >
            <ShoppingCart className="size-4" />
            {count > 0 ? (
              <span className="absolute right-0 top-0 grid min-w-4 place-items-center bg-primary px-1 font-mono text-[9px] text-primary-foreground">
                {count}
              </span>
            ) : null}
          </Link>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            className="p-2 lg:hidden"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      {open ? (
        <div className="border-t border-border bg-background px-6 py-4 lg:hidden">
          {[...NAV, ...EXTRA].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block py-2 font-mono text-[11px] font-bold uppercase tracking-[.18em] text-muted-foreground"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </header>
  );
}
