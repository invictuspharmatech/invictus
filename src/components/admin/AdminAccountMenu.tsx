"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Settings, UserCircle, UserCog } from "lucide-react";

type AdminAccountMenuProps = {
  name: string;
  email: string;
  showSettings: boolean;
};

export function AdminAccountMenu({ name, email, showSettings }: AdminAccountMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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
    document.addEventListener("click", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function onLogout() {
    setOpen(false);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="ghost-btn inline-flex items-center gap-2"
        aria-expanded={open}
        aria-haspopup="menu"
        title="Account"
        onClick={() => setOpen((value) => !value)}
      >
        <UserCog className="size-4" aria-hidden />
        <span className="hidden sm:inline">Account</span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-md border border-border bg-background shadow-lg"
        >
          <div className="border-b border-border px-3 py-3">
            <p className="truncate text-sm font-medium text-foreground">{name || "Admin"}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{email}</p>
          </div>
          <Link
            href="/admin/profile"
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-muted"
            onClick={() => setOpen(false)}
          >
            <UserCircle className="size-4 shrink-0" aria-hidden />
            Profile
          </Link>
          {showSettings ? (
            <>
              <div className="border-t border-border" />
              <Link
                href="/admin/settings"
                role="menuitem"
                className="flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-muted"
                onClick={() => setOpen(false)}
              >
                <Settings className="size-4 shrink-0" aria-hidden />
                Settings
              </Link>
            </>
          ) : null}
          <div className="border-t border-border" />
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-foreground hover:bg-muted"
            onClick={() => {
              void onLogout();
            }}
          >
            <LogOut className="size-4 shrink-0" aria-hidden />
            Logout
          </button>
        </div>
      ) : null}
    </div>
  );
}
