"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";
import { useCart } from "@/components/shop/CartProvider";
import { HeaderSearch } from "@/components/site/HeaderSearch";
import { PromoTicker } from "@/components/site/PromoTicker";
import { isStaff } from "@/lib/roles";
import {
  NAV_LINK_CLASS,
  POLICY_LINKS,
  SHOP_CATEGORIES,
  TOOL_LINKS,
} from "@/lib/storefront-nav";
import type { SessionUser } from "@/lib/types";

function Wordmark() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-3 text-foreground">
      <Image
        src="/images/invictus-logo.png"
        alt=""
        width={48}
        height={48}
        className="size-12 object-contain"
      />
      <span>
        <span className="block font-mono text-[26px] font-normal leading-none tracking-[0.22em] sm:text-[30px]">
          INVICTUS
        </span>
        <span className="mt-1.5 block font-mono text-[12px] font-normal leading-none tracking-[0.46em] text-muted-foreground sm:text-[14px]">
          PHARMA
        </span>
      </span>
    </Link>
  );
}

function Dropdown({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="group relative">
      <button type="button" className={`${NAV_LINK_CLASS} inline-flex items-center gap-1`}>
        {label}
        <ChevronDown className="size-4 opacity-70 transition group-hover:rotate-180" aria-hidden />
      </button>
      <div className="invisible absolute left-0 top-full z-50 min-w-56 border border-border bg-background py-1 opacity-0 shadow-xl transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        {children}
      </div>
    </div>
  );
}

function DropLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block px-4 py-2.5 font-mono text-[16px] font-normal uppercase tracking-[0.12em] text-muted-foreground hover:bg-card hover:text-signal"
    >
      {label}
    </Link>
  );
}

export function SiteHeader({
  session,
  shopLinks,
  promoItems,
}: {
  session: SessionUser | null;
  shopLinks: { href: string; label: string }[];
  promoItems: string[];
}) {
  const pathname = usePathname();
  const { count } = useCart();
  const staff = session ? isStaff(session.role) : false;
  const [open, setOpen] = useState(false);
  const shop = shopLinks.length > 0 ? shopLinks : SHOP_CATEGORIES;
  const accountHref = session ? (staff ? "/admin" : "/account") : "/login";

  if (pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-xl">
      <PromoTicker items={promoItems} />
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-3 lg:px-10">
        <Wordmark />
        <nav className="hidden flex-1 flex-wrap items-center justify-end gap-x-6 gap-y-2 lg:flex">
          <HeaderSearch />
          <Link href="/" className={NAV_LINK_CLASS}>
            Home
          </Link>
          <Dropdown label="Shop">
            {shop.map((item) => (
              <DropLink key={item.href + item.label} href={item.href} label={item.label} />
            ))}
          </Dropdown>
          <Dropdown label="FAQ">
            <DropLink href="/faq" label="FAQ" />
            {POLICY_LINKS.map((item) => (
              <DropLink key={item.href} href={item.href} label={item.label} />
            ))}
            <div className="group/tools relative">
              <p className="flex items-center justify-between gap-2 px-4 py-2.5 font-mono text-[16px] font-normal uppercase tracking-[0.12em] text-muted-foreground">
                Tools & resources
                <ChevronDown className="-rotate-90 size-4 opacity-70" aria-hidden />
              </p>
              <div className="invisible absolute left-full top-0 z-50 min-w-56 border border-border bg-background py-1 opacity-0 shadow-xl transition group-hover/tools:visible group-hover/tools:opacity-100">
                {TOOL_LINKS.map((item) => (
                  <DropLink key={item.href} href={item.href} label={item.label} />
                ))}
              </div>
            </div>
          </Dropdown>
          <Link href="/contact" className={NAV_LINK_CLASS}>
            Contact
          </Link>
          <Link href={accountHref} className={NAV_LINK_CLASS}>
            My account
          </Link>
          <Link href="/cart" className={`${NAV_LINK_CLASS} relative inline-flex items-center gap-2`}>
            Cart
            {count > 0 ? (
              <span className="grid min-w-5 place-items-center bg-primary px-1 font-mono text-[12px] text-primary-foreground">
                {count}
              </span>
            ) : null}
          </Link>
        </nav>
        <div className="flex items-center gap-2 lg:hidden">
          <Link href="/cart" className={`${NAV_LINK_CLASS} relative p-2 text-[16px]`}>
            Cart
            {count > 0 ? (
              <span className="absolute right-0 top-0 grid min-w-4 place-items-center bg-primary px-1 font-mono text-[11px] text-primary-foreground">
                {count}
              </span>
            ) : null}
          </Link>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            className="p-2"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
      </div>
      {open ? (
        <div className="space-y-3 border-t border-border bg-background px-6 py-4 lg:hidden">
          <form action="/search" className="flex gap-2">
            <input className="field rounded-md" name="q" placeholder="Search" />
            <button className="gold-btn" type="submit">
              Go
            </button>
          </form>
          <Link href="/" className={`block py-1 ${NAV_LINK_CLASS}`} onClick={() => setOpen(false)}>
            Home
          </Link>
          <p className={`${NAV_LINK_CLASS} inline-flex items-center gap-1`}>
            Shop
            <ChevronDown className="size-4 opacity-70" aria-hidden />
          </p>
          {shop.map((item) => (
            <Link
              key={item.href + item.label}
              href={item.href}
              className="block py-1 pl-3 font-mono text-[16px] font-normal uppercase tracking-[0.12em] text-muted-foreground"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <p className={`${NAV_LINK_CLASS} inline-flex items-center gap-1`}>
            FAQ
            <ChevronDown className="size-4 opacity-70" aria-hidden />
          </p>
          <Link href="/faq" className="block py-1 pl-3 font-mono text-[16px] uppercase tracking-[0.12em] text-muted-foreground" onClick={() => setOpen(false)}>
            FAQ
          </Link>
          {POLICY_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block py-1 pl-3 font-mono text-[16px] font-normal uppercase tracking-[0.12em] text-muted-foreground"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          {TOOL_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block py-1 pl-3 font-mono text-[16px] font-normal uppercase tracking-[0.12em] text-muted-foreground"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <Link href="/contact" className={`block py-1 ${NAV_LINK_CLASS}`} onClick={() => setOpen(false)}>
            Contact
          </Link>
          <Link
            href={accountHref}
            className={`block py-1 ${NAV_LINK_CLASS}`}
            onClick={() => setOpen(false)}
          >
            My account
          </Link>
        </div>
      ) : null}
    </header>
  );
}
