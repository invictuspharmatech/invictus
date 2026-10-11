"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu } from "lucide-react";
import { MobileSlideOut } from "@/components/site/MobileSlideOut";

export type AdminNavItem = {
  href: string;
  label: string;
  children?: { href: string; label: string }[];
};

const LINK_CLASS =
  "cursor-pointer text-[13px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground";
const MOBILE_LINK_CLASS =
  "block rounded-sm px-3 py-3 font-mono text-[15px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground";
const MOBILE_CHILD_CLASS =
  "block rounded-sm px-3 py-2 font-mono text-[13px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground";

function pathOnly(href: string) {
  return href.split("?")[0] || href;
}

function hrefIsActive(pathname: string, href: string) {
  const path = pathOnly(href);
  if (path === "/admin") {
    return pathname === "/admin" || pathname.startsWith("/admin/dashboard");
  }
  return pathname === path || pathname.startsWith(`${path}/`);
}

function itemIsActive(pathname: string, item: AdminNavItem) {
  if (item.children?.length) {
    return item.children.some((child) => hrefIsActive(pathname, child.href)) || hrefIsActive(pathname, item.href);
  }
  return hrefIsActive(pathname, item.href);
}

function DesktopLinks({ items }: { items: AdminNavItem[] }) {
  return (
    <>
      {items.map((item) => {
        if (!item.children?.length) {
          return (
            <Link key={item.href} href={item.href} className={LINK_CLASS}>
              {item.label}
            </Link>
          );
        }
        return (
          <div key={item.label} className="group relative">
            <Link href={item.href} className={`inline-flex items-center ${LINK_CLASS}`}>
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
    </>
  );
}

export function AdminNav({ items }: { items: AdminNavItem[] }) {
  return (
    <nav className="relative z-40 mx-auto hidden max-w-7xl flex-wrap items-center gap-x-5 gap-y-2 px-4 pb-3 xl:flex sm:px-6">
      <DesktopLinks items={items} />
    </nav>
  );
}

export function AdminMobileNav({ items }: { items: AdminNavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    setOpen(false);
    setExpanded(null);
  }, [pathname]);

  return (
    <>
      <button
        type="button"
        className="p-2 xl:hidden"
        aria-label="Open navigation menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Menu className="size-6" />
      </button>
      <MobileSlideOut open={open} onClose={close} title="Menu" hiddenFrom="xl:hidden">
        {items.map((item) => {
          const active = itemIsActive(pathname, item);
          if (!item.children?.length) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${MOBILE_LINK_CLASS} ${active ? "text-foreground" : ""}`}
                onClick={close}
              >
                {item.label}
              </Link>
            );
          }
          const isOpen = expanded === item.label;
          return (
            <div key={item.label}>
              <button
                type="button"
                className={`flex w-full items-center justify-between rounded-sm px-3 py-3 font-mono text-[15px] uppercase tracking-[0.12em] ${
                  active ? "text-foreground" : "text-muted-foreground"
                }`}
                aria-expanded={isOpen}
                onClick={() => setExpanded((current) => (current === item.label ? null : item.label))}
              >
                {item.label}
                <ChevronDown
                  className={`size-4 opacity-70 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </button>
              {isOpen ? (
                <div className="space-y-0.5 border-l border-border pb-2 pl-4">
                  {item.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={`${MOBILE_CHILD_CLASS} ${
                        hrefIsActive(pathname, child.href) ? "text-foreground" : ""
                      }`}
                      onClick={close}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
        <Link href="/" className={MOBILE_LINK_CLASS} onClick={close}>
          View store
        </Link>
      </MobileSlideOut>
    </>
  );
}
