"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { SessionUser } from "@/lib/types";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
}

const ITEM_CLASS =
  "block w-full px-4 py-2.5 text-left text-[13px] uppercase tracking-[0.16em] text-muted-foreground hover:bg-card hover:text-foreground";

export function HeaderAccountMenu({
  session,
  showAdmin,
}: {
  session: SessionUser;
  showAdmin: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function signOut() {
    setOpen(false);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  const links = [
    { href: "/account", label: "Account" },
    { href: "/account/orders", label: "Orders" },
    { href: "/account/profile", label: "Profile" },
    ...(session.isAffiliate ? [{ href: "/account/affiliate", label: "Affiliate tracking" }] : []),
    ...(showAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  function isActive(href: string) {
    if (href === "/account") return pathname === "/account";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-brand-red/40 bg-brand-red-deep font-serif text-sm text-foreground transition hover:border-primary"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        title={session.name || "Account"}
        onClick={() => setOpen((value) => !value)}
      >
        {initials(session.name)}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-60 overflow-hidden border border-border bg-background shadow-xl"
        >
          <div className="border-b border-border px-4 py-3">
            <p className="truncate text-sm font-medium text-foreground">{session.name || "Account"}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{session.email}</p>
          </div>
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              className={`${ITEM_CLASS} ${isActive(item.href) ? "text-foreground" : ""}`}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <div className="border-t border-border" />
          <button
            type="button"
            role="menuitem"
            className={`${ITEM_CLASS} hover:text-brand-red`}
            onClick={() => void signOut()}
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
