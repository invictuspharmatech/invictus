export const SELECTABLE_COLOR_OPTIONS = [
  { value: "brand-orange", label: "Orange", color: "#c65a1e" },
  { value: "brand-green", label: "Green", color: "#28885B" },
  { value: "brand-red", label: "Dark red", color: "#610c0d" },
  { value: "primary", label: "Green (primary)", color: "#1e7e34" },
  { value: "info", label: "Blue (info)", color: "#17a2b8" },
  { value: "success", label: "Green (success)", color: "#28a745" },
  { value: "warning", label: "Yellow (warning)", color: "#ffc107" },
  { value: "danger", label: "Red (danger)", color: "#dc3545" },
  { value: "secondary", label: "Gray (secondary)", color: "#6c757d" },
  { value: "dark", label: "Dark", color: "#212529" },
] as const;

export type SelectableColorMode = (typeof SELECTABLE_COLOR_OPTIONS)[number]["value"];

export const SELECTABLE_COLOR_MODES: SelectableColorMode[] = SELECTABLE_COLOR_OPTIONS.map(
  (option) => option.value,
);

export const SELECTABLE_COLOR_LABELS: Record<SelectableColorMode, string> = Object.fromEntries(
  SELECTABLE_COLOR_OPTIONS.map((option) => [option.value, option.label]),
) as Record<SelectableColorMode, string>;

export const SELECTABLE_COLOR_HEX: Record<SelectableColorMode, string> = Object.fromEntries(
  SELECTABLE_COLOR_OPTIONS.map((option) => [option.value, option.color]),
) as Record<SelectableColorMode, string>;

export function isSelectableColorMode(value: string): value is SelectableColorMode {
  return (SELECTABLE_COLOR_MODES as string[]).includes(value);
}
