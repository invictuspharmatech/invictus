"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { RevenueSplit } from "@/lib/api-types";

const FIELDS = [
  { warehouse: "Warehouse 1", keys: ["w1Admin", "w1Party1", "w1Party2"] as const },
  { warehouse: "Warehouse 2", keys: ["w2Admin", "w2Party1", "w2Party2"] as const },
] as const;

const LABELS: Record<(typeof FIELDS)[number]["keys"][number], string> = {
  w1Admin: "Admin %",
  w1Party1: "Party 1 %",
  w1Party2: "Party 2 %",
  w2Admin: "Admin %",
  w2Party1: "Party 1 %",
  w2Party2: "Party 2 %",
};

function asNumber(value: string) {
  if (value.trim() === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function SplitForm({ split }: { split: RevenueSplit }) {
  const router = useRouter();
  const [values, setValues] = useState({
    w1Admin: String(split.w1Admin),
    w1Party1: String(split.w1Party1),
    w1Party2: String(split.w1Party2),
    w2Admin: String(split.w2Admin),
    w2Party1: String(split.w2Party1),
    w2Party2: String(split.w2Party2),
  });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);

  const w1Total = round2(
    asNumber(values.w1Admin) + asNumber(values.w1Party1) + asNumber(values.w1Party2),
  );
  const w2Total = round2(
    asNumber(values.w2Admin) + asNumber(values.w2Party1) + asNumber(values.w2Party2),
  );
  const over = w1Total > 100 || w2Total > 100;
  const incomplete = Math.abs(w1Total - 100) > 0.05 || Math.abs(w2Total - 100) > 0.05;
  const message = useMemo(() => {
    if (over) return "Warehouse shares cannot total more than 100%.";
    if (incomplete) return "Each warehouse must total exactly 100%.";
    return "";
  }, [incomplete, over]);

  function payload() {
    return {
      w1Admin: asNumber(values.w1Admin),
      w1Party1: asNumber(values.w1Party1),
      w1Party2: asNumber(values.w1Party2),
      w2Admin: asNumber(values.w2Admin),
      w2Party1: asNumber(values.w2Party1),
      w2Party2: asNumber(values.w2Party2),
    };
  }

  async function save(next: Record<string, number> | { reset: true }) {
    setBusy(true);
    setError("");
    setSaved("");
    const response = await fetch("/api/admin/accounting/split", {
      method: "reset" in next ? "POST" : "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(next),
    });
    const data = (await response.json().catch(() => null)) as
      | (RevenueSplit & { error?: string })
      | null;
    setBusy(false);
    if (!response.ok || !data) {
      setError(data?.error || "Could not save split percentages.");
      return;
    }
    setValues({
      w1Admin: String(data.w1Admin),
      w1Party1: String(data.w1Party1),
      w1Party2: String(data.w1Party2),
      w2Admin: String(data.w2Admin),
      w2Party1: String(data.w2Party1),
      w2Party2: String(data.w2Party2),
    });
    setSaved("reset" in next ? "Default shares restored." : "Split percentages saved.");
    router.refresh();
  }

  return (
    <section className="tile mt-8">
      <h2 className="text-lg">Revenue split percentages</h2>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        These shares are used for accounting. Defaults are Admin 25% / Party 1 60% / Party 2 15%
        on Warehouse 1 and Admin 25% / Party 1 0% / Party 2 75% on Warehouse 2. Restore defaults
        anytime. Each warehouse must total 100% and cannot go over.
      </p>
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {FIELDS.map((group) => {
          const total = group.warehouse === "Warehouse 1" ? w1Total : w2Total;
          return (
            <fieldset key={group.warehouse} className="grid gap-3">
              <legend className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                {group.warehouse} · {total.toFixed(2)}%
              </legend>
              {group.keys.map((key) => (
                <label key={key} className="grid gap-1 text-sm">
                  {LABELS[key]}
                  <input
                    className="field"
                    inputMode="decimal"
                    value={values[key]}
                    onChange={(event) =>
                      setValues((current) => ({ ...current, [key]: event.target.value }))
                    }
                  />
                </label>
              ))}
              <button
                type="button"
                className="ghost-btn max-w-56"
                onClick={() => {
                  const adminKey = group.keys[0];
                  const party1Key = group.keys[1];
                  const party2Key = group.keys[2];
                  const remainder = round2(100 - asNumber(values[adminKey]) - asNumber(values[party1Key]));
                  setValues((current) => ({
                    ...current,
                    [party2Key]: String(remainder < 0 ? 0 : remainder),
                  }));
                }}
              >
                Fill remainder into Party 2
              </button>
            </fieldset>
          );
        })}
      </div>
      {message ? <p className="mt-4 text-sm text-brand-red">{message}</p> : null}
      {error ? <p className="mt-2 text-sm text-brand-red">{error}</p> : null}
      {saved ? <p className="mt-2 text-sm text-muted-foreground">{saved}</p> : null}
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          className="gold-btn"
          disabled={busy || over || incomplete}
          onClick={() => void save(payload())}
        >
          Save shares
        </button>
        <button
          type="button"
          className="ghost-btn"
          disabled={busy}
          onClick={() => void save({ reset: true })}
        >
          Restore defaults
        </button>
      </div>
    </section>
  );
}
