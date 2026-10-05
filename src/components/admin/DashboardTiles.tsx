import Link from "next/link";
import { formatMoney } from "@/lib/constants";
import { resolveDashboardTileTone } from "@/lib/dashboard/tiles";
import type { ApiDashboardOverview, ApiDashboardTile } from "@/lib/api-types";

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

function Tile({
  href,
  tone,
  value,
  label,
  hint,
  colSpan,
}: {
  href: string;
  tone: string;
  value: string;
  label: string;
  hint?: string;
  colSpan: number;
}) {
  return (
    <Link
      href={href}
      className={`dash-tile ${tone} ${colSpan === 2 ? "sm:col-span-2" : ""}`}
    >
      <h3>{value}</h3>
      <p>{label}</p>
      {hint ? <span className="dash-tile-hint">{hint}</span> : null}
    </Link>
  );
}

function displayValue(tile: ApiDashboardTile) {
  const amount = typeof tile.value === "number" ? tile.value : Number(tile.value) || 0;
  return tile.format === "currency" ? formatMoney(amount) : String(amount);
}

export function DashboardTiles({ overview }: { overview: ApiDashboardOverview }) {
  const tiles = overview.dashboardTiles ?? [];
  if (tiles.length === 0) return null;
  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((tile) => (
        <Tile
          key={tile.id}
          href={tile.href}
          tone={resolveDashboardTileTone(tile.color, tile.id, tile.value)}
          value={displayValue(tile)}
          label={tile.label}
          hint={tileHint(tile, overview.period)}
          colSpan={tile.colSpan}
        />
      ))}
    </div>
  );
}
