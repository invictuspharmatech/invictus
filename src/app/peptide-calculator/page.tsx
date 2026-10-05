"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeftRight, Beaker, Droplets, Info, Syringe, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/site/PageHeader";
import {
  clamp,
  computeSyringeMl,
  doseBounds,
  formatSyringeMl,
  parseNum,
  vialBounds,
  type DoseUnit,
  type VialUnit,
  type WaterKey,
} from "@/lib/peptide-calculator";

function chipClass(active: boolean) {
  return [
    "cursor-pointer rounded-lg border-2 px-3 py-2 text-sm font-semibold transition-all",
    active
      ? "border-primary bg-primary/20 text-foreground shadow-sm"
      : "border-white/25 bg-white/5 text-foreground/85 hover:border-primary/50",
  ].join(" ");
}

function StepCard({
  icon: Icon,
  step,
  title,
  children,
}: {
  icon: LucideIcon;
  step: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/20 bg-white/10 p-6 shadow-xl backdrop-blur-2xl sm:p-8">
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Icon className="h-6 w-6" strokeWidth={2} aria-hidden />
        </div>
        <div className="min-w-0 pt-0.5">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Step {step}</p>
          <h2 className="display-font mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

function UnitToggle<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => onChange(option.value)}
            className={chipClass(value === option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function PeptideCalculatorPage() {
  const [vialUnit, setVialUnit] = useState<VialUnit>("mg");
  const [vialAmount, setVialAmount] = useState("10");
  const [waterKey, setWaterKey] = useState<WaterKey>("2");
  const [waterOther, setWaterOther] = useState("");
  const [doseUnit, setDoseUnit] = useState<DoseUnit>("mcg");
  const [doseAmount, setDoseAmount] = useState("250");
  const [primaryMassUnit, setPrimaryMassUnit] = useState<"mg" | "mcg">("mcg");

  useEffect(() => {
    if (doseUnit === "mg") setPrimaryMassUnit("mg");
    else if (doseUnit === "mcg") setPrimaryMassUnit("mcg");
  }, [doseUnit]);

  const vialLimit = vialBounds(vialUnit);
  const doseLimit = doseBounds(doseUnit);

  const waterMl = useMemo(() => {
    if (waterKey === "other") {
      const n = parseNum(waterOther);
      return n !== null && n > 0 ? n : null;
    }
    return Number.parseInt(waterKey, 10);
  }, [waterKey, waterOther]);

  const vialNum = parseNum(vialAmount);
  const doseNum = parseNum(doseAmount);
  const vialInRange = vialNum !== null && vialNum >= vialLimit.min && vialNum <= vialLimit.max;
  const doseInRange = doseNum !== null && doseNum >= doseLimit.min && doseNum <= doseLimit.max;

  const calc = useMemo(() => {
    if (!vialInRange || !doseInRange || waterMl === null || vialNum === null || doseNum === null) {
      return { result: null as ReturnType<typeof computeSyringeMl> | null, syringeMl: "" };
    }
    const result = computeSyringeMl(vialUnit, vialNum, waterMl, doseUnit, doseNum);
    if (!result.ok) {
      return { result, syringeMl: "" };
    }
    return { result, syringeMl: formatSyringeMl(result.ml) };
  }, [vialUnit, vialNum, waterMl, doseUnit, doseNum, vialInRange, doseInRange]);

  const showManualNotice = waterKey === "other" && (parseNum(waterOther) ?? 0) > 0;
  const incompatible = calc.result?.ok === false && calc.result.reason === "incompatible";

  const doseMassMcgMg = useMemo(() => {
    if (doseNum === null || !doseInRange || doseUnit === "iu") return null;
    const mcg = doseUnit === "mg" ? doseNum * 1000 : doseNum;
    return { mcg, mg: mcg / 1000 };
  }, [doseUnit, doseNum, doseInRange]);

  const mixedStrength = useMemo(() => {
    if (vialUnit !== "mg" || waterMl === null || vialNum === null || !vialInRange) return null;
    const mcgPerMl = (vialNum * 1000) / waterMl;
    return { mcgPerMl, mgPerMl: mcgPerMl / 1000 };
  }, [vialUnit, waterMl, vialNum, vialInRange]);

  const setVialPreset = (n: number) => setVialAmount(String(clamp(n, vialLimit.min, vialLimit.max)));
  const setDosePreset = (n: number) => setDoseAmount(String(clamp(n, doseLimit.min, doseLimit.max)));

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      <PageHeader
        kicker="Tools & Resources"
        title="Peptide Calculator"
        lede="Use this calculator to figure out your perfect dose."
      />

      {incompatible ? (
        <div className="mx-auto mb-6 flex max-w-3xl gap-3 rounded-xl border border-amber-400/40 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            <strong className="font-semibold">Unit mismatch.</strong> MG vials work with mg or mcg
            doses; IU vials work with IU doses. Switch the vial or dose unit, or confirm your label
            uses a consistent system.
          </p>
        </div>
      ) : null}

      {showManualNotice ? (
        <div className="mx-auto mb-6 flex max-w-3xl gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-foreground/90">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <p>
            <strong className="font-semibold">Custom water volume.</strong> You entered a diluent
            amount outside the 1–3 mL quick picks—double-check it against your protocol and vial.
          </p>
        </div>
      ) : null}

      <div className="mx-auto flex max-w-3xl flex-col gap-6 lg:max-w-none lg:flex-row lg:items-start lg:gap-8">
        <div className="min-w-0 flex-1 space-y-6">
          <StepCard icon={Beaker} step={1} title="Peptide vial quantity">
            <UnitToggle<VialUnit>
              label="Vial unit"
              value={vialUnit}
              onChange={(unit) => {
                setVialUnit(unit);
                setVialAmount("10");
              }}
              options={[
                { value: "mg", label: "mg" },
                { value: "iu", label: "IU" },
              ]}
            />
            <div className="mt-4 space-y-2">
              <label className="block text-sm" htmlFor="vial-amt">
                Amount
              </label>
              <input
                id="vial-amt"
                className="field"
                type="number"
                min={vialLimit.min}
                max={vialLimit.max}
                inputMode="decimal"
                value={vialAmount}
                onChange={(event) => setVialAmount(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Range: {vialLimit.min.toLocaleString()}–{vialLimit.max.toLocaleString()}{" "}
                {vialUnit === "mg" ? "mg" : "IU"}
              </p>
            </div>
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Quick fill
              </p>
              <div className="flex flex-wrap gap-2">
                {vialUnit === "mg"
                  ? [10, 20, 30].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setVialPreset(n)}
                        className={chipClass(vialAmount === String(n))}
                      >
                        {n} mg
                      </button>
                    ))
                  : [10, 36, 1500].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setVialPreset(n)}
                        className={chipClass(vialAmount === String(n))}
                      >
                        {n.toLocaleString()} IU
                      </button>
                    ))}
              </div>
            </div>
          </StepCard>

          <StepCard icon={Droplets} step={2} title="Bacteriostatic water added">
            <div className="flex flex-wrap gap-3">
              {(["1", "2", "3"] as const).map((key) => (
                <label key={key} className="inline-flex cursor-pointer">
                  <input
                    type="radio"
                    name="waterAmount"
                    value={key}
                    checked={waterKey === key}
                    onChange={() => {
                      setWaterKey(key);
                      setWaterOther("");
                    }}
                    className="sr-only"
                  />
                  <span className={chipClass(waterKey === key)}>{key} ml</span>
                </label>
              ))}
              <label className="inline-flex cursor-pointer">
                <input
                  type="radio"
                  name="waterAmount"
                  value="other"
                  checked={waterKey === "other"}
                  onChange={() => setWaterKey("other")}
                  className="sr-only"
                />
                <span className={chipClass(waterKey === "other")}>Other</span>
              </label>
            </div>
            {waterKey === "other" ? (
              <div className="mt-4 space-y-2">
                <label className="block text-sm" htmlFor="water-other">
                  Volume (ml)
                </label>
                <input
                  id="water-other"
                  className="field"
                  type="number"
                  min={0.1}
                  step={0.1}
                  inputMode="decimal"
                  value={waterOther}
                  onChange={(event) => setWaterOther(event.target.value)}
                  placeholder="e.g. 2.5"
                />
              </div>
            ) : null}
          </StepCard>

          <StepCard icon={Syringe} step={3} title="Peptide per dose">
            <UnitToggle<DoseUnit>
              label="Dose unit"
              value={doseUnit}
              onChange={(unit) => {
                setDoseUnit(unit);
                if (unit === "mcg") setDoseAmount("250");
                else if (unit === "mg") setDoseAmount("1");
                else setDoseAmount("100");
              }}
              options={[
                { value: "mcg", label: "mcg" },
                { value: "mg", label: "mg" },
                { value: "iu", label: "IU" },
              ]}
            />
            <div className="mt-4 space-y-2">
              <label className="block text-sm" htmlFor="dose-amt">
                Dose amount
              </label>
              <input
                id="dose-amt"
                className="field"
                type="number"
                min={doseLimit.min}
                max={doseLimit.max}
                inputMode="decimal"
                value={doseAmount}
                onChange={(event) => setDoseAmount(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Range: {doseLimit.min.toLocaleString()}–{doseLimit.max.toLocaleString()}{" "}
                {doseUnit === "mcg" ? "mcg" : doseUnit === "mg" ? "mg" : "IU"}
              </p>
            </div>
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Quick fill
              </p>
              <div className="flex flex-wrap gap-2">
                {doseUnit === "mcg"
                  ? [100, 250, 500].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setDosePreset(n)}
                        className={chipClass(doseAmount === String(n))}
                      >
                        {n} mcg
                      </button>
                    ))
                  : null}
                {doseUnit === "mg"
                  ? [1, 2, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setDosePreset(n)}
                        className={chipClass(doseAmount === String(n))}
                      >
                        {n} mg
                      </button>
                    ))
                  : null}
                {doseUnit === "iu"
                  ? [2, 3, 500].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setDosePreset(n)}
                        className={chipClass(doseAmount === String(n))}
                      >
                        {n} IU
                      </button>
                    ))
                  : null}
              </div>
            </div>
          </StepCard>
        </div>

        <aside className="w-full shrink-0 lg:sticky lg:top-28 lg:w-[min(100%,380px)]">
          <div className="rounded-2xl border-2 border-primary/45 bg-card/80 p-6 shadow-xl backdrop-blur-sm sm:p-8">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Syringe className="h-5 w-5" strokeWidth={2} aria-hidden />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Result</p>
                <p className="text-sm font-semibold">Syringe pull</p>
              </div>
            </div>
            <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
              For your selected dose, draw to this mark on the syringe (ml).
            </p>
            <div className="rounded-xl border border-primary/35 bg-white/5 p-4 backdrop-blur-sm">
              <p className="text-center text-3xl font-black tracking-tight text-primary sm:text-4xl">
                {calc.syringeMl ? calc.syringeMl : "—"}
                <span className="ml-1 text-lg font-bold text-muted-foreground sm:text-xl">ml</span>
              </p>
            </div>
            {calc.syringeMl && !incompatible && doseNum !== null && doseInRange ? (
              <div className="mt-4 space-y-3">
                {doseUnit === "iu" ? (
                  <div className="rounded-lg border border-white/20 bg-white/5 px-3 py-3 text-center text-sm leading-relaxed text-muted-foreground">
                    <p className="font-semibold text-foreground">Dose (IU)</p>
                    <p className="mt-1 text-lg font-bold text-foreground">
                      {doseNum.toLocaleString()} IU
                    </p>
                    <p className="mt-2 text-[11px] leading-snug">
                      mg/mcg conversion does not apply to IU-labeled doses without a product-specific
                      factor.
                    </p>
                  </div>
                ) : doseMassMcgMg ? (
                  <div className="rounded-lg border border-white/20 bg-white/5 px-3 py-3">
                    <p className="text-center text-xs font-semibold">Your dose</p>
                    {primaryMassUnit === "mg" ? (
                      <>
                        <p className="mt-1 text-center text-2xl font-bold tabular-nums">
                          {doseMassMcgMg.mg.toFixed(3)} mg
                        </p>
                        <p className="text-center text-xs text-muted-foreground">
                          {doseMassMcgMg.mcg.toLocaleString()} mcg
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="mt-1 text-center text-2xl font-bold tabular-nums">
                          {doseMassMcgMg.mcg.toLocaleString()} mcg
                        </p>
                        <p className="text-center text-xs text-muted-foreground">
                          {doseMassMcgMg.mg.toFixed(3)} mg
                        </p>
                      </>
                    )}
                    {mixedStrength ? (
                      <>
                        <p className="mt-4 text-center text-xs font-semibold">
                          Mixed concentration (full vial)
                        </p>
                        {primaryMassUnit === "mg" ? (
                          <>
                            <p className="mt-1 text-center text-xl font-bold tabular-nums">
                              {mixedStrength.mgPerMl.toFixed(3)} mg/ml
                            </p>
                            <p className="text-center text-xs text-muted-foreground">
                              {mixedStrength.mcgPerMl.toLocaleString(undefined, {
                                maximumFractionDigits: 1,
                              })}{" "}
                              mcg/ml
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="mt-1 text-center text-xl font-bold tabular-nums">
                              {mixedStrength.mcgPerMl.toLocaleString(undefined, {
                                maximumFractionDigits: 1,
                              })}{" "}
                              mcg/ml
                            </p>
                            <p className="text-center text-xs text-muted-foreground">
                              {mixedStrength.mgPerMl.toFixed(3)} mg/ml
                            </p>
                          </>
                        )}
                      </>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setPrimaryMassUnit((unit) => (unit === "mg" ? "mcg" : "mg"))}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-primary/35 bg-white/5 px-3 py-2.5 text-xs font-semibold text-primary shadow-sm transition hover:bg-primary/15"
                    >
                      <ArrowLeftRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      Convert: mg ↔ mcg
                    </button>
                    <p className="mt-2 text-center text-[11px] text-muted-foreground">1 mg = 1,000 mcg</p>
                  </div>
                ) : null}
              </div>
            ) : null}
            {calc.syringeMl ? (
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Pull to <strong className="text-foreground">{calc.syringeMl} ml</strong> for the dose
                you chose.
              </p>
            ) : (
              <p className="mt-4 text-center text-sm text-muted-foreground">
                {incompatible
                  ? "Adjust units to compute syringe volume."
                  : "Enter valid amounts in range to see your syringe volume."}
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
