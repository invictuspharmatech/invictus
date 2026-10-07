"use client";

import { useEffect, useMemo, useState } from "react";
import type { ApiOrder, ApiPostageSender } from "@/lib/api-types";

const PACKAGE_PRESETS = [
  { key: "envelope", label: '10" × 14" envelope', length: "10", width: "14", height: "0.75" },
  { key: "4x6x2", label: '4" × 6" × 2"', length: "4", width: "6", height: "2" },
  { key: "9x6x2", label: '9" × 6" × 2"', length: "9", width: "6", height: "2" },
  { key: "8x6x3", label: '8" × 6" × 3"', length: "8", width: "6", height: "3" },
] as const;

type LabelForm = {
  fromName: string;
  fromStreet: string;
  fromApt: string;
  fromCity: string;
  fromState: string;
  fromZip: string;
  fromCountry: string;
  toName: string;
  toStreet: string;
  toStreet2: string;
  toCity: string;
  toState: string;
  toZip: string;
  toCountry: string;
  carrier: string;
  packageType: string;
  service: string;
  weightLbs: string;
  weightOz: string;
  length: string;
  width: string;
  height: string;
  testMode: boolean;
};

function emptyForm(order: ApiOrder): LabelForm {
  return {
    fromName: "",
    fromStreet: "",
    fromApt: "",
    fromCity: "",
    fromState: "",
    fromZip: "",
    fromCountry: "US",
    toName: order.customerName,
    toStreet: order.shippingLine1 || "",
    toStreet2: order.shippingLine2 || "",
    toCity: order.shippingCity || "",
    toState: order.shippingState || "",
    toZip: order.shippingPostal || "",
    toCountry: order.shippingCountry || "US",
    carrier: "usps",
    packageType: "USPScustom",
    service: "GroundAdvantage",
    weightLbs: "1",
    weightOz: "",
    length: PACKAGE_PRESETS[0].length,
    width: PACKAGE_PRESETS[0].width,
    height: PACKAGE_PRESETS[0].height,
    testMode: false,
  };
}

function applySender(form: LabelForm, sender: ApiPostageSender): LabelForm {
  return {
    ...form,
    fromName: sender.fromName,
    fromStreet: sender.fromStreet,
    fromApt: sender.fromApt,
    fromCity: sender.fromCity,
    fromState: sender.fromState,
    fromZip: sender.fromZip,
    fromCountry: sender.fromCountry || "US",
  };
}

export function PostageLabelModal({
  order,
  onClose,
  onCreated,
}: {
  order: ApiOrder;
  onClose: () => void;
  onCreated: (next: ApiOrder) => void;
}) {
  const [form, setForm] = useState<LabelForm>(() => emptyForm(order));
  const [senders, setSenders] = useState<ApiPostageSender[]>([]);
  const [senderId, setSenderId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetch("/api/admin/btcpostage/senders");
      const data = (await response.json().catch(() => [])) as ApiPostageSender[];
      if (cancelled || !Array.isArray(data)) return;
      setSenders(data);
      const chosen = data.find((row) => row.isDefault) || data[0];
      if (chosen) {
        setSenderId(chosen.id);
        setForm((current) => applySender(current, chosen));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const requiredFrom = useMemo(
    () => ["fromName", "fromStreet", "fromCity", "fromState", "fromZip"] as const,
    [],
  );

  function setField<K extends keyof LabelForm>(key: K, value: LabelForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit() {
    setError("");
    for (const key of requiredFrom) {
      if (!form[key].trim()) {
        setError("Fill the sender address before creating a label.");
        return;
      }
    }
    if (!form.toName.trim() || !form.toStreet.trim() || !form.toCity.trim() || !form.toZip.trim()) {
      setError("Fill the recipient address before creating a label.");
      return;
    }
    const lbs = Number(form.weightLbs || 0);
    const oz = Number(form.weightOz || 0);
    if (lbs * 16 + oz <= 0) {
      setError("Enter a package weight.");
      return;
    }
    setBusy(true);
    const response = await fetch(`/api/admin/orders/${order.id}/label`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...form,
        testMode: form.carrier === "usps" ? form.testMode : false,
        labelFormat: "PDF",
      }),
    });
    const payload = (await response.json().catch(() => null)) as
      | { error?: string; order?: ApiOrder }
      | null;
    setBusy(false);
    if (!response.ok || !payload?.order) {
      setError(payload?.error || "Could not create the Bitcoin Postage label.");
      return;
    }
    onCreated(payload.order);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4">
      <div className="tile max-h-[90vh] w-full max-w-3xl overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg">Bitcoin Postage label</h2>
            <p className="mt-1 text-sm text-muted-foreground">{order.orderNumber}</p>
          </div>
          <button type="button" className="ghost-btn" onClick={onClose}>
            Close
          </button>
        </div>
        {senders.length > 0 ? (
          <label className="mt-4 grid gap-1 text-sm">
            Saved sender
            <select
              className="field"
              value={senderId}
              onChange={(event) => {
                const next = senders.find((row) => row.id === event.target.value);
                setSenderId(event.target.value);
                if (next) setForm((current) => applySender(current, next));
              }}
            >
              {senders.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.fromName} · {row.fromCity}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <fieldset className="grid gap-2">
            <legend className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              From
            </legend>
            <input className="field" placeholder="Name" value={form.fromName} onChange={(e) => setField("fromName", e.target.value)} />
            <input className="field" placeholder="Street" value={form.fromStreet} onChange={(e) => setField("fromStreet", e.target.value)} />
            <input className="field" placeholder="Apt" value={form.fromApt} onChange={(e) => setField("fromApt", e.target.value)} />
            <input className="field" placeholder="City" value={form.fromCity} onChange={(e) => setField("fromCity", e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <input className="field" placeholder="State" value={form.fromState} onChange={(e) => setField("fromState", e.target.value)} />
              <input className="field" placeholder="ZIP" value={form.fromZip} onChange={(e) => setField("fromZip", e.target.value)} />
            </div>
          </fieldset>
          <fieldset className="grid gap-2">
            <legend className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              To
            </legend>
            <input className="field" placeholder="Name" value={form.toName} onChange={(e) => setField("toName", e.target.value)} />
            <input className="field" placeholder="Street" value={form.toStreet} onChange={(e) => setField("toStreet", e.target.value)} />
            <input className="field" placeholder="Street 2" value={form.toStreet2} onChange={(e) => setField("toStreet2", e.target.value)} />
            <input className="field" placeholder="City" value={form.toCity} onChange={(e) => setField("toCity", e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <input className="field" placeholder="State" value={form.toState} onChange={(e) => setField("toState", e.target.value)} />
              <input className="field" placeholder="ZIP" value={form.toZip} onChange={(e) => setField("toZip", e.target.value)} />
            </div>
          </fieldset>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="grid gap-1 text-sm">
            Carrier
            <select className="field" value={form.carrier} onChange={(e) => setField("carrier", e.target.value)}>
              <option value="usps">USPS</option>
              <option value="ups">UPS</option>
              <option value="fedex">FedEx</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Service
            <select className="field" value={form.service} onChange={(e) => setField("service", e.target.value)}>
              <option value="GroundAdvantage">Ground Advantage</option>
              <option value="Priority">Priority</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Package
            <select
              className="field"
              value={`${form.length}|${form.width}|${form.height}`}
              onChange={(e) => {
                const preset = PACKAGE_PRESETS.find(
                  (row) => `${row.length}|${row.width}|${row.height}` === e.target.value,
                );
                if (!preset) return;
                setForm((current) => ({
                  ...current,
                  length: preset.length,
                  width: preset.width,
                  height: preset.height,
                }));
              }}
            >
              {PACKAGE_PRESETS.map((row) => (
                <option key={row.key} value={`${row.length}|${row.width}|${row.height}`}>
                  {row.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Weight lbs
            <input className="field" value={form.weightLbs} onChange={(e) => setField("weightLbs", e.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            Weight oz
            <input className="field" value={form.weightOz} onChange={(e) => setField("weightOz", e.target.value)} />
          </label>
          {form.carrier === "usps" ? (
            <label className="flex items-end gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.testMode}
                onChange={(e) => setField("testMode", e.target.checked)}
              />
              Test mode
            </label>
          ) : null}
        </div>
        {error ? <p className="mt-3 text-sm text-brand-red">{error}</p> : null}
        <div className="mt-5 flex gap-2">
          <button type="button" className="gold-btn" disabled={busy} onClick={() => void submit()}>
            {busy ? "Creating…" : "Create label"}
          </button>
          <button type="button" className="ghost-btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
