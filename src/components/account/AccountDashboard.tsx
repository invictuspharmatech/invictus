"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { AffiliateApplyButton } from "@/components/shop/AffiliateApplyButton";
import { useCart } from "@/components/shop/CartProvider";
import { formatMoney } from "@/lib/constants";
import { formatOrderStatus } from "@/lib/enums";
import type { ApiOrder } from "@/lib/api-types";
import type { SessionUser } from "@/lib/types";

function firstName(name: string) {
  const part = name.trim().split(/\s+/)[0];
  return part || "there";
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
}

function statusBadgeClass(status: string) {
  const key = status.toUpperCase();
  if (key === "COMPLETED" || key === "SHIPPED" || key === "DELIVERED") {
    return "bg-emerald-950/70 text-emerald-200";
  }
  if (key === "PENDING" || key === "PROCESSING" || key === "PAID" || key === "ON_HOLD") {
    return "bg-amber-950/70 text-amber-200";
  }
  if (key === "CANCELLED" || key === "FAILED" || key === "REFUNDED") {
    return "bg-brand-red/25 text-red-200";
  }
  return "bg-muted text-muted-foreground";
}

function CardWidget({
  title,
  children,
  footerHref,
  footerLabel,
}: {
  title: string;
  children: ReactNode;
  footerHref?: string;
  footerLabel?: string;
}) {
  return (
    <section className="tile flex h-full flex-col overflow-hidden !p-0">
      <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
        <h2 className="text-lg">{title}</h2>
      </div>
      <div className="flex-1 p-5">{children}</div>
      {footerHref && footerLabel ? (
        <div className="border-t border-border/50 bg-muted/40 px-5 py-3">
          <Link href={footerHref} className="text-sm font-medium text-signal hover:underline">
            {footerLabel} →
          </Link>
        </div>
      ) : null}
    </section>
  );
}

function StatWidget({
  title,
  value,
  subtext,
  href,
  icon,
  tone = "wine",
}: {
  title: string;
  value: string;
  subtext: string;
  href: string;
  icon: string;
  tone?: "wine" | "gold" | "ink";
}) {
  const toneClass =
    tone === "gold"
      ? "bg-primary text-primary-foreground"
      : tone === "ink"
        ? "bg-secondary text-foreground"
        : "bg-brand-red-deep text-foreground";
  return (
    <Link
      href={href}
      className={`flex h-full min-h-[7.5rem] flex-col overflow-hidden ${toneClass} transition hover:opacity-95`}
    >
      <div className="flex flex-1 items-center justify-between p-4">
        <div>
          <p className="text-sm font-medium opacity-90">{title}</p>
          <p className="mt-0.5 text-2xl font-bold">{value}</p>
          <p className="mt-1 text-xs opacity-80">{subtext}</p>
        </div>
        <span className="ml-2 shrink-0 text-3xl opacity-80" aria-hidden>
          {icon}
        </span>
      </div>
      <div className="bg-black/20 px-4 py-2 text-sm font-medium">View details →</div>
    </Link>
  );
}

export function AccountDashboard({
  session,
  staff,
  orders,
  orderCount,
  lifetimeSavings,
  application,
}: {
  session: SessionUser;
  staff: boolean;
  orders: ApiOrder[];
  orderCount: number;
  lifetimeSavings: number;
  application: { id: string; status: string } | null;
}) {
  const router = useRouter();
  const { count, merchandiseTotal } = useCart();

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-6">
      <h1 className="display-font text-3xl font-semibold sm:text-4xl">
        Welcome back, {firstName(session.name)}
      </h1>

      <div className="mt-8 grid grid-cols-1 items-stretch gap-8 lg:grid-cols-3">
        <div className="space-y-6">
          <CardWidget title="Account">
          <div className="space-y-3 text-sm">
            <div className="mb-3 flex items-center gap-4">
              <div className="grid size-16 shrink-0 place-items-center rounded-full border-2 border-brand-red/40 bg-brand-red-deep font-serif text-xl text-foreground">
                {initials(session.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{session.name}</p>
                <p className="truncate text-muted-foreground">{session.email}</p>
              </div>
            </div>
            <p>
              <span className="font-medium text-muted-foreground">Name</span>
              <br />
              {session.name}
            </p>
            <p>
              <span className="font-medium text-muted-foreground">Email</span>
              <br />
              {session.email}
            </p>
            {session.isAffiliate ? (
              <p>
                <span className="font-medium text-muted-foreground">Affiliate</span>
                <br />
                <span className="mt-1 inline-flex rounded-full bg-emerald-950/70 px-2 py-0.5 text-xs font-semibold text-emerald-200">
                  Affiliate{session.affiliateCode ? ` · ${session.affiliateCode}` : ""}
                </span>
              </p>
            ) : (
              <AffiliateApplyButton pending={application?.status === "pending"} />
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-2 pt-3">
              <Link href="/account/profile" className="text-sm font-medium text-signal hover:underline">
                Edit profile
              </Link>
              {session.isAffiliate ? (
                <Link href="/account/affiliate" className="text-sm font-medium text-signal hover:underline">
                  Affiliate tracking
                </Link>
              ) : null}
              {staff ? (
                <Link href="/admin" className="text-sm font-medium text-signal hover:underline">
                  Admin
                </Link>
              ) : null}
              <button
                type="button"
                className="text-sm font-medium text-muted-foreground hover:text-brand-red"
                onClick={() => void signOut()}
              >
                Sign out
              </button>
            </div>
          </div>
          </CardWidget>
        </div>

        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-3">
            <StatWidget
              title="Orders"
              value={String(orderCount)}
              subtext="Total orders"
              href="/account/orders"
              icon="📦"
              tone="wine"
            />
            <StatWidget
              title="Cart"
              value={String(count)}
              subtext={count > 0 ? formatMoney(merchandiseTotal) : "No items yet"}
              href="/cart"
              icon="🛒"
              tone="ink"
            />
            <StatWidget
              title="Lifetime savings"
              value={formatMoney(lifetimeSavings)}
              subtext="Coupons and sale discounts"
              href="/account/orders"
              icon="✨"
              tone="gold"
            />
          </div>
        </div>
      </div>

      {staff ? (
        <div className="mt-8 max-w-sm">
          <StatWidget
            title="Admin"
            value="Panel"
            subtext="Manage store"
            href="/admin"
            icon="⚙️"
            tone="ink"
          />
        </div>
      ) : null}

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-6">
          <CardWidget
            title="My Cart"
            footerHref={count > 0 ? "/cart" : "/products"}
            footerLabel={count > 0 ? "View cart" : "Shop now"}
          >
            {count > 0 ? (
              <>
                <p className="mb-3 text-muted-foreground">
                  <span className="font-semibold text-foreground">{count}</span> item
                  {count === 1 ? "" : "s"} · {formatMoney(merchandiseTotal)}
                </p>
                <Link href="/cart" className="gold-btn w-full">
                  Go to cart
                </Link>
              </>
            ) : (
              <>
                <p className="mb-3 text-muted-foreground">Your cart is empty.</p>
                <Link href="/products" className="ghost-btn w-full">
                  Shop now
                </Link>
              </>
            )}
          </CardWidget>
          {staff ? (
            <CardWidget title="Admin dashboard" footerHref="/admin" footerLabel="Open admin">
              <p className="mb-3 text-sm text-muted-foreground">
                You have admin access. Manage orders, products, and settings.
              </p>
              <Link href="/admin" className="inline-block w-full bg-secondary px-4 py-2 text-center font-medium text-foreground hover:opacity-90">
                Open Admin →
              </Link>
            </CardWidget>
          ) : null}
        </div>

        <div className="lg:col-span-2" id="orders">
          <CardWidget title="Recent orders" footerHref="/account/orders" footerLabel="View all">
            {orders.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground">
                <p className="mb-2">No orders yet.</p>
                <Link href="/products" className="font-medium text-signal hover:underline">
                  Start shopping →
                </Link>
              </div>
            ) : (
              <div className="max-h-[220px] overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border/50 text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Order no.</th>
                      <th className="px-3 py-2 font-medium">Total</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Date</th>
                      <th className="px-3 py-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id} className="border-b border-border/30">
                        <td className="px-3 py-3 font-medium">
                          {order.orderNumber ? `#${order.orderNumber.replace(/^#/, "")}` : "—"}
                        </td>
                        <td className="px-3 py-3">{formatMoney(order.grandTotal)}</td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(order.status)}`}
                          >
                            {formatOrderStatus(order.status)}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-3">
                          <Link
                            href="/account/orders"
                            className="font-medium text-signal hover:underline"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardWidget>
        </div>
      </div>
    </div>
  );
}
