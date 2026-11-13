export type ComingSoonPublic = {
  enabled: boolean;
  launchAtIso: string | null;
  launchAtMs: number | null;
  timezone: string;
  bannerText: string;
  eyebrow: string;
  monthLabel: string;
  dayLabel: string;
  dateMeta: string;
  ghostNumber: string;
  launchDisplay: string;
  dek: string;
  panelLabel: string;
  panelHeading: string;
  panelSub: string;
  nowMs?: number;
};

export type ComingSoonAdmin = ComingSoonPublic & {
  launchAtLocal: string;
  panelLabelDisplay?: string;
};

export const COMING_SOON_FALLBACK: ComingSoonPublic = {
  enabled: false,
  launchAtIso: null,
  launchAtMs: null,
  timezone: "America/New_York",
  bannerText: "A stronger standard arrives November 16",
  eyebrow: "Precision, not noise.",
  monthLabel: "NOVEMBER",
  dayLabel: "16",
  dateMeta: "2026—11—16",
  ghostNumber: "16",
  launchDisplay: "November 16, 2026",
  dek: "Invictus is built around a simple idea: <strong>the standard should be higher.</strong>",
  panelLabel: "Launch protocol",
  panelHeading: "The standard<br>is almost here.",
  panelSub: "Invictus Pharma opens soon.<br>Create an account to get the launch notice.",
};
