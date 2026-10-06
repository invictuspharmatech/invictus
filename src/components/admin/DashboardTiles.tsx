"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ComponentType } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  CheckCircle,
  Clock,
  Gift,
  Layers,
  Package,
  Pause,
  Redo2,
  ShoppingCart,
  Tag,
  Truck,
  Users,
  Wallet,
  Warehouse,
  XCircle,
} from "lucide-react";
import { formatMoney } from "@/lib/constants";
import { resolveDashboardTileTone } from "@/lib/dashboard/tiles";
import type { ApiDashboardOverview, ApiDashboardTile } from "@/lib/api-types";

const ICON_BY_ID: Record<string, ComponentType<{ className?: string }>> = {
  orders_failed: XCircle,
  orders_pending: Clock,
  orders_processing: ShoppingCart,
  orders_completed_week: CheckCircle,
  orders_on_hold: Pause,
  orders_cancelled: Ban,
  orders_refunded: Redo2,
  orders_partially_filled: Package,
  open_orders: ShoppingCart,
  customers_total: Users,
  customers_this_month: Users,
  pending_affiliates: Users,
  shipping_since_reset: Truck,
  shipping_this_week: Truck,
  sales_today: Wallet,
  sales_this_week: Wallet,
  sales_this_month: Wallet,
  sales_this_year: Wallet,
  products_low_stock: AlertTriangle,
  products_out_of_stock: AlertTriangle,
  products_total: Package,
  products_active: Package,
  categories_total: Layers,
  warehouses_total: Warehouse,
  coupons_total: Tag,
  gift_cards_total: Gift,
  store_credit_available: Wallet,
  top_category_month: Layers,
};

function tileHint(
  tile: ApiDashboardTile,
  period?: { todayLabel: string; weekLabel: string; monthLabel: string },
) {
  switch (tile.periodHint) {
    case "today":
      return period?.todayLabel || tile.periodHint;
    case "week":
      return period?.weekLabel || "Resets each Monday";
    case "month":
      return period?.monthLabel || tile.periodHint;
    default:
      return tile.periodHint;
  }
}

function displayValue(tile: ApiDashboardTile) {
  const amount = typeof tile.value === "number" ? tile.value : Number(tile.value) || 0;
  return tile.format === "currency" ? formatMoney(amount) : String(amount);
}

function TileIcon({ id, named }: { id: string; named?: string }) {
  const Icon = ICON_BY_ID[id] ?? ICON_BY_ID[named || ""] ?? Package;
  return <Icon className="dash-tile-icon size-10" />;
}

function TileBody({
  tile,
  period,
}: {
  tile: ApiDashboardTile;
  period?: { todayLabel: string; weekLabel: string; monthLabel: string };
}) {
  const kind = tile.kind ?? "link";
  return (
    <>
      <div className="dash-tile-inner">
        <h3>{displayValue(tile)}</h3>
        {kind === "top_category" ? (
          <>
            <p className="truncate" title={tile.extraLabel || tile.label}>
              {tile.extraLabel || tile.label}
            </p>
            <span className="dash-tile-hint">{tileHint(tile, period)}</span>
          </>
        ) : (
          <>
            <p>{tile.label}</p>
            <span className="dash-tile-hint">{tileHint(tile, period)}</span>
          </>
        )}
        {kind === "products_breakdown" && tile.badges?.length ? (
          <div>
            {tile.badges.map((badge) => (
              <span key={badge.text} className="dash-tile-badge">
                {badge.text}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <TileIcon id={tile.id} named={tile.icon} />
    </>
  );
}

function TileFooter({
  tile,
  onResetShipping,
  resetting,
}: {
  tile: ApiDashboardTile;
  onResetShipping: () => void;
  resetting: boolean;
}) {
  const kind = tile.kind ?? "link";
  switch (kind) {
    case "shipping_reset":
      return (
        <button
          type="button"
          className="dash-tile-footer"
          onClick={onResetShipping}
          disabled={resetting}
        >
          {resetting ? "Resetting…" : tile.footerLabel || "Reset shipping collected"}
          <Redo2 className="size-4" />
        </button>
      );
    case "link":
    case "top_category":
    case "products_breakdown":
      return (
        <Link href={tile.href} className="dash-tile-footer">
          {tile.footerLabel || "More info"}
          <ArrowRight className="size-4" />
        </Link>
      );
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

export function DashboardTiles({ overview }: { overview: ApiDashboardOverview }) {
  const router = useRouter();
  const [resetting, setResetting] = useState(false);
  const tiles = overview.dashboardTiles ?? [];
  const rows = useMemo(() => {
    const grouped = new Map<number, ApiDashboardTile[]>();
    for (const tile of tiles) {
      const list = grouped.get(tile.row) ?? [];
      list.push(tile);
      grouped.set(tile.row, list);
    }
    return [...grouped.entries()].sort((a, b) => a[0] - b[0]);
  }, [tiles]);

  async function handleResetShipping() {
    if (
      !window.confirm(
        "Reset shipping collected counter? The value will go to zero and counting will restart from now until you reset again.",
      )
    ) {
      return;
    }
    setResetting(true);
    try {
      const response = await fetch("/api/admin/dashboard/shipping-reset", { method: "POST" });
      if (!response.ok) {
        window.alert("Failed to reset shipping collected counter.");
        return;
      }
      router.refresh();
    } catch {
      window.alert("Failed to reset shipping collected counter.");
    } finally {
      setResetting(false);
    }
  }

  if (tiles.length === 0) return null;

  return (
    <div className="mt-6 space-y-4">
      {rows.map(([row, items]) => (
        <div key={row} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((tile) => (
            <div
              key={tile.id}
              className={`dash-tile ${resolveDashboardTileTone(tile.color, tile.id, tile.value)} ${
                tile.colSpan === 2 ? "sm:col-span-2" : ""
              }`}
            >
              <TileBody tile={tile} period={overview.period} />
              <TileFooter tile={tile} onResetShipping={handleResetShipping} resetting={resetting} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
