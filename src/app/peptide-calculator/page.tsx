"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/site/PageHeader";

type MassUnit = "mg" | "iu";
type DoseUnit = "mcg" | "mg" | "iu";

export default function PeptideCalculatorPage() {
  const [vialUnit, setVialUnit] = useState<MassUnit>("mg");
  const [vialAmount, setVialAmount] = useState(10);
  const [waterMl, setWaterMl] = useState(2);
  const [customWater, setCustomWater] = useState(2);
  const [waterMode, setWaterMode] = useState<"preset" | "other">("preset");
  const [doseUnit, setDoseUnit] = useState<DoseUnit>("mcg");
  const [doseAmount, setDoseAmount] = useState(250);

  const water = waterMode === "other" ? customWater : waterMl;

  const result = useMemo(() => {
    const vialMg = vialUnit === "mg" ? vialAmount : vialAmount; // IU treated as numeric mass analog
    const doseMg =
      doseUnit === "mg" ? doseAmount : doseUnit === "mcg" ? doseAmount / 1000 : doseAmount;
    if (water <= 0 || vialMg <= 0 || doseMg <= 0) {
      return null;
    }
    const concentrationMgMl = vialMg / water;
    const pullMl = doseMg / concentrationMgMl;
    return {
      pullMl,
      doseMcg: doseMg * 1000,
      doseMg,
      concMcg: concentrationMgMl * 1000,
      concMg: concentrationMgMl,
    };
  }, [vialUnit, vialAmount, water, doseUnit, doseAmount]);

  return (
    <div className="mx-auto max-w-4xl px-4 pb-20 sm:px-6">
      <PageHeader
        kicker="Tools & Resources"
        title="Peptide Calculator"
        lede="Use this calculator to figure out your perfect dose."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <section className="tile">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Step 1</p>
            <h2 className="mt-2 text-xl">Peptide vial quantity</h2>
            <div className="mt-4 flex gap-2">
              {(["mg", "iu"] as const).map((unit) => (
                <button
                  key={unit}
                  className={unit === vialUnit ? "gold-btn" : "ghost-btn"}
                  type="button"
                  onClick={() => setVialUnit(unit)}
                >
                  {unit}
                </button>
              ))}
            </div>
            <label className="mt-4 block text-sm">
              Amount
              <input
                className="field mt-2"
                type="number"
                min={1}
                max={100}
                value={vialAmount}
                onChange={(event) => setVialAmount(Number(event.target.value))}
              />
            </label>
            <div className="mt-3 flex gap-2">
              {[10, 20, 30].map((value) => (
                <button
                  key={value}
                  type="button"
                  className="ghost-btn"
                  onClick={() => setVialAmount(value)}
                >
                  {value} {vialUnit}
                </button>
              ))}
            </div>
          </section>
          <section className="tile">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Step 2</p>
            <h2 className="mt-2 text-xl">Bacteriostatic water added</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              {[1, 2, 3].map((value) => (
                <label key={value} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={waterMode === "preset" && waterMl === value}
                    onChange={() => {
                      setWaterMode("preset");
                      setWaterMl(value);
                    }}
                  />
                  {value} ml
                </label>
              ))}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={waterMode === "other"}
                  onChange={() => setWaterMode("other")}
                />
                Other
              </label>
            </div>
            {waterMode === "other" ? (
              <input
                className="field mt-3"
                type="number"
                min={0.1}
                step={0.1}
                value={customWater}
                onChange={(event) => setCustomWater(Number(event.target.value))}
              />
            ) : null}
          </section>
          <section className="tile">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Step 3</p>
            <h2 className="mt-2 text-xl">Peptide per dose</h2>
            <div className="mt-4 flex gap-2">
              {(["mcg", "mg", "iu"] as const).map((unit) => (
                <button
                  key={unit}
                  className={unit === doseUnit ? "gold-btn" : "ghost-btn"}
                  type="button"
                  onClick={() => setDoseUnit(unit)}
                >
                  {unit}
                </button>
              ))}
            </div>
            <label className="mt-4 block text-sm">
              Dose amount
              <input
                className="field mt-2"
                type="number"
                min={1}
                value={doseAmount}
                onChange={(event) => setDoseAmount(Number(event.target.value))}
              />
            </label>
            <div className="mt-3 flex gap-2">
              {[100, 250, 500].map((value) => (
                <button
                  key={value}
                  type="button"
                  className="ghost-btn"
                  onClick={() => {
                    setDoseUnit("mcg");
                    setDoseAmount(value);
                  }}
                >
                  {value} mcg
                </button>
              ))}
            </div>
          </section>
        </div>
        <aside className="tile h-fit">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Result</p>
          {result ? (
            <>
              <h2 className="mt-3 text-xl">Syringe pull</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                For your selected dose, draw to this mark on the syringe (ml).
              </p>
              <p className="mt-4 text-4xl">{result.pullMl.toFixed(3)} ml</p>
              <dl className="mt-6 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt>Your dose</dt>
                  <dd>
                    {result.doseMcg.toFixed(0)} mcg · {result.doseMg.toFixed(3)} mg
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt>Mixed concentration</dt>
                  <dd>
                    {result.concMcg.toLocaleString(undefined, { maximumFractionDigits: 0 })} mcg/ml
                    · {result.concMg.toFixed(3)} mg/ml
                  </dd>
                </div>
              </dl>
              <p className="mt-6 text-xs text-muted-foreground">1 mg = 1,000 mcg</p>
            </>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">Enter valid amounts to calculate.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
