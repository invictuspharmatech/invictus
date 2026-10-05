export type DashboardTileColorMode =
  | "brand-orange"
  | "brand-green"
  | "primary"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "secondary"
  | "dark"
  | "threshold_sales"
  | "threshold_low_stock"
  | "threshold_out_of_stock"
  | "threshold_shipping";

export type DashboardTileColSpan = 1 | 2;

export type DashboardTileLayoutItem = {
  id: string;
  row: number;
  sort: number;
  color: DashboardTileColorMode;
  enabled: boolean;
  label?: string | null;
  colSpan?: DashboardTileColSpan;
};

export type DashboardTilesLayout = {
  tiles: DashboardTileLayoutItem[];
};

export type DashboardTileCatalogEntry = {
  id: string;
  label: string;
  group: string;
  valuePath: string;
  format: "count" | "currency";
  footerHref: string;
  periodHint: string;
  supportsDynamicColor: boolean;
};

export const DASHBOARD_TILE_COLOR_MODES: DashboardTileColorMode[] = [
  "brand-orange",
  "brand-green",
  "primary",
  "info",
  "success",
  "warning",
  "danger",
  "secondary",
  "dark",
  "threshold_sales",
  "threshold_low_stock",
  "threshold_out_of_stock",
  "threshold_shipping",
];

export const DASHBOARD_TILE_COLOR_LABELS: Record<DashboardTileColorMode, string> = {
  "brand-orange": "Company orange",
  "brand-green": "Company green",
  primary: "Blue (primary)",
  info: "Blue (info)",
  success: "Green (success)",
  warning: "Yellow (warning)",
  danger: "Red (danger)",
  secondary: "Gray (secondary)",
  dark: "Dark",
  threshold_sales: "Auto (sales thresholds)",
  threshold_low_stock: "Auto (low stock)",
  threshold_out_of_stock: "Auto (out of stock)",
  threshold_shipping: "Auto (shipping collected)",
};

export function isDashboardTileColorMode(value: string): value is DashboardTileColorMode {
  return (DASHBOARD_TILE_COLOR_MODES as string[]).includes(value);
}

export function tileColSpan(item: { colSpan?: number }): DashboardTileColSpan {
  return item.colSpan === 2 ? 2 : 1;
}

export function catalogGroupedForSelect(catalog: DashboardTileCatalogEntry[]) {
  const groups = new Map<string, DashboardTileCatalogEntry[]>();
  for (const entry of catalog) {
    const list = groups.get(entry.group) ?? [];
    list.push(entry);
    groups.set(entry.group, list);
  }
  return [...groups.entries()].map(([group, items]) => ({ group, items }));
}

export function tileSupportsDynamicColor(entry: DashboardTileCatalogEntry | undefined): boolean {
  return Boolean(entry?.supportsDynamicColor);
}

export function defaultColorForNewTile(
  tileId: string,
  entry: DashboardTileCatalogEntry,
): DashboardTileColorMode {
  if (tileSupportsDynamicColor(entry)) {
    if (tileId.includes("out_of_stock")) return "threshold_out_of_stock";
    if (tileId.includes("low_stock") || tileId.includes("stock")) return "threshold_low_stock";
    if (tileId.includes("shipping")) return "threshold_shipping";
    if (tileId.startsWith("sales_")) return "threshold_sales";
  }
  if (tileId.includes("failed")) return "danger";
  return "brand-orange";
}

function daysInCurrentMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

function parseAmount(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function salesTone(amount: number, dayMultiplier: number) {
  if (amount <= 0) return "dash-tile-danger";
  if (amount <= 500 * dayMultiplier) return "dash-tile-warning";
  if (amount <= 1000 * dayMultiplier) return "dash-tile-info";
  return "dash-tile-success";
}

function fixedTone(color: DashboardTileColorMode): string {
  switch (color) {
    case "brand-orange":
      return "dash-tile-orange";
    case "brand-green":
      return "dash-tile-green";
    case "primary":
      return "dash-tile-primary";
    case "info":
      return "dash-tile-info";
    case "success":
      return "dash-tile-success";
    case "warning":
      return "dash-tile-warning";
    case "danger":
      return "dash-tile-danger";
    case "secondary":
      return "dash-tile-secondary";
    case "dark":
      return "dash-tile-dark";
    case "threshold_sales":
    case "threshold_low_stock":
    case "threshold_out_of_stock":
    case "threshold_shipping":
      return "dash-tile-secondary";
    default: {
      const exhaustive: never = color;
      return exhaustive;
    }
  }
}

export function resolveDashboardTileTone(
  colorMode: string,
  tileId: string,
  value: unknown,
): string {
  const color = isDashboardTileColorMode(colorMode) ? colorMode : "brand-orange";
  if (color === "threshold_sales") {
    const multiplier =
      tileId === "sales_this_month" || tileId === "sales_this_year"
        ? daysInCurrentMonth()
        : tileId === "sales_this_week"
          ? 7
          : 1;
    return salesTone(parseAmount(value), multiplier);
  }
  if (color === "threshold_low_stock") {
    return parseAmount(value) > 0 ? "dash-tile-warning" : "dash-tile-success";
  }
  if (color === "threshold_out_of_stock") {
    return parseAmount(value) > 0 ? "dash-tile-danger" : "dash-tile-success";
  }
  if (color === "threshold_shipping") {
    return parseAmount(value) > 0 ? "dash-tile-info" : "dash-tile-success";
  }
  return fixedTone(color);
}
