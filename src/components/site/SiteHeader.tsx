"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";
import { useCart } from "@/components/shop/CartProvider";
import { HeaderSearch } from "@/components/site/HeaderSearch";
import { PromoTicker, type PromoSlide } from "@/components/site/PromoTicker";
import { isStaff } from "@/lib/roles";
import {
  NAV_LINK_CLASS,
  POLICY_LINKS,
  SHOP_CATEGORIES,
  TEST_RESULTS_LINK,
  TOOL_LINKS,
} from "@/lib/storefront-nav";
import type { SessionUser } from "@/lib/types";

const MOBILE_TYPE_CLASS = `${NAV_LINK_CLASS} [word-spacing:0.08em]`;
const MOBILE_LINK_CLASS = `block rounded-sm px-3 py-3 ${MOBILE_TYPE_CLASS}`;
const MOBILE_CHILD_LINK_CLASS = `block rounded-sm px-3 py-2 text-[14px] ${MOBILE_TYPE_CLASS}`;

function Wordmark() {
  return (
    <Link href="/" className="flex min-w-0 shrink-0 items-center text-foreground">
      <span className="text-center">
        <span className="block font-serif text-[26px] font-normal leading-[0.95] tracking-[-0.04em] sm:text-[30px]">
          Invictus
        </span>
        <span className="mt-1 block font-serif text-[14px] font-normal leading-none tracking-[-0.02em] text-muted-foreground sm:text-[16px]">
          Pharma
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
      <button type="button" className={`${NAV_LINK_CLASS} inline-flex items-center gap-1 bg-transparent p-0`}>
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
    <Link href={href} className={`block px-4 py-2.5 hover:bg-card ${NAV_LINK_CLASS}`}>
      {label}
    </Link>
  );
}

function MobileAccordion({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        className={`flex w-full items-center justify-between rounded-sm px-3 py-3 ${MOBILE_TYPE_CLASS}`}
        aria-expanded={open}
        onClick={onToggle}
      >
        {label}
        <ChevronDown
          className={`size-4 opacity-70 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="space-y-0.5 border-l border-border pb-2 pl-4">{children}</div>
      ) : null}
    </div>
  );
}

function CartCount({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="grid min-w-5 place-items-center bg-primary px-1.5 py-0.5 font-mono text-[12px] tracking-normal text-primary-foreground">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function SiteHeader({
  session,
  shopLinks,
  promoItems,
  promoEnabled = true,
  promoDisplayMode = "slider",
}: {
  session: SessionUser | null;
  shopLinks: { href: string; label: string }[];
  promoItems: PromoSlide[];
  promoEnabled?: boolean;
  promoDisplayMode?: "marquee" | "slider";
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { count } = useCart();
  const staff = session ? isStaff(session.role) : false;
  const [open, setOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const shop = shopLinks.length > 0 ? shopLinks : SHOP_CATEGORIES;
  const accountHref = session ? "/account" : "/login";

  useEffect(() => {
    setOpen(false);
    setShopOpen(false);
    setFaqOpen(false);
    setToolsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (pathname.startsWith("/admin")) {
    return null;
  }

  function closeMenu() {
    setOpen(false);
  }

  return (
    <header className="sticky top-0 z-50">
      <PromoTicker items={promoItems} enabled={promoEnabled} displayMode={promoDisplayMode} />
      <div className="border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-6 py-3 lg:px-10">
          <Wordmark />
          <nav className="hidden flex-1 flex-wrap items-center justify-end gap-x-6 gap-y-2 xl:flex">
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
              <DropLink href={TEST_RESULTS_LINK.href} label={TEST_RESULTS_LINK.label} />
              {POLICY_LINKS.map((item) => (
                <DropLink key={item.href} href={item.href} label={item.label} />
              ))}
              <div className="group/tools relative">
                <p className={`flex items-center justify-between gap-2 px-4 py-2.5 ${NAV_LINK_CLASS}`}>
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
            {staff ? (
              <Link href="/admin" className={NAV_LINK_CLASS}>
                Admin
              </Link>
            ) : null}
            <Link href="/cart" className={`${NAV_LINK_CLASS} relative inline-flex items-center gap-2`}>
              Cart
              <CartCount count={count} />
            </Link>
          </nav>
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={open}
            className="p-2 xl:hidden"
            onClick={() => setOpen(true)}
          >
            <Menu className="size-6" />
          </button>
        </div>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-[200] xl:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile menu"
        >
          <div
            className="absolute inset-0 bg-ink/70"
            aria-hidden
            onClick={closeMenu}
          />
          <div className="absolute inset-y-0 right-0 z-10 flex w-full max-w-sm flex-col overflow-hidden border-l border-border bg-background text-foreground shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className={`${MOBILE_TYPE_CLASS} text-foreground`}>Menu</span>
              <button type="button" className="p-2" aria-label="Close menu" onClick={closeMenu}>
                <X className="size-6" />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-4">
              <HeaderSearch className="relative mb-3 w-full" inputId="mobile-header-search" />
              <Link href="/" className={MOBILE_LINK_CLASS} onClick={closeMenu}>
                Home
              </Link>
              <MobileAccordion label="Shop" open={shopOpen} onToggle={() => setShopOpen((value) => !value)}>
                {shop.map((item) => (
                  <Link
                    key={item.href + item.label}
                    href={item.href}
                    className={MOBILE_CHILD_LINK_CLASS}
                    onClick={closeMenu}
                  >
                    {item.label}
                  </Link>
                ))}
              </MobileAccordion>
              <MobileAccordion label="FAQ" open={faqOpen} onToggle={() => setFaqOpen((value) => !value)}>
                <Link href="/faq" className={MOBILE_CHILD_LINK_CLASS} onClick={closeMenu}>
                  FAQ
                </Link>
                <Link href={TEST_RESULTS_LINK.href} className={MOBILE_CHILD_LINK_CLASS} onClick={closeMenu}>
                  {TEST_RESULTS_LINK.label}
                </Link>
                {POLICY_LINKS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={MOBILE_CHILD_LINK_CLASS}
                    onClick={closeMenu}
                  >
                    {item.label}
                  </Link>
                ))}
              </MobileAccordion>
              <MobileAccordion
                label="Tools & resources"
                open={toolsOpen}
                onToggle={() => setToolsOpen((value) => !value)}
              >
                {TOOL_LINKS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={MOBILE_CHILD_LINK_CLASS}
                    onClick={closeMenu}
                  >
                    {item.label}
                  </Link>
                ))}
              </MobileAccordion>
              <Link href="/contact" className={MOBILE_LINK_CLASS} onClick={closeMenu}>
                Contact
              </Link>
              <Link href={accountHref} className={MOBILE_LINK_CLASS} onClick={closeMenu}>
                My account
              </Link>
              {session ? (
                <Link href="/account/orders" className={MOBILE_LINK_CLASS} onClick={closeMenu}>
                  Orders
                </Link>
              ) : null}
              {session ? (
                <Link href="/account/profile" className={MOBILE_LINK_CLASS} onClick={closeMenu}>
                  Profile
                </Link>
              ) : null}
              {session?.isAffiliate ? (
                <Link href="/account/affiliate" className={MOBILE_LINK_CLASS} onClick={closeMenu}>
                  Affiliate tracking
                </Link>
              ) : null}
              {staff ? (
                <Link href="/admin" className={MOBILE_LINK_CLASS} onClick={closeMenu}>
                  Admin
                </Link>
              ) : null}
              {session ? (
                <button
                  type="button"
                  className={`w-full text-left ${MOBILE_LINK_CLASS}`}
                  onClick={() => {
                    closeMenu();
                    void fetch("/api/auth/logout", { method: "POST" }).then(() => {
                      router.push("/");
                      router.refresh();
                    });
                  }}
                >
                  Sign out
                </button>
              ) : null}
              <Link
                href="/cart"
                className={`flex items-center justify-between rounded-sm px-3 py-3 ${MOBILE_TYPE_CLASS}`}
                onClick={closeMenu}
              >
                Cart
                <CartCount count={count} />
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
