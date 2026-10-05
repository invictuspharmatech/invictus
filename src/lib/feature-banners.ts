import type { ApiBanner, ApiBannerRuntime, BannerBgMode, BannerTextMode } from "@/lib/api-types";

export const BANNER_BG_OPTIONS: { value: BannerBgMode; label: string; color: string }[] = [
  { value: "brand-orange", label: "Company orange", color: "#c65a1e" },
  { value: "brand-green", label: "Company green", color: "#28885B" },
  { value: "primary", label: "Green (primary)", color: "#1e7e34" },
  { value: "info", label: "Blue (info)", color: "#17a2b8" },
  { value: "success", label: "Green (success)", color: "#28a745" },
  { value: "warning", label: "Yellow (warning)", color: "#ffc107" },
  { value: "danger", label: "Red (danger)", color: "#dc3545" },
  { value: "secondary", label: "Gray (secondary)", color: "#6c757d" },
  { value: "dark", label: "Dark", color: "#212529" },
];

export const BANNER_TEXT_OPTIONS: { value: BannerTextMode; label: string; color: string }[] = [
  { value: "light", label: "Light text", color: "#ffffff" },
  { value: "dark", label: "Dark text", color: "#111827" },
  { value: "accent", label: "Accent", color: "#7ff4e8" },
];

const BG_MAP = Object.fromEntries(BANNER_BG_OPTIONS.map((row) => [row.value, row.color])) as Record<
  BannerBgMode,
  string
>;
const TEXT_MAP = Object.fromEntries(BANNER_TEXT_OPTIONS.map((row) => [row.value, row.color])) as Record<
  BannerTextMode,
  string
>;

export function bannerBgColor(mode?: string) {
  return BG_MAP[(mode as BannerBgMode) || "brand-orange"] || BG_MAP["brand-orange"];
}

export function bannerTextColor(mode?: string) {
  return TEXT_MAP[(mode as BannerTextMode) || "light"] || TEXT_MAP.light;
}

export function asBannerRuntime(payload: unknown): ApiBannerRuntime {
  if (Array.isArray(payload)) {
    return { items: payload as ApiBanner[], enabled: true, displayMode: "marquee" };
  }
  const row = (payload || {}) as Partial<ApiBannerRuntime>;
  return {
    items: Array.isArray(row.items) ? row.items : [],
    enabled: row.enabled !== false,
    displayMode: row.displayMode === "slider" ? "slider" : "marquee",
  };
}
