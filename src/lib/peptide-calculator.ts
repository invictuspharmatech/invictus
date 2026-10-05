export const VIAL_MG = { min: 1, max: 100 } as const;
export const VIAL_IU = { min: 10, max: 20_000 } as const;
export const DOSE_MCG = { min: 1, max: 1000 } as const;
export const DOSE_MG = { min: 1, max: 100 } as const;
export const DOSE_IU = { min: 1, max: 1000 } as const;

export type VialUnit = "mg" | "iu";
export type DoseUnit = "mcg" | "mg" | "iu";
export type WaterKey = "1" | "2" | "3" | "other";
export type CalcResult = { ok: true; ml: number } | { ok: false; reason: "incompatible" | "incomplete" };

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function parseNum(s: string): number | null {
  const t = s.trim();
  if (t === "") return null;
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

export function vialBounds(unit: VialUnit) {
  switch (unit) {
    case "mg":
      return VIAL_MG;
    case "iu":
      return VIAL_IU;
    default: {
      const exhaustive: never = unit;
      return exhaustive;
    }
  }
}

export function doseBounds(unit: DoseUnit) {
  switch (unit) {
    case "mcg":
      return DOSE_MCG;
    case "mg":
      return DOSE_MG;
    case "iu":
      return DOSE_IU;
    default: {
      const exhaustive: never = unit;
      return exhaustive;
    }
  }
}

/** Great Life syringe volume: dose / vial mass × bacteriostatic water (ml). */
export function computeSyringeMl(
  vialUnit: VialUnit,
  vialAmt: number,
  waterMl: number,
  doseUnit: DoseUnit,
  doseAmt: number,
): CalcResult {
  if (waterMl <= 0 || vialAmt <= 0 || doseAmt <= 0) {
    return { ok: false, reason: "incomplete" };
  }

  if (vialUnit === "mg") {
    if (doseUnit === "iu") {
      return { ok: false, reason: "incompatible" };
    }
    const totalMcg = vialAmt * 1000;
    const doseMcg = doseUnit === "mg" ? doseAmt * 1000 : doseAmt;
    const ml = (doseMcg / totalMcg) * waterMl;
    return { ok: true, ml };
  }

  if (vialUnit === "iu") {
    if (doseUnit !== "iu") {
      return { ok: false, reason: "incompatible" };
    }
    const ml = (doseAmt / vialAmt) * waterMl;
    return { ok: true, ml };
  }

  const exhaustive: never = vialUnit;
  return exhaustive;
}

export function formatSyringeMl(ml: number): string {
  return ml.toFixed(3);
}
